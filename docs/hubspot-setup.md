# HubSpot integration — setup (READ-ONLY pull)

Dan **pulls** Pam's HubSpot data in and never writes to it. For each rooftop that
matches a HubSpot company, Dan shows the **lifecycle stage, owner, last activity, and
the real CRM contacts** — so reps don't re-prospect accounts Pam is already working.

> Writing back to HubSpot is disabled by default. Dan only reads.

## 1. Create a Private App token (read-only scopes)

In HubSpot: **Settings → Integrations → Private Apps → Create a private app**.

Grant **read** scopes only:

- `crm.objects.companies.read`
- `crm.objects.contacts.read`
- `crm.objects.owners.read`

Copy the **access token**.

## 2. Configure

Copy `.env.example` to `.env`:

```bash
HUBSPOT_TOKEN=pat-na1-xxxxxxxx...
```

`.env` is gitignored — the token is never committed.

## 3. Pull

```bash
npm run hubspot:pull
```

This fetches HubSpot companies, contacts, and owners; matches companies to Dan
rooftops (by domain, OEM brand, and city — so a shared group domain still resolves to
the right store); and writes the engagement summary + HubSpot contacts onto the
matched Dan accounts. Re-running refreshes (idempotent). It reads HubSpot and writes
**only to Dan's local database**.

## Where it shows up

- **Overview** — an "In HubSpot" KPI (how much of the book overlaps Pam's CRM).
- **Account page** — an "In HubSpot" badge + a panel with lifecycle / owner / last
  activity, and the real HubSpot contacts merged into the Contacts list (source `hubspot`).
- **Call list** — an "In HubSpot" badge so reps can skip or prioritize accordingly.

## Matching notes

Matching is best-effort (domain + OEM + city scoring). Unmatched HubSpot contacts are
counted and reported. If match quality needs tuning once you see real data, the scorer
lives in `matchCompany()` in `pipeline/integrations/hubspot.ts`.

## (Optional) writing back

Disabled by design. If you ever want Dan → HubSpot push, set `HUBSPOT_ALLOW_WRITE=1`
and use `hubspot:push` — but the default, intended mode is read-only pull.
