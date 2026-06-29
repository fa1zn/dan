# HubSpot two-way sync — setup

Dan pushes its enriched book of business into HubSpot (Companies + Contacts) and
pulls pipeline-status changes back, so Dan and Pam's HubSpot stay in step.

## 1. Create a Private App token

In HubSpot: **Settings → Integrations → Private Apps → Create a private app**.

Under **Scopes**, grant:

- `crm.objects.companies.read`, `crm.objects.companies.write`
- `crm.objects.contacts.read`, `crm.objects.contacts.write`
- `crm.schemas.companies.write`, `crm.schemas.contacts.write` (to create Dan's custom properties)

Create the app and copy the **access token**.

## 2. Configure

Copy `.env.example` to `.env` and fill in:

```bash
HUBSPOT_TOKEN=pat-na1-xxxxxxxx...
HUBSPOT_APPLY=0            # 0 = dry run (safe). 1 = write to HubSpot.
HUBSPOT_REGIONS=TX,CA,FL   # scope of the first sync
HUBSPOT_ONLY_ENRICHED=1    # only rooftops with scraped contacts
APP_BASE_URL=http://localhost:3210
```

`.env` is gitignored — the token is never committed.

## 3. Dry run, then go

```bash
# 1) See exactly what would be pushed (no writes, token optional)
npm run hubspot:push

# 2) Push for real — creates Dan's custom properties, upserts Companies + Contacts,
#    associates contacts to companies, and stores the HubSpot IDs back in Dan
HUBSPOT_APPLY=1 npm run hubspot:push

# 3) Pull rep changes back: any company whose Dan Pipeline Status was changed in
#    HubSpot updates Dan's CRM (logged to the activity timeline)
HUBSPOT_APPLY=1 npm run hubspot:pull

# Both directions at once
HUBSPOT_APPLY=1 npm run hubspot:sync
```

## What gets created in HubSpot

- **Companies** (one per rooftop) with standard fields (name, domain, phone, address)
  plus custom properties: `Dan Account ID`, `Dan OEM Brand`, `Dan Tier`,
  `Dan Territory`, `Dan Pipeline Status`, `Dan Tech Stack`, `Dan Account URL`.
- **Contacts** (the decision-makers) with name, job title, phone/email, associated to
  their company. Each carries a `Dan Contact ID`.

## How dedupe / idempotency works

- Companies **with a domain** upsert by `domain` — this matches and updates companies
  already in Pam's HubSpot instead of creating duplicates.
- Companies **without a domain** upsert by the unique `Dan Account ID`.
- Contacts upsert by the stable `Dan Contact ID` (`<accountId>-<name-slug>`).

Re-running the sync therefore **updates** records rather than duplicating them.

## Two-way: who wins

- **push** writes Dan → HubSpot (Dan is the source for accounts/contacts/tech-stack).
- **pull** applies HubSpot → Dan for pipeline status only (the rep's HubSpot change is
  the source of truth and is written into Dan's CRM + activity timeline).

Start with the default scope (enriched TX/CA/FL = ~220 companies) and confirm it looks
right in HubSpot before widening `HUBSPOT_REGIONS` or setting `HUBSPOT_ONLY_ENRICHED=0`.
