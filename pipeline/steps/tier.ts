import type { MasterRecord, Tier } from "../../lib/types";
import { loadAll, updateTier } from "./persist";

/**
 * Known multi-rooftop dealer groups (lower-cased name fragments). Matching a name
 * or domain against these marks a record as Tier A even when we can't infer a
 * group size from the data. This list is the obvious hook to refine later
 * (e.g. join against a curated group registry).
 */
const KNOWN_GROUPS: { match: string; name: string }[] = [
  { match: "autonation", name: "AutoNation" },
  { match: "lithia", name: "Lithia Motors" },
  { match: "penske", name: "Penske Automotive Group" },
  { match: "group1", name: "Group 1 Automotive" },
  { match: "group 1 auto", name: "Group 1 Automotive" },
  { match: "sonicautomotive", name: "Sonic Automotive" },
  { match: "sonic automotive", name: "Sonic Automotive" },
  { match: "hendrick", name: "Hendrick Automotive Group" },
  { match: "asbury", name: "Asbury Automotive Group" },
  { match: "kengarff", name: "Ken Garff Automotive" },
  { match: "ken garff", name: "Ken Garff Automotive" },
  { match: "larryhmiller", name: "Larry H. Miller" },
  { match: "larry h miller", name: "Larry H. Miller" },
  { match: "herbchambers", name: "Herb Chambers" },
  { match: "herb chambers", name: "Herb Chambers" },
  { match: "galpin", name: "Galpin Motors" },
  { match: "holman", name: "Holman" },
  { match: "greenway", name: "Greenway Automotive" },
  { match: "morgan auto", name: "Morgan Auto Group" },
  { match: "ourisman", name: "Ourisman Automotive" },
  { match: "autocanada", name: "AutoCanada" },
  { match: "dilawri", name: "Dilawri Group" },
];

function matchGroup(r: MasterRecord): string | null {
  const hay = `${r.name} ${r.domain ?? ""} ${r.groupName ?? ""}`.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  for (const g of KNOWN_GROUPS) if (hay.includes(g.match)) return g.name;
  return null;
}

export interface TierResult {
  tierA: number;
  tierB: number;
}

/**
 * Tier A when the rooftop belongs to a known group OR shares a domain with other
 * rooftops (group_size > 1); otherwise Tier B. group_size is inferred from the
 * count of rooftops per non-null domain.
 */
export function runTier(): TierResult {
  const rows = loadAll();

  const domainCounts = new Map<string, number>();
  for (const r of rows) {
    if (r.domain) domainCounts.set(r.domain, (domainCounts.get(r.domain) ?? 0) + 1);
  }

  let tierA = 0;
  let tierB = 0;
  for (const r of rows) {
    const knownGroup = matchGroup(r);
    const domainSize = r.domain ? domainCounts.get(r.domain) ?? 1 : 1;
    const groupSize = Math.max(domainSize, knownGroup ? 2 : 1);
    const tier: Tier = groupSize > 1 || knownGroup ? "A" : "B";

    if (tier === "A") tierA++;
    else tierB++;

    if (r.id != null) {
      updateTier(r.id, tier, knownGroup ?? r.groupName, groupSize > 1 ? groupSize : r.groupSize);
    }
  }

  return { tierA, tierB };
}
