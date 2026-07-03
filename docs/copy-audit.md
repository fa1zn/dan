# Copy audit — hide the machinery

One pass over every rep-facing string, held to three tests:

1. **Would a rep say this out loud to another rep?** If not, rewrite in their words.
2. **Does this label a number the rep needs, or is it decoration?** Numbers get labels.
3. **Would it embarrass you read back in a frustrated rider-drive voice?** Rewrite until no.

Then the harder passes: rip out anywhere the app makes the rep **prove they belong** (blank
empty states, dev-only errors, useless spinners), and anywhere the app is **proud of itself**
(AI/smart/score badges, tracking chips). Text only — no logic changed. Ships as one PR.

## Verified before → after (screenshots)

- **Prospect** and **Account detail** captured before + after (see PR). **Today** before is from the
  prior task's screenshots.
- Book (accounts list) and Territory inherit the status-bar and status-label changes below; no
  screen-specific copy needed rewriting on those two beyond the shared vocabulary.

## The changes

### Status bar (every screen) — `components/app-shell.tsx`
| before | after | pass |
|---|---|---|
| `Live` / `Dry run` | `Calling for real` / `Practice mode` | 1 (dev jargon) |
| `Autopilot on` / `Autopilot off` | `Pam's working` / `Pam's paused` | 3 (tracking/pride) |
| `calls: click-to-call` | `You tap to call` | 1 (jargon) |

### Shared status vocabulary — `lib/crm-constants.ts`
| before | after | pass |
|---|---|---|
| status `Engaged` | `Replied` | 1 (no rep says "engaged"; "Replied" is what happened) |

Cascades everywhere the status shows (Book, pipeline, account header, deal panel).

### Prospect — `app/sequences/page.tsx`, `components/segment-launcher.tsx`
| before | after | pass |
|---|---|---|
| `Launch a segment` | `Put Pam on a market` | 1 (jargon) |
| `In outreach` (metric) | `Pam's working` | 1 |
| `Stalled` (metric) | `Gone quiet` | 1 |
| `Motion completed` | `Done — no reply, cooling off` | 1 (machinery) |
| `Exited — {reason}` | `Stopped` | 1 |
| `Next: edible · {date}` | `Next: treat · {date}` | 1 (dev jargon "edible") |
| empty: `No dealers in outreach yet…` | `No dealers in play yet…` | 1 |
| toast: `Launching outreach — Pam's on it.` | `Pam's starting on these — she'll call them.` | 1 |
| footer: `Paced 2 minutes apart (never a blast). Each dealer gets Pam's disclosed inquiry first; sales follow-ups wait for consent.` | `Pam calls one every couple of minutes, never all at once. She says she's an AI and never sells on the first call.` | 1 |

### Account motion card — `components/sequence-card.tsx`
| before | after | pass |
|---|---|---|
| `Outreach` (card title, ×2) | `Pam's plan` | 1 |
| `Edible` (channel label) / `Send gift` | `Treat` / `Send a treat` | 1 |
| `Step 2 of 4` + `3 sent` | `3 of 4 touches done` | 1 + 2 (label the number) |
| `Stage {engaged}` (raw status) | `This dealer {Replied}` (plain label) | 1 |
| `Outreach {in progress}` | `Pam's plan {in progress}` | 1 |
| `Outreach done` | `Done — no reply yet` | 1 |
| `Compliance-first: Pam opens with a disclosed, no-sell inquiry. Text & gift are held until consent.` | `Pam always says she's an AI and never sells on the first call. Texts and treats wait until they're interested.` | 1 |
| toast: `Outreach stopped.` | `Stopped.` | 1 |

### Account detail — `app/accounts/[id]/page.tsx`
| before | after | pass |
|---|---|---|
| `Sales intel` | `Who to call & why` | 1 |
| `Pam-fit Cool · 35/100` badge + `Medium confidence` badge | `Cool fit` (score + confidence badges removed) | 3 (self-congratulating score) |
| `· inferred by Dan` | `· estimated` | 3 (app showing off) |
| `Detected · with evidence` | `Spotted on their site` | 1 |
| empty: `No enriched contacts yet. Run` `npm run pipeline:enrich` `to pull contacts…` | `No names yet — call the main line and ask who runs the sales floor.` | harder pass 1 (dev leak → useful next step) |
| empty: `No standout trigger scraped yet — enrich this rooftop for tech/hours/reviews signals.` | `Nothing jumping out yet — call and find out what they're working with.` | harder pass 1 |

## What already passed (kept as-is)
- **Goal card** (`Your month`): every number labeled (`deals closed`, `in pipeline`, `open/booked/closed`). Model example.
- **Nav** (`Today / Prospect / Territory / Book / Setup`): rep verbs, not CRM lenses.
- **Territory empty states**: `You've reached everyone in this area.` — tells them what it means.
- **CRM panel empty**: `No activity yet. Set a status or log a note to get started.` — actionable.

## Deferred (flagged, not silently skipped)
- The account-detail page is still **dense** (many cards). That's a layout problem, not a words
  problem, and it's the separate "collapse into More details" work — out of scope for a text-only PR.
- `Tier A/B`, `gold · 2 sources`, HubSpot `Lifecycle` — provenance/trust vocabulary. Borderline, but
  they label real data-quality signals and some are literally third-party (HubSpot) terms. Left for a
  follow-up once the ride-along shows whether reps read them at all.

## How to review
Text-only diff, no logic touched, typecheck clean. Ship as one PR, then ride-along a week later and
watch whether the words land — especially whether a rep ever says "what's a segment / an enrollment"
out loud. If they don't, the pass worked.
