import { CONFIG } from "../config";
import { fetchText } from "../lib/http";
import { getSqlite } from "../../lib/db";
import { buildGrid } from "../../lib/geo/grid";
import { regionsForCountries } from "../../lib/geo/regions";
import { canonicalizeOem, KNOWN_OEMS } from "../sources/oem/brands";
import { deriveTerritory } from "../../lib/geo/territory";
import { buildDedupKey } from "../steps/normalize";

/*
 * COVERAGE ENGINE — enumerate every NA franchise rooftop via Google Places.
 * Google has the comprehensive list; we Text-Search "{brand} dealer" over a geo grid,
 * dedup on the canonical place_id (free + exact identity), and insert net-new rooftops.
 * The entity resolver then reconciles these with OSM/OEM. Paid — scoped by PLACES_BRANDS,
 * PLACES_REGIONS, PLACES_GRID_STEP; cost is reported. Idempotent (place_id).
 */

const num = (v: string | undefined, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
const list = (v: string | undefined) => (v && v.trim() ? v.split(",").map((s) => s.trim()).filter(Boolean) : null);

// Exclude non-franchise / sub-listing noise: service & parts depts, body/collision,
// powersports/motorcycle/marine, independent service shops, used-only & buy centers.
const NOISE =
  /(service|parts|body shop|bodyshop|collision|power\s?sports|motorcycle|motorsport|marine|\brv\b|\bcycle\b|\batv\b|transmission|repair|independent|buy center|green center|rental|express|quick lane|oil|tire|expert|wholesale|smog|detail|glass|leasing)/i;

interface NewPlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
}

async function searchText(query: string, lat: number, lng: number, radiusM: number, pageToken?: string) {
  const res = await fetchText("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": CONFIG.googlePlacesKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,nextPageToken",
    },
    body: JSON.stringify({
      textQuery: query,
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: radiusM } },
      ...(pageToken ? { pageToken } : {}),
    }),
    cacheNs: "places-discover",
    cacheParts: [query, lat, lng, pageToken ?? "p0"],
    retries: 2,
  });
  if (!res.ok) return { places: [] as NewPlace[], next: undefined };
  try {
    const j = JSON.parse(res.text) as { places?: NewPlace[]; nextPageToken?: string };
    return { places: j.places ?? [], next: j.nextPageToken };
  } catch {
    return { places: [] as NewPlace[], next: undefined };
  }
}

function parseAddress(a: string): { street: string; city: string; state: string; zip: string; country: string } {
  // "780 W MLK Jr Blvd, Los Angeles, CA 90037, USA"
  const parts = a.split(",").map((s) => s.trim());
  const country = /canada/i.test(a) ? "CA" : /mexico|méxico/i.test(a) ? "MX" : "US";
  const stZip = parts[parts.length - 2] ?? "";
  const m = stZip.match(/([A-Z]{2})\s*([A-Z0-9 ]{3,7})?/);
  return {
    street: parts[0] ?? "",
    city: parts[1] ?? "",
    state: m?.[1] ?? "",
    zip: (m?.[2] ?? "").trim(),
    country,
  };
}

export interface DiscoverResult {
  searches: number;
  found: number;
  inserted: number;
  skipped: number;
}

