# OEM dealer-locator pull — runbook (for the data shell)

The Bright Data **Web Unlocker** defeats the Akamai bot-wall on the OEM dealer locators.
Verified live (2026-07-01): Ford (1.0 MB), Chevrolet/GM (590 KB), Hyundai (7.6 MB) all
returned real dealer-locator content through the unlocker. This is the 15K → ~24K unlock.

## Credentials
- Zone: `web_unlocker1` (Web Unlocker, Active)
- Token: put in `.env` as `BRIGHTDATA_TOKEN=a529c5f4-...` (do NOT commit)
- Rate limit: 1000 req/min · cost $1.50 / 1,000 requests

## Two ways to route the OEM adapters through it

**A. Direct API (works today with just the token — no proxy creds needed):**
```
curl https://api.brightdata.com/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BRIGHTDATA_TOKEN" \
  -d '{"zone":"web_unlocker1","url":"<OEM_DEALER_JSON_ENDPOINT>","format":"raw"}'
```
Returns the unlocked response body. Wrap `fetchText()` (pipeline/lib/http.ts) to POST here
when `BRIGHTDATA_TOKEN` is set, instead of a direct GET.

**B. Native proxy (plug into the existing `PROXY_URL` pipeline, no code change):**
Get host/port/username/password from the zone's **"Native proxy-based access"** tab, then:
```
PROXY_URL=http://brd-customer-<id>-zone-web_unlocker1:<zone_pass>@brd.superproxy.io:33335
```
Existing OEM adapters already honor `PROXY_URL` — this is the fastest path.

## Run
```
# point the adapters at the accessible OEMs first
ENABLED_SOURCES=oem:ford,oem:chevrolet,oem:hyundai,... npm run pipeline:ingest
npm run pipeline:normalize && npm run pipeline:dedupe   # dedupes against the current 15K
```

## Access-gated OEMs
Some domains are blocked by Bright Data's OWN compliance, not the site:
- **Toyota** returned `not available for immediate access mode ... ask your account manager`.
- Fix: request "full access" for those domains via Bright Data support/account manager (KYC).
  Run the rest in the meantime.

## Notes
- Target each brand's dealer-locator **JSON endpoint** (not the www HTML page) for structured data.
- Honda's page returned empty via the www URL — use its JSON API endpoint.
- Dedupe key stays oem + normalized address (per pipeline/steps/dedupe).
