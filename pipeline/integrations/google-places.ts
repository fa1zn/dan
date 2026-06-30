import { CONFIG } from "../config";
import { fetchText } from "../lib/http";
import { getSqlite } from "../../lib/db";
import { normalizeWebsite, deriveDomain } from "../steps/normalize";

/*
 * Google Places cross-confirmation (PAID — needs GOOGLE_PLACES_API_KEY).
 * Matches each rooftop by name + geo, and where Google agrees it:
 *   - RECORDS "google_places" as an INDEPENDENT confirmation source (appended to
 *     the dealer's `source`), and
 *   - fills ONLY missing fields (address/phone/website) — never overwrites data
 *     another source already confirmed.
 * Cached, rate-limited, capped (PLACES_MAX_ACCOUNTS) to protect spend.
 */

const num = (v: string | undefined, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);

interface PlaceCandidate {
  place_id: string;
  name: string;
  geometry?: { location?: { lat: number; lng: number } };
}

function haversineMi(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function nameMatch(a: string, b: string): boolean {
  const A = new Set(norm(a).split(" ").filter((t) => t.length > 2));
  const B = new Set(norm(b).split(" ").filter((t) => t.length > 2));
  let common = 0;
  for (const t of A) if (B.has(t)) common++;
  return common >= 2 || common >= Math.min(A.size, B.size); // decent token overlap
}

async function places(path: string): Promise<Record<string, unknown> | null> {
  const url = `https://maps.googleapis.com/maps/api/place/${path}&key=${CONFIG.googlePlacesKey}`;
  const res = await fetchText(url, { cacheNs: "google-places", retries: 2, cacheParts: [path] });
  if (!res.ok) return null;
  try {
    return JSON.parse(res.text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

interface Row {
  id: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  address_street: string | null;
  phone: string | null;
  website: string | null;
  source: string;
  city: string | null;
}

export async function runGooglePlaces(): Promise<{ checked: number; confirmed: number; filled: number }> {
  if (!CONFIG.googlePlacesKey) {
    console.log("  [places] GOOGLE_PLACES_API_KEY not set — skipping (built, ready when keyed).");
    return { checked: 0, confirmed: 0, filled: 0 };
  }
  const db = getSqlite();
  const cap = num(process.env.PLACES_MAX_ACCOUNTS, 200);
  const rows = db
    .prepare(
      `SELECT id, name, latitude, longitude, address_street, phone, website, source, city
       FROM dealerships WHERE latitude IS NOT NULL AND source NOT LIKE '%google_places%'
       ORDER BY confirmation_count ASC LIMIT ?`
    )
    .all(cap) as Row[];
  console.log(`  [places] cross-confirming ${rows.length} rooftops (cap ${cap})`);

  let confirmed = 0;
  let filled = 0;
  const setRow = db.prepare(
    `UPDATE dealerships SET source=@source, address_street=COALESCE(address_street,@addr),
       phone=COALESCE(phone,@phone), website=COALESCE(website,@website), domain=COALESCE(domain,@domain),
       updated_at=CURRENT_TIMESTAMP WHERE id=@id`
  );

  for (const r of rows) {
    const find = await places(
      `findplacefromtext/json?input=${encodeURIComponent(`${r.name} ${r.city ?? ""}`)}` +
        `&inputtype=textquery&locationbias=point:${r.latitude},${r.longitude}` +
        `&fields=place_id,name,geometry`
    );
    const cand = (find?.candidates as PlaceCandidate[] | undefined)?.[0];
    if (!cand) continue;
    const loc = cand.geometry?.location;
    const near = loc ? haversineMi(r.latitude!, r.longitude!, loc.lat, loc.lng) <= 0.6 : true;
    if (!nameMatch(r.name, cand.name) || !near) continue;

    const det = await places(`details/json?place_id=${cand.place_id}&fields=formatted_phone_number,website,formatted_address`);
    const result = det?.result as { formatted_phone_number?: string; website?: string; formatted_address?: string } | undefined;

    const website = normalizeWebsite(result?.website ?? null);
    setRow.run({
      id: r.id,
      source: r.source.split("+").includes("google_places") ? r.source : `${r.source}+google_places`,
      addr: result?.formatted_address ?? null,
      phone: result?.formatted_phone_number ?? null,
      website,
      domain: deriveDomain(website),
    });
    confirmed++;
    if (result?.formatted_phone_number || website || result?.formatted_address) filled++;
  }

  console.log(`  [places] confirmed ${confirmed}/${rows.length}, filled missing fields on ${filled}`);
  return { checked: rows.length, confirmed, filled };
}
