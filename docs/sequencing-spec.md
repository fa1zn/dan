# Master Sequence — Dan's autonomous sales motion (spec)

> Build target for a separate shell. Designed as an **additive layer** on top of the
> finished "Dan's sales tool" (SOR + CRM + integrations). All new logic lives in new
> files under `pipeline/sequence/` and `lib/sequence*`; the only edits to shared files
> are append-only, so this merges onto `main` with trivial conflict resolution.

## 1. What it does

Dan runs a fixed, repeatable sales motion against a scraped dealership (the running
example: **Honda of Dublin, OH**). The motion is three channels in order:

1. **Call** — generic voice provider places an outbound call with a Dan persona ("Hey, this is Dan…").
2. **Text** — SMS follow-up a day later.
3. **Edible** — a food-delivery gift (doughnuts / pizza / local treat) sent to the rooftop address.

The engine **orchestrates** that motion autonomously: it enrolls a rooftop, waits the
configured delay between steps, dispatches each step through a channel adapter, logs every
touch to the existing `activity` timeline, advances `account_crm` status, and exits the
sequence when the account engages or is marked won/lost.

### Decisions locked for this build
- **Call channel:** generic, provider-neutral voice adapter (Twilio / Vapi / Bland), swappable by env. Persona = Dan.
- **Edible channel:** food-delivery gift (DoorDash / Uber Eats) to the dealership address.
- **Autonomy:** fully autonomous — Dan advances and sends every step on schedule, no human approval gate.
- **Free-tier safety preserved:** even fully autonomous, the engine is **dry-run by default**. Nothing real sends, and no money moves, unless `SEQUENCE_APPLY=1`. This mirrors the repo's existing `ZOOMINFO_APPLY` / dry-run-first pattern. "Autonomous" governs *who decides*, not *whether the safety default holds*.

## 2. Data model (3 new tables)

Add to **`lib/schema.ts`** (Drizzle source of truth) and mirror the DDL in **`lib/db.ts`**'s
bootstrap `db.exec(...)` block as `CREATE TABLE IF NOT EXISTS` — same pattern as `account_crm`/`activity`, so no separate migration tool.

### `sequences` — the template
| col | type | notes |
| --- | --- | --- |
| id | int pk autoinc | |
| name | text not null | e.g. "Dan core motion" |
| description | text | |
| steps | text json | ordered `Step[]` (see §3) |
| active | int bool default 1 | |
| created_at / updated_at | text default CURRENT_TIMESTAMP | |

### `enrollments` — a rooftop running a sequence
| col | type | notes |
| --- | --- | --- |
| id | int pk autoinc | |
| dealership_id | int → dealerships(id) ON DELETE CASCADE | |
| sequence_id | int → sequences(id) | |
| state | text | `active` \| `paused` \| `completed` \| `exited` |
| current_step | int default 0 | index into `steps` |
| next_run_at | text ISO | when the current step becomes due |
| exit_reason | text | "engaged" \| "won" \| "lost" \| "completed" \| "killed" |
| enrolled_by | text default 'Dan' | |
| enrolled_at / updated_at | text default CURRENT_TIMESTAMP | |

Index: `UNIQUE(dealership_id, sequence_id)` filtered to active enrollments (enforce in
code: refuse to enroll if an `active` row already exists) to prevent double-enroll.

### `sequence_step_runs` — the dispatch ledger (idempotency + audit)
| col | type | notes |
| --- | --- | --- |
| id | int pk autoinc | |
| enrollment_id | int → enrollments(id) ON DELETE CASCADE | |
| step_index | int | |
| channel | text | `call` \| `sms` \| `gift` |
| provider | text | resolved provider name, e.g. "twilio", "doordash", "simulated" |
| state | text | `pending` \| `sent` \| `failed` \| `skipped` \| `cancelled` |
| scheduled_at | text ISO | |
| executed_at | text ISO | |
| external_ref | text | provider call/message/order id |
| cost_cents | int default 0 | for gift budget accounting |
| attempts | int default 0 | retry counter |
| payload | text json | rendered context sent |
| result | text json | provider response |
| error | text | |
| created_at | text default CURRENT_TIMESTAMP | |

