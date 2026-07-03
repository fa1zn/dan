# What changed, week of July 2, 2026

Three things landed this week. Two were bugs found by actually using the app. One was a
copy cleanup. Nothing else was touched, on purpose.

- **Bug 1**: Book filter dropdowns were showing junk and were unusable at a glance.
- **Bug 2 (blocker)**: on a phone, provenance never showed up. You could not see where a
  value came from.
- **Copy cleanup**: removed em-dashes from every rep-facing string. Kept them out of the
  generated talk tracks too.

Branch: `feat/master-sequence`. Commits: `bd36abd` (the two bugs), plus a follow-up commit
for the copy cleanup and this doc.

---

## Bug 1: the Book filter dropdowns

### What was wrong

Open Book, open the State filter, and you got the raw column dumped out: every state code
in the table, including ones with zero rooftops in your territory, in no useful order, with
no counts. You could not tell "does California have 3 dealers or 3,000" without applying the
filter and reading the result. A filter you have to guess at is not a filter.

### What it does now

Every dropdown (OEM, Country, State, Territory, Tier) now:

- shows only values that actually have rooftops (nothing with a count of zero),
- is sorted A to Z, and
- shows the count in parentheses, like `California (1,847)`.

So the State dropdown reads `AB (664)`, `AK (46)`, `AL (506)`, ... `CA (2,345)`, and the
codes with nothing behind them are simply gone.

### How it works

One query pattern, used for every column, memoized once per process so it does not re-run
on every page load:

```sql
SELECT col, COUNT(*) AS count
FROM dealerships
WHERE col IS NOT NULL AND col <> ''
GROUP BY col
HAVING COUNT(*) > 0
ORDER BY col ASC
```

Files:

- `lib/queries.ts` — `getFilterOptions()` now returns `CountedOption[]` (`{ value, count }`)
  per column instead of a bare string list, built from the query above and cached in a
  module-level variable.
- `components/account-filters.tsx` — each control renders `value (count)`. OEM checkboxes
  show the count as a muted suffix; the Country / State / Territory / Tier selects map each
  option to a `value (count)` label.

While normalizing states, junk codes got cleaned up in the same pass (68 distinct values
down to 64 real ones, e.g. an Australian rooftop that had been mislabeled with a US country
code got its bogus state cleared instead of being force-mapped to a Canadian province).

---

## Bug 2: provenance did not show on a phone (the blocker)

### The diagnosis

The debug order was: (a) mobile has no hover, (b) are the fields even wrapped, (c) does the
provenance data exist, (d) is the component or its CSS broken. Walking it:

- (b) The fields **were** wrapped. Address, phone, contact, coordinates, everything on the
  record page is a `Provenance` element with a real source attached.
- (c) The data **did** exist. On desktop, hovering the address showed
  `Source: OpenStreetMap / dealer record, as of Jun 30, 2026, Google confirms: ...`.
- (d) The component was **not** broken. Desktop hover worked the whole time.

So the answer was **(a)**. Touch devices have no hover event. There was simply no gesture
that would summon the source on a phone, which is the device a rep is actually holding in a
dealership parking lot. Desktop was fine and hid the problem.

### The fix

`components/provenance.tsx` became a controlled tooltip that opens on **tap** as well as
hover:

- Desktop: hover, same as before.
- Phone: tap the underlined value and the source appears.
- If the value is also a link (a `tel:` number), the first tap reveals the source and blocks
  the dial, so the rep always sees provenance before anything happens. A second tap follows
  the link.

The trigger is a `role="button"`, keyboard focusable, with an `aria-label` of the source, so
it works with a keyboard and a screen reader too.

### One nuance worth knowing

On a real phone (touch events) tap-to-reveal works. A **mouse** click on desktop will not
pop it, because Radix dismisses tooltips on mouse-down by design (mouse users already get
hover). So the rule is: desktop uses hover, phone uses tap. Both are covered. They just use
the gesture that fits the device, which is correct behavior, not a gap. This is only worth
flagging so that clicking a value with a mouse and seeing nothing does not read as a
regression.

---

## Copy cleanup: em-dashes are gone from rep-facing text

### Why

House style is plain, human copy with no em-dashes. The depth belongs in the layout, not in
punctuation. An em-dash had crept into the generated Opener line and into a lot of other
strings.

### What changed

Every em-dash that renders to a user was rewritten into a plain sentence, a comma, a colon,
or parentheses, whichever read best in context. This covered the copy generators (so the
text Dan writes on the fly is clean, not just the static labels):

- `lib/pamfit.ts` — the Opener / talk track. It now reads as two clean sentences.
- `lib/intel.ts` — the "why call them" reasons.
- `lib/tech-fingerprints.ts` — the Pam-fit angles.
- `lib/explain.ts`, `lib/integrations.ts`, `lib/connections.ts`, `lib/sequence-ui.ts`,
  `lib/sequence-constants.ts`, `lib/hubspot.ts` — blurbs, status lines, call and text
  templates, connection messages.
- `app/actions.ts`, `app/accounts/[id]/page.tsx`, `app/sequences/page.tsx`,
  `app/worklist/page.tsx` — logged-activity text and record-page copy.
- `components/log-touch.tsx`, `components/connections-client.tsx`,
  `components/integration-card.tsx`, `components/sequence-card.tsx` — placeholders and labels.

Before and after, the Opener:

- Before: `Runs ActivEngage for chat/text — a Pam displacement target — ask for Shelley ...`
- After: `Runs ActivEngage for chat/text, a Pam displacement target. Ask for Shelley ...`

### What was deliberately left alone

- The empty-value glyph. A field with no value still shows a single `—`. That is the
  "blank beats wrong" placeholder, a UI convention, not a sentence.
- Code comments. Em-dashes inside `//` and `/** */` are not copy and were left as-is to keep
  the diff scoped to what a rep actually sees.

A grep for em-dashes in string literals now returns only those two categories, nothing that
renders as a sentence.

---

## Proof

Playwright's tooling produces stills, not video, so the "recording" is a set of frames in
`~/Desktop/dan-proof-2026-07-02/`:

| File | Shows |
|---|---|
| `desktop-state-dropdown.jpeg` | State filter sorted, counted, zero-count states gone |
| `desktop-address-hover.jpeg` | Hover address, source tooltip appears |
| `desktop-contact-hover.jpeg` | Hover the champion contact, `Source: HubSpot` |
| `mobile-state-filter.jpeg` | Same clean State filter at phone width |
| `mobile-address-tap.jpeg` | Tap address on a phone, source appears |
| `mobile-contact-tap.jpeg` | Tap contact on a phone, `Source: HubSpot` |

Phone-number provenance was verified the same way (identity phone shows
`Source: On file, OpenStreetMap / OEM record`; the Google strip phone shows
`Source: Google Places`).

---

## Scope discipline

Explicitly not done this week: no new features, no group resolver changes, no ZoomInfo gate,
no Dan-generated chips. Two bugs and one copy pass, then stop.
