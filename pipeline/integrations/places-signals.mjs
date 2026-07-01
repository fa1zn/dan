/*
 * PLACES SIGNALS — enrich CA/TX/FL confirmed rooftops with Google rating + review count
 * + hours (the "why now" fuel for openers). New Places API: one searchText call returns
 * place_id + rating + userRatingCount + hours. GEO-MATCH GUARD: a searchText result is
 * only accepted if it sits within ~2km of the dealer's known lat/lng — so we never staple
 * the wrong dealer's reviews on. Rows with a place_id shortcut straight to Place Details.
 * Idempotent (skips rows that already have a rating). Reads GOOGLE_PLACES_API_KEY from .env.
 *
 *   node pipeline/integrations/places-signals.mjs            # CA/TX/FL, all missing
 *   PLACES_CAP=200 node pipeline/integrations/places-signals.mjs   # cap the run
 */
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";

const env = {};
for (const l of readFileSync(new URL("../../.env", import.meta.url), "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const KEY = env.GOOGLE_PLACES_API_KEY;
if (!KEY) { console.error("GOOGLE_PLACES_API_KEY missing"); process.exit(1); }

const DB = new URL("../../data/dealerships.sqlite", import.meta.url).pathname;
const db = new Database(DB);
const CAP = Number(process.env.PLACES_CAP) || Infinity;
const CONC = 5;
const near = (a, b, d = 0.02) => a != null && b != null && Math.abs(a - b) < d;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retry on throttle (429) / transient 5xx — a failed call must not read as "no rating".
async function req(url, opts, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, opts);
      if (r.ok) return await r.json();
      if (r.status === 429 || r.status >= 500) { await sleep(600 * (i + 1)); continue; }
      return null; // genuine 4xx (bad request / not found) — don't retry
    } catch { await sleep(600 * (i + 1)); }
  }
  return "_err"; // exhausted retries — signal transient failure, not a real no-match
}

async function detailsByPlaceId(placeId) {
  return req(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": "id,rating,userRatingCount,regularOpeningHours,location" },
  });
}
async function searchText(name, city, state, lat, lng) {
  const j = await req("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount,places.regularOpeningHours,places.location" },
    body: JSON.stringify({
      textQuery: `${name} ${city || ""} ${state}`.trim(),
      ...(lat != null ? { locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 3000 } } } : {}),
      maxResultCount: 3,
    }),
  });
  if (!j || j === "_err") return j;
  const cands = j.places || [];
  return cands.find((p) => near(p.location?.latitude, lat) && near(p.location?.longitude, lng)) || (lat == null ? cands[0] : null);
}

const rows = db.prepare(
  `SELECT id, name, city, state_province, latitude, longitude, place_id, enrichment FROM dealerships
   WHERE brand_confirmed=1 AND state_province IN ('CA','TX','FL')
     AND (enrichment IS NULL OR enrichment NOT LIKE '%googleRating%')`
).all();
const todo = rows.slice(0, CAP === Infinity ? rows.length : CAP);
console.log(`\n▶ PLACES SIGNALS — enriching ${todo.length} CA/TX/FL rooftops (of ${rows.length} missing a rating)`);

const upd = db.prepare("UPDATE dealerships SET enrichment=@enr, place_id=COALESCE(place_id,@pid), updated_at=CURRENT_TIMESTAMP WHERE id=@id");
let rated = 0, hours = 0, nomatch = 0, errs = 0, calls = 0, done = 0;

async function work(r) {
  let place = null;
  if (r.place_id) { place = await detailsByPlaceId(r.place_id); calls++; }
  if (place === "_err" || !place || place.rating == null) { place = await searchText(r.name, r.city, r.state_province, r.latitude, r.longitude); calls++; }
  if (place === "_err") { errs++; }
  else if (place && place.rating != null) {
    let enr = {}; try { enr = JSON.parse(r.enrichment ?? "{}"); } catch {}
    enr.googleRating = place.rating;
    enr.reviewCount = place.userRatingCount ?? null;
    const wd = place.regularOpeningHours?.weekdayDescriptions;
    if (wd) { enr.hours = wd; enr.closedSunday = /sunday:\s*closed/i.test(wd.join(" ")); hours++; }
    upd.run({ id: r.id, enr: JSON.stringify(enr), pid: place.id ?? null });
    rated++;
  } else nomatch++;
  if (++done % 250 === 0) console.log(`  ${done}/${todo.length} · ${rated} rated · ${nomatch} no-match · ${errs} err · ${calls} calls`);
}

const q = [...todo];
await Promise.all(Array.from({ length: CONC }, async () => { while (q.length) await work(q.shift()); }));

console.log(`\n  ✓ done: ${rated} rated, ${hours} w/ hours, ${nomatch} no confident match · ${calls} API calls · est ≈ $${((calls * 20) / 1000).toFixed(2)}`);
const n = db.prepare("SELECT COUNT(*) n FROM dealerships WHERE brand_confirmed=1 AND state_province IN ('CA','TX','FL') AND enrichment LIKE '%googleRating%'").get().n;
console.log(`  CA/TX/FL confirmed with a rating now: ${n}`);
db.pragma("wal_checkpoint(TRUNCATE)");
