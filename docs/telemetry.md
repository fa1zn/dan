# Ride-along telemetry

Instrumentation that turns a real rep's session into data, so a ride-along has a quantitative
half (the event stream) alongside the qualitative half (the observer's field sheet). Built to the
same standard as everything else Dan does: consent-first, ids-not-content, retention written down.

## Two gates, both required

Nothing is logged unless **both** are true:

1. **Global kill switch** — `TELEMETRY_ENABLED=1`. Defaulted off. When unset, the client attaches
   no listeners and the ingest endpoint rejects everything.
2. **Per-rep, per-device opt-in** — the rep sees a disclosure (exactly the list below, and that
   content is never logged) and taps "Turn on for my session." Declining leaves Dan working
   identically. The decision is stored server-side so ingest can enforce it and offboarding can
   wipe it. If the disclosure text changes (`NOTICE_VERSION` bump), consent is re-asked.

## What is logged (behavior, per the field-sheet categories)

`app_open` (screen) · `nav` (from/to route) · `first_tap` (ms from screen open to first
interaction) · `tap` (structural element descriptor + hesitation ms) · `type` (field **name and
character count only**) · `scroll_depth` (max % per screen) · `external_nav` (rep left to another
app/site — **scheme or host only**) · `visibility` (backgrounded/foregrounded) · `session_end`
(duration).

## What is never logged

Message content. Account content beyond an id. Phone numbers (a `tel:` tap logs `"tel"`, not the
number). Typed content (only the field name and how many characters). Location beyond what the app
already has. The server sanitizes on write against a per-type key allowlist and coerces values to
bounded scalars, so anything the client sends outside the allowlist is dropped, not stored.

## Storage, retention, access, offboarding

- **Where:** two tables in the app's existing SQLite DB (`data/dealerships.sqlite`) —
  `telemetry_optin` (one row per rep) and `telemetry_event`. No third-party analytics service; the
  data stays inside the same authenticated, licensed-data boundary as the rest of the app.
- **Retention:** 30 days (`RETENTION_DAYS`). Events older than that are deleted opportunistically on
  every write, and `npm run telemetry:purge` forces it.
- **Who can query:** anyone with server/DB access to the deployment (today, the team behind the
  shared `APP_PASSWORD`). `npm run telemetry:status` and `npm run telemetry:export <rep_id>` are the
  intended paths; there is no in-app UI that surfaces another rep's behavior.
- **Offboarding:** `npm run telemetry:wipe <rep_id>` deletes that rep's events and their opt-in row
  entirely. The rep id is generated per-device at opt-in and stored with their events, which is what
  makes a clean per-rep wipe possible.

## Turning it on for a session

```
# 1. tell the rep what's logged and why (or let the in-app disclosure do it)
# 2. set the flag in the deployment's env
TELEMETRY_ENABLED=1
# 3. rep opens Dan, reads the banner, taps "Turn on for my session"
# 4. after the ride-along
npm run telemetry:export <rep_id>   # pull their stream for analysis
npm run telemetry:purge             # or wipe when done
```

## Admin CLI

```
npm run telemetry:status              # opt-in decisions + event counts per rep
npm run telemetry:purge [days]        # enforce retention now
npm run telemetry:wipe <rep_id>       # offboard: delete a rep's data
npm run telemetry:export <rep_id>     # dump a rep's events as JSON
```
