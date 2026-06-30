import { CONFIG } from "../config";
import { fetchText } from "../lib/http";
import { getSqlite } from "../../lib/db";

/*
 * Meta Ad Library signal. A dealer actively running Facebook/Instagram ads is spending
 * budget on exactly the problem Pam solves (lead gen / response) — a strong buying-intent
 * trigger. The Ad Library API is public but needs a Meta access token (any Meta developer
 * app). We mark which rooftops have active ads + how many, stored under enrichment.metaAds.
 * Cached + capped (META_MAX_ACCOUNTS) to stay polite.
 */

const num = (v: string | undefined, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);

interface Row {
  id: number;
  name: string;
  state_province: string | null;
  enrichment: string | null;
}

export async function runMetaAds(): Promise<{ checked: number; advertising: number }> {
  if (!CONFIG.metaAdLibraryToken) {
    console.log("  [meta] META_ADLIBRARY_TOKEN not set — skipping (built, ready when keyed).");
    return { checked: 0, advertising: 0 };
  }
  const db = getSqlite();
  const cap = num(process.env.META_MAX_ACCOUNTS, 200);
  const regions = (process.env.META_REGIONS ?? "TX,CA,FL").split(",").map((s) => s.trim().toUpperCase());
  const ph = regions.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT id, name, state_province, enrichment FROM dealerships WHERE state_province IN (${ph}) LIMIT ?`)
    .all(...regions, cap) as Row[];
  console.log(`  [meta] checking ad activity for ${rows.length} rooftops`);

  const setEnr = db.prepare("UPDATE dealerships SET enrichment=@e, updated_at=CURRENT_TIMESTAMP WHERE id=@id");
  let advertising = 0;

  for (const r of rows) {
    const url =
      `https://graph.facebook.com/v21.0/ads_archive?` +
      `search_terms=${encodeURIComponent(r.name)}` +
      `&ad_reached_countries=${encodeURIComponent('["US"]')}` +
      `&ad_active_status=ACTIVE&fields=id,page_name&limit=5` +
      `&access_token=${CONFIG.metaAdLibraryToken}`;
    const res = await fetchText(url, { cacheNs: "meta-ads", cacheParts: [r.name], retries: 2 });
    if (!res.ok) continue;
    let ads: { data?: unknown[] };
    try {
      ads = JSON.parse(res.text);
    } catch {
      continue;
    }
    const count = ads.data?.length ?? 0;
    if (count > 0) {
      let enr: Record<string, unknown> = {};
      try {
        enr = JSON.parse(r.enrichment ?? "{}");
      } catch {}
      enr.metaAds = { active: true, count };
      setEnr.run({ id: r.id, e: JSON.stringify(enr) });
      advertising++;
    }
  }
  console.log(`  [meta] ${advertising}/${rows.length} rooftops are actively advertising (buying-intent signal)`);
  return { checked: rows.length, advertising };
}
