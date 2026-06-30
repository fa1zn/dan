import { getSqlite } from "../../lib/db";

/*
 * Entity resolution — the trust foundation. Collapses records that refer to the same
 * physical rooftop across every source (OSM, OEM locators, Places, ZoomInfo, HubSpot)
 * into one canonical record, in place (preserves enrichment), favouring PRECISION:
 * we only merge on a strong, independent signal, because a wrong merge destroys trust
 * far worse than a missed duplicate.
 *
 * Blocking: (oem, state). Signals: phone, street+city, geo proximity, distinctive name.
 * Domain is supporting only (dealer groups share one site across many rooftops).
 * Dry run by default — set RESOLVE_APPLY=1 to actually merge.
 */

interface Row {
  id: number;
  name: string;
  oem: string | null;
  state_province: string | null;
  city: string | null;
  address_street: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  domain: string | null;
  source: string;
  brand_confirmed: number;
  contacts: string | null;
  tools_used: string | null;
  enrichment: string | null;
}

const digits = (s: string | null) => (s ? s.replace(/\D/g, "").replace(/^1(\d{10})$/, "$1") : "");
const STOP = new Set(["of", "the", "inc", "llc", "auto", "automotive", "cars", "car", "center", "motors", "motor", "group"]);
function nameTokens(name: string, oem: string | null): Set<string> {
  const brand = (oem ?? "").toLowerCase();
  return new Set(
    name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t) && t !== brand)
  );
}
function shared(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}
function normStreet(s: string | null): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[.,#]/g, "")
    .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|highway|hwy|freeway|fwy|suite|ste|unit|north|south|east|west|n|s|e|w)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function miBetween(a: Row, b: Row): number | null {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return null;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Facility suffixes that often denote a SEPARATE rooftop of the same dealer (a used
// lot, commercial/fleet center, body shop). Only merge these on a definite same-spot
// signal, never on name proximity alone.
const FACILITY = /(commercial|pre-?owned|used|fleet|economy|service|collision|body shop|bodyshop|parts|rental|truck)/i;
const facilityMismatch = (a: string, b: string) => FACILITY.test(a) !== FACILITY.test(b);

/** Decide whether two same-brand rooftops are the same physical entity (high precision). */
function isMatch(a: Row, b: Row): { match: boolean; why: string } {
  const aPhone = digits(a.phone);
  const bPhone = digits(b.phone);
  if (aPhone && aPhone === bPhone) return { match: true, why: "phone" };

  const aStreet = normStreet(a.address_street);
  const bStreet = normStreet(b.address_street);
  const sameCity = !!a.city && a.city.toLowerCase() === (b.city ?? "").toLowerCase();
  if (aStreet && aStreet === bStreet && sameCity) return { match: true, why: "address" };

  const mi = miBetween(a, b);
  if (mi != null && mi < 0.1) return { match: true, why: "geo<0.1mi" };

  // Probable: distinctive name overlap + corroboration — BUT not when the names differ
  // by a facility suffix (likely a distinct used/commercial rooftop).
  if (facilityMismatch(a.name, b.name)) return { match: false, why: "" };
  const nameOverlap = shared(nameTokens(a.name, a.oem), nameTokens(b.name, b.oem));
  if (nameOverlap >= 1 && ((mi != null && mi < 0.5) || (sameCity && aStreet && bStreet && aStreet.split(" ")[0] === bStreet.split(" ")[0]))) {
    return { match: true, why: "name+corroboration" };
  }
  return { match: false, why: "" };
}

// Field authority: prefer values that came from a more authoritative source.
const sourceRank = (src: string) => (src.includes("oem:") ? 3 : src.includes("google_places") ? 2 : 1);

export interface ResolveResult {
  clusters: number;
  removed: number;
  dryRun: boolean;
}

export function runResolve(): ResolveResult {
  const apply = ["1", "true", "yes"].includes((process.env.RESOLVE_APPLY ?? "").toLowerCase());
  const db = getSqlite();
  const rows = db
    .prepare(
      `SELECT id,name,oem,state_province,city,address_street,postal_code,latitude,longitude,phone,
              website,domain,source,brand_confirmed,contacts,tools_used,enrichment FROM dealerships`
    )
    .all() as Row[];

  // Block by (oem, state).
  const blocks = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${r.oem ?? "?"}|${r.state_province ?? "?"}`;
    (blocks.get(k) ?? blocks.set(k, []).get(k)!).push(r);
  }

  // Union-find over matching pairs within each block.
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    let p = parent.get(x) ?? x;
    if (p !== x) { p = find(p); parent.set(x, p); }
    return p;
  };
  const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (const r of rows) parent.set(r.id, r.id);

  let pairExamples: string[] = [];
  for (const block of blocks.values()) {
    if (block.length < 2) continue;
    for (let i = 0; i < block.length; i++) {
      for (let j = i + 1; j < block.length; j++) {
        const m = isMatch(block[i], block[j]);
        if (m.match) {
          union(block[i].id, block[j].id);
          if (pairExamples.length < 12) pairExamples.push(`"${block[i].name}" ⇔ "${block[j].name}" (${block[i].state_province}, via ${m.why})`);
        }
      }
    }
  }

  // Gather clusters of size > 1.
  const clusters = new Map<number, Row[]>();
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const r of rows) {
    const root = find(r.id);
    (clusters.get(root) ?? clusters.set(root, []).get(root)!).push(r);
  }
  const dupClusters = [...clusters.values()].filter((c) => c.length > 1);
  const removed = dupClusters.reduce((n, c) => n + c.length - 1, 0);

  console.log(`  [resolve] ${rows.length} rooftops → ${dupClusters.length} duplicate clusters, ${removed} records would merge away`);
  pairExamples.forEach((e) => console.log(`      • ${e}`));

  if (!apply) {
    console.log("  [resolve] DRY RUN — nothing merged. Set RESOLVE_APPLY=1 to apply.");
    return { clusters: dupClusters.length, removed, dryRun: true };
  }

  // Merge each cluster into the most-confirmed, most-complete canonical record.
  const updateCanon = db.prepare(
    `UPDATE dealerships SET source=@source, brand_confirmed=@bc, phone=@phone, website=@website, domain=@domain,
       address_street=@street, city=@city, postal_code=@zip, latitude=@lat, longitude=@lng,
       contacts=@contacts, tools_used=@tools, enrichment=@enr, updated_at=CURRENT_TIMESTAMP WHERE id=@id`
  );
  const del = db.prepare("DELETE FROM dealerships WHERE id=?");

  const completeness = (r: Row) =>
    new Set(r.source.split("+")).size * 10 +
    [r.phone, r.website, r.address_street, r.latitude, r.contacts && r.contacts !== "[]"].filter(Boolean).length;

  const tx = db.transaction(() => {
    for (const cluster of dupClusters) {
      const canon = [...cluster].sort((a, b) => completeness(b) - completeness(a))[0];
      const others = cluster.filter((r) => r.id !== canon.id);

      // Best field value: prefer the contributor with the highest source authority, else non-null.
      const best = <K extends keyof Row>(field: K): Row[K] => {
        let val = canon[field];
        let rank = val != null ? sourceRank(canon.source) : -1;
        for (const o of others) {
          if (o[field] != null && sourceRank(o.source) > rank) { val = o[field]; rank = sourceRank(o.source); }
          else if (val == null && o[field] != null) { val = o[field]; }
        }
        return val;
      };

      const sources = new Set<string>();
      cluster.forEach((r) => r.source.split("+").forEach((s) => sources.add(s.trim())));

      // Union contacts (dedup by email/name), keep all tech/signals.
      const contacts: Record<string, unknown>[] = [];
      const seen = new Set<string>();
      for (const r of cluster) {
        try {
          for (const c of JSON.parse(r.contacts ?? "[]") as Record<string, unknown>[]) {
            const key = String((c.email ?? c.name ?? "")).toLowerCase();
            if (key && seen.has(key)) continue;
            if (key) seen.add(key);
            contacts.push(c);
          }
        } catch {}
      }
      const tools = cluster.map((r) => r.tools_used).find((t) => t && t !== "[]") ?? "[]";
      const enr = cluster.map((r) => r.enrichment).find((e) => e && e !== "{}") ?? null;

      updateCanon.run({
        id: canon.id,
        source: [...sources].sort().join("+"),
        bc: cluster.some((r) => r.brand_confirmed) ? 1 : 0,
        phone: best("phone"),
        website: best("website"),
        domain: best("domain"),
        street: best("address_street"),
        city: best("city"),
        zip: best("postal_code"),
        lat: best("latitude"),
        lng: best("longitude"),
        contacts: JSON.stringify(contacts),
        tools,
        enr,
      });
      for (const o of others) del.run(o.id);
    }
  });
  tx();
  console.log(`  [resolve] merged ${dupClusters.length} clusters, removed ${removed} duplicate records`);
  return { clusters: dupClusters.length, removed, dryRun: false };
}
