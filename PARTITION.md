# Parallel OEM crawl — shell partition plan

You are one of 3 parallel shells cracking OEM dealer-locator APIs to manufacturer-confirm
CA/TX/FL dealers. Each shell works in its own git worktree with its own DB copy, so we
never fight over SQLite. A merge step folds everyone's results back at the end.

## Your assignment (by worktree)
| Worktree | Shell | Brands to crack |
|---|---|---|
| `dan-shell-1` | 1 | **Lexus, Acura, Genesis, Lincoln** (luxury/family) |
| `dan-shell-2` | 2 | **Volkswagen, Audi, Porsche** (VW Group) |
| `dan-shell-3` | 3 | **BMW, Mercedes-Benz, Volvo, Mitsubishi, Jaguar, Land Rover** |

## The proven recipe (per brand)
1. **Recon the endpoint.** Open the brand's dealer locator in the browser (Playwright MCP),
   capture network requests filtered for `dealer`, find the JSON endpoint it calls. Some
   auto-fire on load (easy); some need a zip typed first (ZipGate); some are SPA-locked.
2. **If it's a clean JSON endpoint:** clone the closest existing crawler in
   `pipeline/sources/oem/crawl-*.mjs` (Subaru/Hyundai/Mazda are good zip-based templates;
   Toyota is lat/lng; Ford is token-gated) and patch: the `goto` URL, the fetch endpoint +
   parse, the field mapping (name/code/address/phone/lat-lng/website), and the `oem=` brand.
3. **Run it:** `node pipeline/sources/oem/crawl-<brand>.mjs` — it writes to THIS worktree's DB.
4. **QA it:** sample the new Platinum rows (real franchises? valid codes?), check 0 dup codes.

## The rule: never fake clean
If a brand is **SPA-locked** (no clean endpoint, results in iframes/shadow DOM, obscured
request format) — like GM, Nissan, Stellantis, Kia — **do NOT hack it.** Leave it Gold
(website-confirmed) and note it as "resisted — stays Gold" in your final report. Honest
Gold beats a faked Platinum. Try each brand once, seriously; if it resists, move on.

## Browser + env notes
- Chromium (full, for stricter Akamai) + stealth flag is already wired in the crawler
  templates. Headless-shell works for lenient sites; full Chromium for strict ones.
- The crawlers only touch their own brand's rows (match by geo/phone, insert net-new in
  CA/TX/FL only). So parallel shells never collide.

## When done
Report: which brands you cracked (→ Platinum + count) and which resisted (→ stay Gold).
The main shell runs `node merge-oem.mjs` to fold all worktree DBs into the canonical one.

## Results log
- **Shell 2 (VW Group) — done in main checkout, already in canonical:**
  - **Volkswagen → CRACKED.** BFF `v3-81-9.ds-us.dcc.feature-app.io/bff-search/dealers`
    returns ALL ~626 US dealers in ONE call (wildcard `name:" "`); `id`=dealer code,
    `coordinates:[lat,lng]`, `contact.phoneNumber/website`. → **142 CA/TX/FL Platinum**
    (CA 53 / TX 45 / FL 44), 0 dup codes, 0 missing phones. Crawler: `crawl-vw.mjs`.
  - **Audi → RESISTS, stays Gold.** `env-config.one.audi/.../dealer-search.json` is 403-gated;
    data only fires on interactive typeahead-select with signed request. SPA-locked.
  - **Porsche → RESISTS, stays Gold.** Shadow-DOM web-component app; state list renders
    nothing extractable; no inline dataset, no clean endpoint. SPA-locked.
