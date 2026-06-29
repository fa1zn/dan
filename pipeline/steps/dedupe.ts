import type { MasterRecord } from "../../lib/types";

const isOem = (source: string) => source.startsWith("oem:");
const filledCount = (r: MasterRecord) =>
  [r.website, r.phone, r.addressStreet, r.city, r.postalCode, r.email].filter(Boolean).length;

const joinSources = (a: string, b: string) =>
  Array.from(new Set([...a.split("+"), ...b.split("+")])).sort().join("+");

/**
 * Merge two records for the same dealer. OEM-sourced fields win over OSM; missing
 * fields are backfilled from the other record. brand_confirmed is sticky (OR).
 */
export function mergeTwo(a: MasterRecord, b: MasterRecord): MasterRecord {
  // Primary = the record whose fields take precedence.
  const aOem = isOem(a.source);
  const bOem = isOem(b.source);
  let primary = a;
  let secondary = b;
  if (bOem && !aOem) {
    primary = b;
    secondary = a;
  } else if (aOem === bOem && filledCount(b) > filledCount(a)) {
    primary = b;
    secondary = a;
  }

  const pick = <K extends keyof MasterRecord>(k: K): MasterRecord[K] =>
    (primary[k] ?? secondary[k]) as MasterRecord[K];

  return {
    ...primary,
    name: pick("name"),
    oem: pick("oem"),
    groupName: pick("groupName"),
    groupSize: pick("groupSize"),
    website: pick("website"),
    domain: pick("domain"),
    addressStreet: pick("addressStreet"),
    city: pick("city"),
    stateProvince: pick("stateProvince"),
    postalCode: pick("postalCode"),
    country: pick("country"),
    territory: pick("territory"),
    latitude: pick("latitude"),
    longitude: pick("longitude"),
    phone: pick("phone"),
    email: pick("email"),
    toolsUsed: Array.from(new Set([...(primary.toolsUsed ?? []), ...(secondary.toolsUsed ?? [])])),
    contacts: [...(primary.contacts ?? []), ...(secondary.contacts ?? [])],
    brandConfirmed: primary.brandConfirmed || secondary.brandConfirmed,
    websiteValid: primary.websiteValid ?? secondary.websiteValid,
    phoneValid: primary.phoneValid ?? secondary.phoneValid,
    tier: primary.tier ?? secondary.tier,
    source: joinSources(primary.source, secondary.source),
    dedupKey: primary.dedupKey,
    createdAt: a.createdAt < b.createdAt ? a.createdAt : b.createdAt,
    updatedAt: a.updatedAt > b.updatedAt ? a.updatedAt : b.updatedAt,
  };
}

export interface DedupeResult {
  merged: MasterRecord[];
  removed: number;
}

/** Pass-1 only: collapse exact dedup_key collisions. Used by normalize before persist. */
export function collapseExact(records: MasterRecord[]): MasterRecord[] {
  const byKey = new Map<string, MasterRecord>();
  for (const r of records) {
    const existing = byKey.get(r.dedupKey);
    byKey.set(r.dedupKey, existing ? mergeTwo(existing, r) : r);
  }
  return [...byKey.values()];
}

/**
 * Two-pass dedupe:
 *  1) collapse exact dedup_key collisions (oem + normalized address, or domain/name fallback);
 *  2) attach domain-keyed records (no street address) onto an address-keyed record
 *     for the same oem + domain, so a locator hit and an OSM rooftop reconcile.
 */
export function dedupeRecords(records: MasterRecord[]): DedupeResult {
  const before = records.length;

  // Pass 1: group by dedup_key.
  const byKey = new Map<string, MasterRecord>();
  for (const r of records) {
    const existing = byKey.get(r.dedupKey);
    byKey.set(r.dedupKey, existing ? mergeTwo(existing, r) : r);
  }

  // Pass 2: fold domain-only keys into address keys sharing oem + domain.
  const addressKeyed: MasterRecord[] = [];
  const domainKeyed: MasterRecord[] = [];
  for (const r of byKey.values()) {
    (r.dedupKey.includes("|addr|") ? addressKeyed : domainKeyed).push(r);
  }

  const byOemDomain = new Map<string, MasterRecord>();
  for (const r of addressKeyed) {
    if (r.domain) {
      const k = `${(r.oem ?? "?").toLowerCase()}|${r.domain}`;
      // Only index the first rooftop per oem+domain to avoid over-merging groups.
      if (!byOemDomain.has(k)) byOemDomain.set(k, r);
    }
  }

  const final: MasterRecord[] = [...addressKeyed];
  const mergedInto = new Set<MasterRecord>();
  for (const r of domainKeyed) {
    const k = `${(r.oem ?? "?").toLowerCase()}|${r.domain ?? ""}`;
    const target = r.domain ? byOemDomain.get(k) : undefined;
    if (target && !mergedInto.has(target)) {
      const idx = final.indexOf(target);
      final[idx] = mergeTwo(target, r);
      mergedInto.add(target);
    } else {
      final.push(r);
    }
  }

  return { merged: final, removed: before - final.length };
}
