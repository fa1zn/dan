import { ENABLED_ENRICHERS } from "../enrich/types";
import type { Contact } from "../../lib/types";
import { loadAll, updateContacts } from "./persist";

const num = (v: string | undefined, dflt: number) => {
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : dflt;
};

/** De-dupe contacts by email (case-insensitive), keeping the first/title-bearing one. */
function mergeContacts(existing: Contact[], found: Contact[]): Contact[] {
  const byEmail = new Map<string, Contact>();
  for (const c of [...existing, ...found]) {
    const key = (c.email ?? c.name ?? JSON.stringify(c)).toLowerCase();
    const prev = byEmail.get(key);
    if (!prev) byEmail.set(key, c);
    else if (!prev.title && c.title) byEmail.set(key, { ...prev, ...c });
  }
  return [...byEmail.values()];
}

export interface EnrichResult {
  attempted: number;
  withContacts: number;
  totalContacts: number;
}

/**
 * Run every enabled Enricher over accounts that have a website. Politeness +
 * caching come from the shared HTTP layer; capped per run via ENRICH_MAX_SITES.
 */
export async function runEnrich(): Promise<EnrichResult> {
  if (ENABLED_ENRICHERS.length === 0) {
    console.log("  [enrich] no enrichers enabled");
    return { attempted: 0, withContacts: 0, totalContacts: 0 };
  }

  const cap = num(process.env.ENRICH_MAX_SITES, 50);
  const candidates = loadAll().filter((r) => r.website);
  const slice = cap > 0 ? candidates.slice(0, cap) : candidates;
  console.log(`  [enrich] ${ENABLED_ENRICHERS.map((e) => e.name).join(", ")} over ${slice.length}/${candidates.length} sited accounts`);

  let withContacts = 0;
  let totalContacts = 0;
  let i = 0;
  for (const rec of slice) {
    const found: Contact[] = [];
    for (const enricher of ENABLED_ENRICHERS) {
      try {
        found.push(...(await enricher.enrich(rec)));
      } catch {
        // a single site failing must not abort the run
      }
    }
    if (found.length && rec.id != null) {
      const merged = mergeContacts(rec.contacts ?? [], found);
      updateContacts(rec.id, merged);
      withContacts++;
      totalContacts += found.length;
    }
    if (++i % 25 === 0) console.log(`  [enrich] processed ${i}/${slice.length} (${withContacts} with contacts)`);
  }

  return { attempted: slice.length, withContacts, totalContacts };
}
