import { CONFIG } from "../config";
import { fetchText } from "../lib/http";
import { getSqlite } from "../../lib/db";

/*
 * DEPTH PASS — fill phone + website + Google rating/reviews/hours on rooftops we
 * already discovered via Places (they carry a canonical place_id). Turns "skeleton"
 * rows into contactable, signal-bearing records. Paid (Place Details ~$20/1k), scoped
 * to PLACES_REGIONS, cached + parallelized. Idempotent (skips rows already filled).
 */

const num = (v: string | undefined, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
const list = (v: string | undefined) => (v && v.trim() ? v.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) : ["CA", "TX", "FL"]);

interface Details {
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  googleMapsUri?: string;
}

async function getDetails(placeId: string): Promise<Details | null> {
  const res = await fetchText(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": CONFIG.googlePlacesKey,
      "X-Goog-FieldMask": "nationalPhoneNumber,websiteUri,rating,userRatingCount,regularOpeningHours,googleMapsUri",
    },
    cacheNs: "places-details",
    cacheParts: [placeId],
    retries: 2,
  });
  if (!res.ok) return null;
  try { return JSON.parse(res.text) as Details; } catch { return null; }
}

export async function runPlacesDetails(): Promise<void> {
  if (!CONFIG.googlePlacesKey) { console.log("  [details] GOOGLE_PLACES_API_KEY not set."); return; }
  const db = getSqlite();
  const regions = list(process.env.PLACES_REGIONS);
  const ph = regions.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT id, place_id, phone, website, enrichment FROM dealerships
       WHERE state_province IN (${ph}) AND place_id IS NOT NULL AND (phone IS NULL OR website IS NULL)`
    )
    .all(...regions) as { id: number; place_id: string; phone: string | null; website: string | null; enrichment: string | null }[];

  console.log(`  [details] ${rows.length} rooftops to fill (phone/website/rating) across ${regions.join("/")}`);
  const upd = db.prepare(
    `UPDATE dealerships SET phone=COALESCE(phone,@phone), phone_valid=CASE WHEN phone IS NULL AND @phone IS NOT NULL THEN 1 ELSE phone_valid END,
       website=COALESCE(website,@website), domain=COALESCE(domain,@domain), enrichment=@enr, updated_at=CURRENT_TIMESTAMP WHERE id=@id`
  );

  let filledPhone = 0, filledWeb = 0, withRating = 0, done = 0, calls = 0;
  const concurrency = Math.max(1, num(process.env.PLACES_CONCURRENCY, 12));
  let cursor = 0;

  const work = async (r: (typeof rows)[number]) => {
    const d = await getDetails(r.place_id);
    calls++;
    if (d) {
      let enr: Record<string, unknown> = {};
      try { enr = JSON.parse(r.enrichment ?? "{}"); } catch {}
      if (d.rating != null) { enr.googleRating = d.rating; enr.reviewCount = d.userRatingCount; withRating++; }
      if (d.regularOpeningHours?.weekdayDescriptions) enr.hours = d.regularOpeningHours.weekdayDescriptions;
      if (d.googleMapsUri) enr.googleMapsUri = d.googleMapsUri;
      const phone = d.nationalPhoneNumber ?? null;
      const website = d.websiteUri ?? null;
      let domain: string | null = null;
      try { if (website) domain = new URL(website).hostname.replace(/^www\./, ""); } catch {}
      if (phone && !r.phone) filledPhone++;
      if (website && !r.website) filledWeb++;
      upd.run({ id: r.id, phone, website, domain, enr: JSON.stringify(enr) });
    }
    if (++done % 300 === 0) console.log(`  [details] ${done}/${rows.length} · +${filledPhone} phones · +${filledWeb} sites · ${withRating} ratings`);
  };

  await Promise.all(
    Array.from({ length: concurrency }, async () => { while (cursor < rows.length) await work(rows[cursor++]); })
  );

  console.log(`  [details] done: +${filledPhone} phones, +${filledWeb} websites, ${withRating} ratings · ${calls} calls · est. cost ≈ $${((calls * 20) / 1000).toFixed(2)}`);
}
