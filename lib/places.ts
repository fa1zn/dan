import { getSqlite } from "./db";
import { repEnv } from "./connections";

/*
 * Live rooftop verification via Google Places (New) Text Search.
 * Server-only. Results are cached in its own table (zero-shared-edit) with a
 * TTL so we hit the paid API at most once per rooftop per month, and so a
 * demo/offline run still renders whatever was last verified.
 */

export interface PlacesVerify {
  placeId: string;
  displayName: string | null;
  verifiedAddress: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  /** Google business status: OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY */
  businessStatus: string | null;
  fetchedAt: string;
}

const TTL_DAYS = 30;

let _ready = false;
function ensureTable() {
  if (_ready) return;
  getSqlite().exec(`
    CREATE TABLE IF NOT EXISTS places_cache (
      dealership_id INTEGER PRIMARY KEY,
      place_id TEXT,
      display_name TEXT,
      verified_address TEXT,
      phone TEXT,
      website TEXT,
      rating REAL,
      review_count INTEGER,
      business_status TEXT,
      found INTEGER NOT NULL DEFAULT 0,
      fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  _ready = true;
}

function readCache(id: number): PlacesVerify | null | "miss" {
  ensureTable();
  const row = getSqlite()
    .prepare(
      `SELECT place_id, display_name, verified_address, phone, website, rating, review_count,
              business_status, found, fetched_at,
              (julianday('now') - julianday(fetched_at)) AS age_days
       FROM places_cache WHERE dealership_id = ?`
    )
    .get(id) as
    | {
        place_id: string | null;
        display_name: string | null;
        verified_address: string | null;
        phone: string | null;
        website: string | null;
        rating: number | null;
        review_count: number | null;
        business_status: string | null;
        found: number;
        fetched_at: string;
        age_days: number;
      }
    | undefined;
  if (!row) return "miss";
  if (row.age_days > TTL_DAYS) return "miss"; // stale — refetch
  if (!row.found) return null; // cached "no match" — don't hammer the API
  return {
    placeId: row.place_id ?? "",
    displayName: row.display_name,
    verifiedAddress: row.verified_address,
    phone: row.phone,
    website: row.website,
    rating: row.rating,
    reviewCount: row.review_count,
    businessStatus: row.business_status,
    fetchedAt: row.fetched_at,
  };
}

function writeCache(id: number, v: PlacesVerify | null) {
  ensureTable();
  getSqlite()
    .prepare(
      `INSERT INTO places_cache
         (dealership_id, place_id, display_name, verified_address, phone, website,
          rating, review_count, business_status, found, fetched_at)
       VALUES (@id, @place_id, @display_name, @verified_address, @phone, @website,
          @rating, @review_count, @business_status, @found, CURRENT_TIMESTAMP)
       ON CONFLICT(dealership_id) DO UPDATE SET
         place_id=@place_id, display_name=@display_name, verified_address=@verified_address,
         phone=@phone, website=@website, rating=@rating, review_count=@review_count,
         business_status=@business_status, found=@found, fetched_at=CURRENT_TIMESTAMP`
    )
    .run({
      id,
      place_id: v?.placeId ?? null,
      display_name: v?.displayName ?? null,
      verified_address: v?.verifiedAddress ?? null,
      phone: v?.phone ?? null,
      website: v?.website ?? null,
      rating: v?.rating ?? null,
      review_count: v?.reviewCount ?? null,
      business_status: v?.businessStatus ?? null,
      found: v ? 1 : 0,
    });
}

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
].join(",");

async function fetchFromGoogle(key: string, query: string, bias?: { lat: number; lng: number }): Promise<PlacesVerify | null> {
  const body: Record<string, unknown> = { textQuery: query, maxResultCount: 1 };
  if (bias) {
    body.locationBias = { circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 30000 } };
  }
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
    // Never let a slow API stall the page render.
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Places ${res.status}`);
  const json = (await res.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      nationalPhoneNumber?: string;
      websiteUri?: string;
      rating?: number;
      userRatingCount?: number;
      businessStatus?: string;
    }>;
  };
  const p = json.places?.[0];
  if (!p) return null;
  return {
    placeId: p.id ?? "",
    displayName: p.displayName?.text ?? null,
    verifiedAddress: p.formattedAddress ?? null,
    phone: p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    rating: p.rating ?? null,
    reviewCount: p.userRatingCount ?? null,
    businessStatus: p.businessStatus ?? null,
    fetchedAt: new Date().toISOString(),
  };
}

export interface RooftopRef {
  id: number;
  name: string;
  city?: string | null;
  state?: string | null;
  lat?: number | null;
  lng?: number | null;
}

/**
 * Verify a rooftop against Google Places. Cached (30-day TTL). Returns null when
 * no key is configured or Google returns no match — the caller renders nothing,
 * so the feature degrades cleanly and never blocks the page.
 */
export async function verifyRooftop(r: RooftopRef): Promise<PlacesVerify | null> {
  const cached = readCache(r.id);
  if (cached !== "miss") return cached;

  const key = repEnv().GOOGLE_PLACES_KEY;
  if (!key) return null; // not configured — silently skip

  const query = [r.name, r.city, r.state].filter(Boolean).join(", ");
  const bias = r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : undefined;
  try {
    const v = await fetchFromGoogle(key, query, bias);
    writeCache(r.id, v);
    return v;
  } catch {
    // Transient API/network error — don't cache the failure, just skip this render.
    return null;
  }
}