Index: `UNIQUE(enrollment_id, step_index)` — **each step is dispatched at most once.** The
tick is idempotent: if a `sent` run exists for `(enrollment, current_step)`, advance without re-sending.

### Activity timeline reuse
Extend **`lib/crm-constants.ts`**:
```ts
export const ACTIVITY_KINDS = ["note","status_change","owner_change","call","email","sms","gift","sequence"] as const;
```
Every step dispatch calls `logActivity(dealershipId, kind, body, "Dan")` so the motion shows
inline in the rooftop's existing timeline. `sequence` kind logs lifecycle events (enrolled, exited, completed).

## 3. Step shape & the canonical sequence

`Step` (stored as JSON in `sequences.steps`), defined in **`lib/sequence-constants.ts`**:
```ts
export type Channel = "call" | "sms" | "gift";
export type GiftKind = "doughnuts" | "pizza" | "local";

export interface Step {
  channel: Channel;
  // wait this long AFTER the previous step completes before this step is due
  delay: { value: number; unit: "minutes" | "hours" | "days" };
  template: string;            // call script / sms body / gift note; supports {{vars}} (§4)
  giftKind?: GiftKind;         // required when channel === "gift"
  giftBudgetCents?: number;    // per-gift cap; defaults to SEQ_GIFT_MAX_CENTS
}
```

The seeded **Dan core motion** (`pipeline/sequence/seed.ts`):
```ts
[
  { channel: "call", delay: { value: 0, unit: "minutes" },
    template: "Hey, this is Dan with Pam. I work with {{oem}} stores like {{name}} in {{city}}. Quick call about your sales floor — give me a ring back." },
  { channel: "sms",  delay: { value: 1, unit: "days" },
    template: "Hi {{contactFirst}}, Dan here — left you a voicemail earlier about {{name}}. Worth a 10-min chat this week?" },
  { channel: "gift", delay: { value: 2, unit: "days" }, giftKind: "doughnuts",
    template: "Coffee & doughnuts on us for the {{name}} team — Dan @ Pam." },
]
```

## 4. Variable rendering — `pipeline/sequence/render.ts`

`render(template, dealership, contact)` substitutes `{{...}}` from the `DealershipRow` and the
first `Contact` in `contacts` json:
- `{{name}}`, `{{oem}}`, `{{city}}`, `{{stateProvince}}`, `{{groupName}}`
- `{{contactFirst}}` (first token of `contact.name`, fallback "there")
- Unknown vars render empty; never throw.

## 5. Channel adapters — `pipeline/sequence/channels/`

Common interface (`channels/types.ts`):
```ts
export interface ChannelContext {
  dealership: DealershipRow;
  contact?: Contact;            // first contact, may be undefined
  rendered: string;            // template after render()
  step: Step;
  enrollmentId: number;
  stepIndex: number;
  dryRun: boolean;             // true unless SEQUENCE_APPLY=1
}
export interface ChannelResult {
  state: "sent" | "failed" | "skipped";
  provider: string;
  externalRef?: string;
  costCents?: number;
  result?: unknown;
  error?: string;
}
export interface Channel { kind: Channel; send(ctx: ChannelContext): Promise<ChannelResult>; }
```

Adapters (each has a real impl + a `simulated.ts`, resolved by env, default simulated):
- `channels/call/voice.ts` — reads `VOICE_PROVIDER` (`twilio`|`vapi`|`bland`) + that provider's
  creds; places call to `dealership.phone` with the rendered script. Needs a valid `phone_valid` number.
- `channels/sms/sms.ts` — `twilio` SMS to `dealership.phone` (or `contact.phone`).
- `channels/gift/food-delivery.ts` — `GIFT_PROVIDER` (`doordash`|`ubereats`); sends a gift/order to
  `address_street, city, state_province, postal_code`; returns `cost_cents`.
