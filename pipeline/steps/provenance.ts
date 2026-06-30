import { getSqlite } from "../../lib/db";

/*
 * Provenance + trust tier. Each rooftop's `source` field is the "+"-joined set of
 * INDEPENDENT sources that confirmed it (osm, oem:<brand>, google_places). We expose
 * that as a sources[] array, a confirmation_count, and a trust_tier:
 *   3+ independent = platinum, 2 = gold, 1 = silver, 0 = flagged.
 */

const TIERS = ["flagged", "silver", "gold", "platinum"] as const;
export type TrustTier = (typeof TIERS)[number];

function tierFor(count: number): TrustTier {
  if (count >= 3) return "platinum";
  if (count === 2) return "gold";
  if (count === 1) return "silver";
  return "flagged";
}

export interface ProvenanceResult {
  tiers: Record<TrustTier, number>;
}

export function runProvenance(): ProvenanceResult {
  const db = getSqlite();
  const rows = db.prepare("SELECT id, source FROM dealerships").all() as { id: number; source: string }[];
  const upd = db.prepare(
    "UPDATE dealerships SET sources=@sources, confirmation_count=@count, trust_tier=@tier WHERE id=@id"
  );
  const tiers: Record<TrustTier, number> = { platinum: 0, gold: 0, silver: 0, flagged: 0 };

  const tx = db.transaction(() => {
    for (const r of rows) {
      // Distinct, independent source tokens.
      const sources = [...new Set((r.source ?? "").split("+").map((s) => s.trim()).filter(Boolean))];
      const count = sources.length;
      const tier = tierFor(count);
      tiers[tier]++;
      upd.run({ id: r.id, sources: JSON.stringify(sources), count, tier });
    }
  });
  tx();
  return { tiers };
}