export async function runPlacesDiscover(): Promise<DiscoverResult> {
  if (!CONFIG.googlePlacesKey) {
    console.log("  [discover] GOOGLE_PLACES_API_KEY not set.");
    return { searches: 0, found: 0, inserted: 0, skipped: 0 };
  }
  const db = getSqlite();
  const brands = list(process.env.PLACES_BRANDS) ?? [...KNOWN_OEMS];
  const regionCodes = list(process.env.PLACES_REGIONS);
  const step = num(process.env.PLACES_GRID_STEP, 0.7);
  const radiusM = num(process.env.PLACES_RADIUS_M, 45000);
  const enableMx = ["1", "true"].includes((process.env.ENABLE_MEXICO ?? "").toLowerCase());

  let regions = regionsForCountries(enableMx);
  if (regionCodes) {
    const want = new Set(regionCodes.map((r) => r.toUpperCase()));
    regions = regions.filter((r) => want.has(r.code));
  }
  const grid = buildGrid({ enableMexico: enableMx, stepDeg: step, regions });
  console.log(`  [discover] ${brands.length} brands × ${grid.length} grid points — Google Places enumeration`);

  const existingPlaceIds = new Set(
    (db.prepare("SELECT place_id FROM dealerships WHERE place_id IS NOT NULL").all() as { place_id: string }[]).map((r) => r.place_id)
  );
  const insert = db.prepare(
    `INSERT INTO dealerships (name, oem, address_street, city, state_province, postal_code, country, territory,
       latitude, longitude, source, place_id, dedup_key, created_at, updated_at)
     VALUES (@name,@oem,@street,@city,@state,@zip,@country,@territory,@lat,@lng,'google_places',@place_id,@dedup,@now,@now)`
  );
  const findByKey = db.prepare("SELECT id, source FROM dealerships WHERE dedup_key=?");
  const merge = db.prepare(
    `UPDATE dealerships SET source=@source, place_id=COALESCE(place_id,@place_id),
       address_street=COALESCE(address_street,@street), city=COALESCE(city,@city),
       state_province=COALESCE(state_province,@state), postal_code=COALESCE(postal_code,@zip),
       latitude=COALESCE(latitude,@lat), longitude=COALESCE(longitude,@lng), updated_at=@now WHERE id=@id`
  );

  const now = new Date().toISOString();
  let searches = 0, found = 0, inserted = 0, skipped = 0, confirmed = 0, done = 0;

  // Ingest one Places result (sync DB write — safe under the async pool).
  const ingest = (brand: string, region: string, p: NewPlace) => {
    const name = p.displayName?.text ?? "";
    if (!new RegExp(brand, "i").test(name)) return; // must mention the brand
    if (NOISE.test(name)) return; // drop service/parts/powersports/independent noise
    found++;
    if (existingPlaceIds.has(p.id)) { skipped++; return; }
    existingPlaceIds.add(p.id);
    const a = parseAddress(p.formattedAddress ?? "");
    const oem = canonicalizeOem(brand) ?? brand;
    const lat = p.location?.latitude ?? null;
    const lng = p.location?.longitude ?? null;
    const dedup = buildDedupKey({ oem, addressStreet: a.street, city: a.city, stateProvince: a.state, postalCode: a.zip, domain: null, name, lat: lat ?? undefined, lng: lng ?? undefined });
    const existing = findByKey.get(dedup) as { id: number; source: string } | undefined;
    if (existing) {
      const source = existing.source.split("+").includes("google_places") ? existing.source : `${existing.source}+google_places`;
      merge.run({ id: existing.id, source, place_id: p.id, street: a.street, city: a.city, state: a.state || region, zip: a.zip, lat, lng, now });
      confirmed++;
    } else {
      insert.run({ name, oem, street: a.street, city: a.city, state: a.state || region, zip: a.zip, country: a.country, territory: deriveTerritory(a.state || region, a.country), lat, lng, place_id: p.id, dedup, now });
      inserted++;
    }
  };

  // One (brand, grid-point) task: paginate Places, ingest each result.
  const tasks: { brand: string; pt: (typeof grid)[number] }[] = [];
  for (const brand of brands) for (const pt of grid) tasks.push({ brand, pt });

  const processTask = async (t: { brand: string; pt: (typeof grid)[number] }) => {
    let token: string | undefined;
    for (let page = 0; page < 3; page++) {
      const { places, next } = await searchText(`${t.brand} dealer`, t.pt.lat, t.pt.lng, radiusM, token);
      searches++;
      for (const p of places) ingest(t.brand, t.pt.region, p);
      if (!next) break;
      token = next;
    }
    if (++done % 200 === 0) console.log(`  [discover] ${done}/${tasks.length} grid×brand done · ${inserted} new, ${confirmed} confirmed`);
  };

  // Bounded-concurrency pool over the network fetches.
  const concurrency = Math.max(1, num(process.env.PLACES_CONCURRENCY, 12));
  let cursor = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor < tasks.length) await processTask(tasks[cursor++]);
    })
  );

  // Rough cost note (Text Search Pro ~ $32 / 1000 requests).
  console.log(`  [discover] done: ${searches} searches, ${found} brand matches → ${inserted} net-new rooftops, ${confirmed} confirmed existing, ${skipped} dup place_ids`);
  console.log(`  [discover] est. cost ≈ $${((searches * 32) / 1000).toFixed(2)} (Text Search @ ~$32/1k)`);
  return { searches, found, inserted, skipped };
}
