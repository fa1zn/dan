import { ENABLED_ENRICHERS } from "../enrich/types";
import { detectTools, detectDms, detectCrm } from "../enrich/tools";
import { extractSignals } from "../enrich/signals";
import { resolveGroups } from "../enrich/groups";
import { fetchText } from "../lib/http";
import type { Contact } from "../../lib/types";
import {
  loadAll,
  updateContacts,
  updateTools,
  updateEnrichment,
  updateTechStack,
  updateGroupParent,
  backfillPhone,
} from "./persist";

const num = (v: string | undefined, dflt: number) => {
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : dflt;
};
const list = (v: string | undefined): string[] | null =>
  v && v.trim() ? v.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) : null;

const AUTO_SOURCES = new Set(["website", "staff-page"]);

/** Refresh scraped contacts (drop prior auto-sourced, keep manual), then de-dupe. */
function mergeContacts(existing: Contact[], found: Contact[]): Contact[] {
  const manual = existing.filter((c) => !AUTO_SOURCES.has(c.source ?? ""));
  const byEmail = new Map<string, Contact>();
  for (const c of [...manual, ...found]) {
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
  withTools: number;
  withGroup: number;
  withDms: number;
  withCrm: number;
}

/**
 * Run every enabled Enricher over accounts that have a website. Politeness +
 * caching come from the shared HTTP layer; capped per run via ENRICH_MAX_SITES.
 */
export async function runEnrich(): Promise<EnrichResult> {
  if (ENABLED_ENRICHERS.length === 0) {
    console.log("  [enrich] no enrichers enabled");
    return { attempted: 0, withContacts: 0, totalContacts: 0, withTools: 0, withGroup: 0, withDms: 0, withCrm: 0 };
  }

  const cap = num(process.env.ENRICH_MAX_SITES, 50);
  const regions = list(process.env.ENRICH_REGIONS); // restrict to state/province codes
  const all = loadAll();
  let candidates = all.filter((r) => r.website);
  if (regions) candidates = candidates.filter((r) => r.stateProvince && regions.includes(r.stateProvince.toUpperCase()));
  const slice = cap > 0 ? candidates.slice(0, cap) : candidates;

  // Dealer-GROUP ownership is name/domain-based (no network) — resolve it up front over
  // the whole table so domain clustering sees all rooftops, then persist for this slice.
  const groups = resolveGroups(all.map((r) => ({ id: r.id!, name: r.name, domain: r.domain })));
  let withGroup = 0;
  for (const r of slice) {
    const g = r.id != null ? groups.get(r.id) : undefined;
    if (g?.parent) {
      updateGroupParent(r.id!, g.parent, g.confidence);
      withGroup++;
    }
  }
  console.log(`  [enrich] group ownership resolved for ${withGroup}/${slice.length} rooftops in slice`);
  console.log(`  [enrich] ${ENABLED_ENRICHERS.map((e) => e.name).join(", ")} over ${slice.length}/${candidates.length} sited accounts`);

  let withContacts = 0;
  let totalContacts = 0;
  let withTools = 0;
  let withDms = 0;
  let withCrm = 0;
  let done = 0;

  // Process one rooftop. Network fetches dominate, so we run many concurrently.
  async function processOne(rec: (typeof slice)[number]): Promise<void> {
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
      if (!rec.phone) {
        const mainLine = found.find((c) => c.phone)?.phone;
        if (mainLine) backfillPhone(rec.id, mainLine);
      }
    }
    if (rec.website && rec.id != null) {
      const home = await fetchText(rec.website, { cacheNs: "enrich-website" });
      if (home.ok) {
        const tools = detectTools(home.text);
        if (tools.length) {
          updateTools(rec.id, tools);
          withTools++;
        }
        // DMS/CRM tech stack with matched evidence (client-side markers only).
        const dms = detectDms(home.text);
        const crm = detectCrm(home.text);
        if (dms.vendor || crm.vendor) {
          updateTechStack(rec.id, dms, crm);
          if (dms.vendor) withDms++;
          if (crm.vendor) withCrm++;
        }
        const signals = extractSignals(
          home.text,
          rec.domain,
          found.filter((c) => c.email).map((c) => c.email!),
          found.filter((c) => c.name).map((c) => ({ name: c.name }))
        );
        if (Object.keys(signals).length) updateEnrichment(rec.id, signals);
      }
    }
    if (++done % 50 === 0) {
      console.log(`  [enrich] processed ${done}/${slice.length} (${withContacts} contacts, ${withTools} tech stacks)`);
    }
  }

  // Bounded-concurrency worker pool. HTTP politeness is per-host, so concurrent
  // requests to different dealer sites stay polite while going ~Nx faster.
  const concurrency = Math.max(1, num(process.env.ENRICH_CONCURRENCY, 10));
  let cursor = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor < slice.length) {
        await processOne(slice[cursor++]);
      }
    })
  );

  return { attempted: slice.length, withContacts, totalContacts, withTools, withGroup, withDms, withCrm };
}
