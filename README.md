# Dan, Pam's sales guy — Phase 1 (data pipeline)

Dan is Pam's AI sales rep for the car-dealership market. This repo builds **Dan's book
of business**: a North American **franchise** (OEM-affiliated) dealership system of
record. Phase 1 is the data pipeline only; the Next.js + shadcn dashboard where Dan
works his accounts arrives in Phase 2 and reads the SQLite database this pipeline produces.

The pipeline builds a validated master dataset of franchise dealerships across the US
and Canada (Mexico behind a flag), sourced from **OpenStreetMap** and **OEM dealer
locators**, then dedupes, validates, tiers, stores to SQLite, and exports a
HubSpot/Clay-ready CSV. Used-car lots and independents are excluded (a record is only
kept if it carries a recognized franchise OEM brand).

> **Free tier only.** No paid APIs (no ZoomInfo / Apollo / Google billing). The two
> data sources — OSM Overpass and public OEM locator JSON — are free.

## Stack

- Next.js (App Router) + TypeScript — `app/` is a Phase-2 placeholder today
- Drizzle ORM + better-sqlite3 — db at `data/dealerships.sqlite`
- tsx — runs the pipeline scripts
- libphonenumber-js — phone validation
- zod — record validation

## Quick start

```bash
npm install
npm run pipeline:all
```

This produces `data/dealerships.sqlite`, `data/dealerships.csv`, and prints a QA
summary. Raw API responses are cached under `data/cache/` so re-runs are cheap.

## Commands

Each step is idempotent and resumable, and can be run on its own:

| Command | What it does |
| --- | --- |
| `npm run pipeline:ingest` | Fetch raw records from every enabled source → `data/raw/*.jsonl` |
| `npm run pipeline:normalize` | Map raw → master schema, standardize address, derive domain/territory, collapse exact-key dupes → SQLite |
| `npm run pipeline:dedupe` | Merge duplicate rooftops (key = OEM + normalized address, fallback domain), preferring OEM-sourced fields |
| `npm run pipeline:validate` | `website_valid` (GET + 2xx + dealer-domain sanity), `phone_valid` (libphonenumber), `brand_confirmed` (OEM source) |
| `npm run pipeline:enrich` | Free website-scrape enricher: pull contact emails from each dealer&rsquo;s own site into `contacts` (cap via `ENRICH_MAX_SITES`) |
| `npm run pipeline:tier` | Tier A (known group or group_size > 1) vs Tier B |
| `npm run pipeline:export` | Write `data/dealerships.csv` with HubSpot/Clay column names |
| `npm run pipeline:report` | Print the QA summary |
| `npm run pipeline:all` | Run the whole thing end-to-end |

## Sources

Adapters implement a common `Source` interface (`pipeline/sources/types.ts`) and are
registered in `pipeline/sources/index.ts`.

- **OSM Overpass (`osm`)** — the backbone. Queries `shop=car` + a `brand` tag per
  US state / CA province bounding box (avoids Overpass timeouts), with polite rate
  limiting, retries across multiple Overpass mirrors, and on-disk caching of raw
  responses. Only recognized franchise OEM brands are kept.
- **OEM locators** — `oem:toyota`, `oem:honda`, `oem:ford` are fully wired against
  each brand's public dealer-locator JSON, queried by lat/lng + radius over a coarse
  grid of US/CA centroids. Records from OEM sources set `brand_confirmed = true`. The
  remaining OEMs are registered as **stubs** (catalogue-only) so new adapters are a
  drop-in: replace the stub with `createOemSource({...})`.

### Note on OEM locators and bot protection

OEM dealer locators (Toyota/Honda/Ford and most others) sit behind CDN bot protection
(e.g. Akamai) that rejects automated clients by IP/fingerprint. From a blocked network
every request is refused and the adapter degrades gracefully to zero records — it logs
a clear `NOTE:` line — while the **OSM backbone carries the dataset**. The adapter code
is correct and populates when run from a non-blocked network (residential IP/proxy, or
a browser-based fetch transport). Nothing is fabricated.

## Configuration (env vars)

| Var | Default | Purpose |
| --- | --- | --- |
| `ENABLE_MEXICO` | `0` | Include Mexico regions |
| `ENABLED_SOURCES` | all | Comma list of source names/OEMs to run (e.g. `osm,oem:toyota`) |
| `OSM_REGIONS` | all | Restrict OSM to state/province codes (e.g. `CA,TX,NY`) |
| `OEM_REGIONS` | all | Restrict OEM grid to region codes |
| `OEM_GRID_STEP_DEG` | `1.0` | Grid spacing in degrees for OEM locator queries |
| `OEM_MAX_POINTS` | `0` | Cap OEM grid points per source (0 = no cap) |
| `VALIDATE_MAX_WEBSITES` | `0` | Cap website probes per run (0 = all) |
| `VALIDATE_CONCURRENCY` | `8` | Parallel website checks |
| `HTTP_MIN_DELAY_MS` | `800` | Per-host politeness delay |
| `OVERPASS_ENDPOINTS` | 3 mirrors | Comma list of Overpass endpoints |

Examples:

```bash
# Fast smoke test: a few states, no website probing
OSM_REGIONS=RI,DE,DC VALIDATE_MAX_WEBSITES=0 npm run pipeline:all

# Full US+CA backbone
npm run pipeline:all

# Only OSM, skip OEM adapters
ENABLED_SOURCES=osm npm run pipeline:all
```

## Schema (`dealerships`)

`id, name, oem, group_name, group_size, website, domain, address_street, city,
state_province, postal_code, country, territory, phone, email, tools_used (json),
contacts (json), tier, source, website_valid, phone_valid, brand_confirmed, dedup_key,
created_at, updated_at` — defined in `lib/schema.ts`.

## Dashboard (Phase 2) & CRM (Phase 3)

`npm run dev` serves Dan&rsquo;s dashboard (Next.js + Tailwind, Pam-complementary brand,
light/dark): an **Overview** (KPIs, charts, pipeline funnel), **Accounts** (filter / sort /
paginate / CSV export over the SQLite db), a **Pipeline** kanban board, and a **rooftop
detail** page with a map, validation, and a working CRM (status, owner, next step, notes,
activity timeline). CRM state lives in the `account_crm` and `activity` tables.

## Enrichment

`pipeline/enrich/types.ts` defines an `Enricher` interface. Phase 3 ships a **free**
website-scrape enricher (`pipeline/enrich/website.ts`) that pulls contact emails from each
dealer&rsquo;s own site — no paid APIs. Paid providers (Clay/Apollo/ZoomInfo) can be added to
`ENABLED_ENRICHERS` later without touching the rest of the pipeline.

## Layout

```
app/                     Next.js App Router (Phase-2 placeholder)
lib/
  db.ts, schema.ts       Drizzle table + SQLite bootstrap
  types.ts               shared domain types
  geo/                   region bounding boxes, grid, territory map
pipeline/
  config.ts              env-driven configuration
  run.ts                 orchestrator + CLI
  lib/                   http (cache/retry/rate-limit), disk cache, raw store
  sources/               osm.ts + oem/ adapters + registry
  steps/                 normalize, dedupe, validate, tier, persist, export, report
  enrich/                Enricher interface (no paid impl)
data/                    sqlite db, cached raw responses, csv export
```