- `channels/index.ts` — registry: `resolveChannel(kind, env)` returns the real provider when its
  creds are present **and** `SEQUENCE_APPLY=1`, else the simulated adapter. Same shape as `pipeline/sources/index.ts`.

**Simulated adapter behavior:** logs what it *would* send, returns `state:"sent"`, `provider:"simulated"`,
a fake `external_ref`, and (for gift) the catalog `cost_cents` without charging. This is what makes the
whole engine runnable on the free tier and demo-able without keys.

## 6. The tick scheduler — `pipeline/sequence/tick.ts` (command `sequence:tick`)

Idempotent, resumable, cron-friendly (same ethos as the pipeline steps). One pass:

```
if env SEQUENCE_ENABLED == "0": return            # global kill switch
now = ISO now
due = enrollments WHERE state='active' AND next_run_at <= now   (cap SEQ_MAX_PER_TICK)
for e in due:
  crm = getCrm(e.dealership_id)
  if crm.status in {engaged, won, lost}: exitEnrollment(e, reason=crm.status); continue   # exit guard
  seq = getSequence(e.sequence_id); steps = seq.steps
  if e.current_step >= steps.length: completeEnrollment(e); continue
  step = steps[e.current_step]
  run = stepRun(e.id, e.current_step)
  if run?.state == 'sent': advance(e, step); continue                 # idempotency
  if violatesQuietHours(step, dealership):                            # calls/sms only, local tz≈state
      e.next_run_at = nextAllowedWindow(); continue
  if step.channel == 'gift' and overGiftBudget(step):
      recordRun(skipped, reason='budget'); logActivity(gift, "Gift skipped: budget cap"); advance(e, step); continue
  ch  = resolveChannel(step.channel, env)
  ctx = buildContext(e, step, dealership, contact, dryRun = env.SEQUENCE_APPLY != '1')
  res = await ch.send(ctx)
  recordRun(e.id, e.current_step, res)
  logActivity(e.dealership_id, kindFor(step.channel), summarize(step, res), "Dan")
  if res.state == 'sent':
      if crm.status == 'new': setStatus(e.dealership_id, 'working')   # first touch moves new→working
      advance(e, step)                                                # current_step++, next_run_at = now + nextStep.delay (or complete)
  else:
      e.attempts++; if attempts >= SEQ_MAX_ATTEMPTS: recordRun(failed); advance(e, step)
      else e.next_run_at = now + backoff(attempts)                    # retry later
```

`advance(e, step)`: increment `current_step`; if a next step exists set `next_run_at = completionTime + nextStep.delay`, else mark `completed` + log `sequence` activity.

### Safety rails (apply even when fully autonomous)
- `SEQUENCE_APPLY` (default unset = **dry-run**; `1` to really send/charge).
- `SEQUENCE_ENABLED` (`0` = kill switch, tick no-ops).
- `SEQ_QUIET_START` / `SEQ_QUIET_END` (local hours, default 9–18) — gate call + sms; gift exempt.
- `SEQ_GIFT_MAX_CENTS` (per-gift cap) + `SEQ_GIFT_BUDGET_CENTS` (running total across all `sent` gift runs; over → skip + alert).
- `SEQ_MAX_PER_TICK` — bound dispatches per pass.
- `SEQ_MAX_ATTEMPTS` (default 3) + exponential backoff on failed sends.

### Exit / branch
Fully autonomous still needs stop conditions so Dan doesn't keep touching a live deal:
- CRM status → `engaged`/`won`/`lost` (set by a human, or by reply detection) exits the enrollment next tick.
- **Reply detection (optional v1 hook):** an inbound SMS/voice webhook handler calls
  `logActivity(id,'sms',body)` + `setStatus(id,'engaged')`; the next tick's exit guard then stops the motion.

## 7. Server CRUD — `lib/sequence.ts` (server-only, mirrors `lib/crm.ts`)
`listSequences()`, `getSequence(id)`, `getEnrollment(dealershipId)`, `enroll(dealershipId, sequenceId)`,
`pauseEnrollment(id)`, `exitEnrollment(id, reason)`, `getStepRuns(enrollmentId)`. Tick logic stays in
`pipeline/` (tsx/node); shared types stay in `lib/sequence-constants.ts` so client components can import them.

