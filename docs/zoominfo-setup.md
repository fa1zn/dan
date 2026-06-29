# ZoomInfo enrichment — setup (PAID, credit-safe)

ZoomInfo takes the decision-makers Dan already found **by name** and adds their
**direct dial + verified email** — the "call the GM's cell, not the front desk"
upgrade. It's the one genuinely paid-only data, so the integration is built to
protect your credits.

## 1. Get REST API keys (not the MCP connectors)

In ZoomInfo **GTM Studio → API/MCP**, use the **REST API** card → **Set up keys**.
(The Claude/ChatGPT/Codex cards are MCP connectors for chatting with ZoomInfo — not
what Dan's pipeline needs.)

## 2. Configure

Add to `.env`:

```bash
ZOOMINFO_USERNAME=you@company.com
ZOOMINFO_PASSWORD=your-api-password
# scope (defaults shown)
ZOOMINFO_REGIONS=TX,CA,FL
ZOOMINFO_MAX_ACCOUNTS=50     # hard cap per run
ZOOMINFO_MIN_FIT=0           # only spend on accounts at/above this Pam-fit score
```

`.env` is gitignored.

## 3. Dry-run the cost, then enrich

```bash
# Shows exactly how many accounts/contacts would be enriched — NO credits spent
npm run zoominfo:enrich

# Enrich for real (spends credits) — highest Pam-fit accounts first, capped
ZOOMINFO_APPLY=1 npm run zoominfo:enrich
```

## How credits are protected

- **Dry run by default** — no API call happens unless `ZOOMINFO_APPLY=1`.
- **Scoped** to `ZOOMINFO_REGIONS` and only accounts where Dan already scraped a
  named contact (so we enrich people we know, not blind).
- **Ranked** by Pam-fit score — credits hit your hottest accounts first.
- **Capped** at `ZOOMINFO_MAX_ACCOUNTS` per run, with an optional `ZOOMINFO_MIN_FIT`
  floor.

## What it adds

For each enriched person, a contact with `source: "zoominfo"` carrying their
**direct/mobile phone** and **verified email**. These show on the account page and
raise the rooftop's Pam-fit score (better reachability), so they bubble up the call list.

> Note: the enrich request shape targets ZoomInfo's documented Contact Enrich API; if
> their API version differs, errors are logged verbatim so the mapping is a quick fix.
