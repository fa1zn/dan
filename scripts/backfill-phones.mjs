// Backfill missing phone/website/rating from Google Places into places_cache.
// Resumable: skips rooftops already cached. Cost-scoped by city.
//
//   node scripts/backfill-phones.mjs            # top 25 cities (demo path)
//   node scripts/backfill-phones.mjs --cities 60
//   node scripts/backfill-phones.mjs --all      # every phoneless rooftop
import fs from "node:fs";
import Database from "better-sqlite3";

const env = Object.fromEntries(
  fs.readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const KEY = env.GOOGLE_PLACES_KEY;
if (!KEY) { console.error("GOOGLE_PLACES_KEY missing from .env"); process.exit(1); }

const args = process.argv.slice(2);
const ALL = args.includes("--all");
const REVERIFY = args.includes("--reverify");
const cityCount = (() => { const i = args.indexOf("--cities"); return i >= 0 ? Number(args[i + 1]) : 25; })();
const MAX_KM = 12; // reject a Google match this far from the rooftop's known coords (wrong dealer)

function haversineKm(a, b, c, d) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (c - a) * r, dLng = (d - b) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const db = new Database(new URL("../data/dealerships.sqlite", import.meta.url).pathname);
db.exec(`CREATE TABLE IF NOT EXISTS places_cache (
  dealership_id INTEGER PRIMARY KEY, place_id TEXT, display_name TEXT, verified_address TEXT,
  phone TEXT, website TEXT, rating REAL, review_count INTEGER, business_status TEXT,
  found INTEGER NOT NULL DEFAULT 0, fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);

let targets;
if (ALL) {
  targets = db.prepare(`
    SELECT d.id, d.name, d.city, d.state_province AS state, d.latitude AS lat, d.longitude AS lng
    FROM dealerships d LEFT JOIN places_cache p ON p.dealership_id = d.id
    WHERE (d.phone IS NULL OR d.phone='') AND (@rev = 1 OR p.dealership_id IS NULL)
    ORDER BY d.city`).all({ rev: REVERIFY ? 1 : 0 });
} else {
  const cities = db.prepare(`
    SELECT city, state_province state FROM dealerships
    WHERE city IS NOT NULL AND city!='' GROUP BY city, state_province
    ORDER BY COUNT(*) DESC LIMIT ?`).all(cityCount);
  const set = new Set(cities.map((c) => `${c.city}|${c.state}`));
  const all = db.prepare(`
    SELECT d.id, d.name, d.city, d.state_province AS state, d.latitude AS lat, d.longitude AS lng
    FROM dealerships d LEFT JOIN places_cache p ON p.dealership_id = d.id
    WHERE (d.phone IS NULL OR d.phone='') AND (@rev = 1 OR p.dealership_id IS NULL)`).all({ rev: REVERIFY ? 1 : 0 });
  targets = all.filter((d) => set.has(`${d.city}|${d.state}`));
}

console.log(`Scope: ${ALL ? "ALL phoneless" : `top ${cityCount} cities`} → ${targets.length} rooftops to look up`);
if (!targets.length) { console.log("Nothing to do (all cached)."); process.exit(0); }

const FIELD_MASK = [
  "places.id", "places.displayName", "places.formattedAddress", "places.nationalPhoneNumber",
  "places.websiteUri", "places.rating", "places.userRatingCount", "places.businessStatus", "places.location",
].join(",");

const upsert = db.prepare(`
  INSERT INTO places_cache (dealership_id, place_id, display_name, verified_address, phone, website,
     rating, review_count, business_status, found, fetched_at)
  VALUES (@id,@place_id,@display_name,@verified_address,@phone,@website,@rating,@review_count,@business_status,@found,CURRENT_TIMESTAMP)
  ON CONFLICT(dealership_id) DO UPDATE SET place_id=@place_id, display_name=@display_name,
     verified_address=@verified_address, phone=@phone, website=@website, rating=@rating,
     review_count=@review_count, business_status=@business_status, found=@found, fetched_at=CURRENT_TIMESTAMP`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function lookup(d) {
  const body = { textQuery: [d.name, d.city, d.state].filter(Boolean).join(", "), maxResultCount: 1 };
  if (d.lat != null && d.lng != null) body.locationBias = { circle: { center: { latitude: d.lat, longitude: d.lng }, radius: 30000 } };
  let res;
  for (let attempt = 0; attempt < 6; attempt++) {
    res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": FIELD_MASK },
      body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
    });
    if (res.status !== 429) break;
    await sleep(2000 + attempt * 1000); // per-minute quota — back off until the window clears
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const p = (await res.json()).places?.[0];
  const empty = { id: d.id, place_id: null, display_name: null, verified_address: null, phone: null,
    website: null, rating: null, review_count: null, business_status: null, found: 0 };
  if (!p) return empty;
  // Distance gate: if we know the rooftop's coords and Google's result is far away,
  // it's a different dealer of the same brand — reject rather than attach a wrong phone.
  if (d.lat != null && d.lng != null && p.location) {
    const km = haversineKm(d.lat, d.lng, p.location.latitude, p.location.longitude);
    if (km > MAX_KM) return { ...empty, rejected: km };
  }
  return {
    id: d.id, place_id: p.id ?? null, display_name: p.displayName?.text ?? null,
    verified_address: p.formattedAddress ?? null, phone: p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null, rating: p.rating ?? null, review_count: p.userRatingCount ?? null,
    business_status: p.businessStatus ?? null, found: 1,
  };
}

let done = 0, matched = 0, gotPhone = 0, errors = 0, rejected = 0;
const CONCURRENCY = 5;
const queue = [...targets];
async function worker() {
  while (queue.length) {
    const d = queue.shift();
    try {
      const row = await lookup(d);
      if (row.rejected) rejected++;
      delete row.rejected;
      upsert.run(row);
      if (row.found) matched++;
      if (row.phone) gotPhone++;
    } catch { errors++; }
    if (++done % 50 === 0 || done === targets.length)
      console.log(`  ${done}/${targets.length} · matched ${matched} · phones ${gotPhone} · rejected ${rejected} · errors ${errors}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`\nDone. ${matched}/${targets.length} matched · ${gotPhone} callable phones · ${rejected} far-away matches rejected · ${errors} errors`);