## 8. Commands — `package.json` + `pipeline/run.ts`
Append scripts and register subcommands (additive `case` in run.ts's dispatch):
| script | does |
| --- | --- |
| `sequence:seed` | insert the Dan core motion |
| `sequence:enroll` | enroll rooftops — by id, by `--name "Honda of Dublin"`, or by filter (e.g. tier A + status new) |
| `sequence:tick` | advance all due enrollments (the cron target) |
| `sequence:status` | print enrollments + next actions + recent runs |
| `sequence:simulate <id>` | fast-forward one enrollment through all steps in dry mode (demo) |

Cron (real run): `*/5 * * * *  cd …/dealership-sor && SEQUENCE_APPLY=1 npm run sequence:tick`

## 9. Dashboard surface (Phase 2 — wire if time allows)
- **Rooftop detail:** a `components/sequence-card.tsx` showing enrollment state, current step,
  next-action time, and the step timeline from `sequence_step_runs` + `activity`.
- **`app/sequences/page.tsx`:** list sequences, enrolled counts, recent sends.
- **`app/actions.ts`:** server actions `enrollInSequence(id)`, `pauseEnrollment(id)`, `exitEnrollment(id)`.

## 10. `.env.example` additions
```
# --- Master sequence ---
SEQUENCE_APPLY=          # unset = dry-run (default). 1 = really place calls / send texts / order gifts.
SEQUENCE_ENABLED=1       # 0 = kill switch
SEQ_QUIET_START=9
SEQ_QUIET_END=18
SEQ_GIFT_MAX_CENTS=4000        # per gift
SEQ_GIFT_BUDGET_CENTS=50000    # total across the program
SEQ_MAX_PER_TICK=50
SEQ_MAX_ATTEMPTS=3
# Voice
VOICE_PROVIDER=          # twilio | vapi | bland
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM=
# (vapi/bland keys as needed)
# Gift
GIFT_PROVIDER=           # doordash | ubereats
DOORDASH_API_KEY=
```

## 11. Acceptance — the Honda of Dublin demo
```bash
npm run sequence:seed
npm run sequence:enroll -- --name "Honda of Dublin"     # finds the scraped rooftop, enrolls it
npm run sequence:simulate -- <id>                       # dry-run, fast-forward all 3 steps
```
Expect: simulated **call** placed → +1d **text** → +2d **doughnuts** ordered to the Dublin address;
the rooftop's `activity` timeline shows all three touches; `account_crm` moved `new → working`;
three `sequence_step_runs` rows, each `sent`, provider `simulated`, gift run carrying `cost_cents`.

With real creds + `SEQUENCE_APPLY=1`, `sequence:tick` on cron executes the identical motion against
Twilio + DoorDash, honoring quiet hours and the gift budget, and exits the moment the account replies/engages.

## 12. Merge strategy (why this lands clean on top of the sales tool)
Build on a branch off the finished sales-tool commit (e.g. `feat/master-sequence`). All real logic is in
**new files** (`pipeline/sequence/**`, `lib/sequence.ts`, `lib/sequence-constants.ts`, `components/sequence-card.tsx`,
`app/sequences/page.tsx`). The only touches to shared files are **append-only**:
- `lib/schema.ts` — add 3 tables (append)
- `lib/db.ts` — add 3 `CREATE TABLE IF NOT EXISTS` blocks (append inside the existing `db.exec`)
- `lib/crm-constants.ts` — extend `ACTIVITY_KINDS` (append values)
- `package.json` — add `sequence:*` scripts (append)
- `pipeline/run.ts` — add `sequence` dispatch cases (append)
- `.env.example` — append the block in §10

Because tables/columns are `IF NOT EXISTS`, an existing populated `data/dealerships.sqlite` upgrades in
place on first run with no data loss. Merge after the sales tool is done; conflicts, if any, are additive list edits.
