// Dealer-GROUP ownership: which parent company owns a rooftop. This is a top sales
// signal — a group-owned store means a centralized decision-maker (a group CIO/CMO
// or "Dealer Group" buyer), a longer sales cycle, and cross-sell across many rooftops.
//
// Two independent matchers, combined:
//   (1) A curated seed map of the top US dealer groups (from the Automotive News
//       "Top 150 Dealership Groups"): each group lists the name patterns/prefixes its
//       rooftops actually use, plus known registrable domains. High/medium confidence.
//   (2) Domain clustering: rooftops sharing a registrable domain (or a common non-OEM
//       domain root) usually share an owner, even when we don't have them in the seed
//       map. That yields "unknown group, but clustered" — medium/low confidence.
//
// Nothing here fabricates a parent: an ambiguous rooftop is left null.

export type GroupConfidence = "high" | "medium" | "low";

export interface GroupMatch {
  parent: string | null;
  confidence: GroupConfidence | null;
  evidence: string | null;
}

interface GroupSeed {
  /** Canonical parent name written to group_parent. */
  parent: string;
  /**
   * Name patterns. A rooftop name matching any of these is attributed to `parent`.
   * Anchored to word boundaries; ordered most-specific first. Kept deliberately tight
   * to avoid false positives (e.g. plain "Miller Ford" is NOT Larry H. Miller).
   */
  namePatterns: RegExp[];
  /** Registrable domains (or domain roots) the group's rooftops share. */
  domains?: string[];
}

// Top ~50 US dealer groups. Patterns are what the rooftops in this DB (and the wider
// market) actually brand themselves as — verified against name samples where possible.
const GROUP_SEEDS: GroupSeed[] = [
  { parent: "Lithia Motors / Driveway", namePatterns: [/\blithia\b/i, /\bdriveway\b/i, /\bdch\b/i], domains: ["lithia.com", "driveway.com"] },
  { parent: "AutoNation", namePatterns: [/\bautonation\b/i], domains: ["autonation.com"] },
  { parent: "Penske Automotive", namePatterns: [/\bpenske\b/i], domains: ["penskeautomotive.com"] },
  { parent: "Group 1 Automotive", namePatterns: [/\bgroup\s?1\b/i], domains: ["group1auto.com"] },
  { parent: "Sonic Automotive / EchoPark", namePatterns: [/\bsonic automotive\b/i, /\bechopark\b/i], domains: ["sonicautomotive.com", "echopark.com"] },
  { parent: "Asbury Automotive", namePatterns: [/\basbury\b/i], domains: ["asburyauto.com"] },
  { parent: "Hendrick Automotive", namePatterns: [/\bhendrick\b/i], domains: ["hendrickcars.com", "hendrickauto.com"] },
  { parent: "Ken Garff Automotive", namePatterns: [/\bken garff\b/i], domains: ["kengarff.com"] },
  { parent: "Larry H. Miller", namePatterns: [/\blarry h\.? ?miller\b/i, /\blhm\b/i] },
  { parent: "Germain Motor Company", namePatterns: [/\bgermain\b/i], domains: ["germain.com"] },
  { parent: "Berkshire Hathaway Automotive", namePatterns: [/\bberkshire hathaway\b/i, /\bvan tuyl\b/i] },
  { parent: "Ed Napleton Automotive", namePatterns: [/\bnapleton\b/i], domains: ["napleton.com"] },
  { parent: "Ourisman Automotive", namePatterns: [/\bourisman\b/i], domains: ["ourisman.com"] },
  { parent: "Herb Chambers", namePatterns: [/\bherb chambers\b/i], domains: ["herbchambers.com"] },
  { parent: "Galpin Motors", namePatterns: [/\bgalpin\b/i], domains: ["galpin.com"] },
  { parent: "Holman (Holman Automotive)", namePatterns: [/\bholman\b/i], domains: ["holmanauto.com"] },
  { parent: "Greenway Automotive", namePatterns: [/\bgreenway\b/i] },
  { parent: "Serra Automotive", namePatterns: [/\bserra\b/i] },
  { parent: "Rick Hendrick", namePatterns: [/\brick hendrick\b/i] },
  { parent: "Bill Luke / Berkshire", namePatterns: [/\bbill luke\b/i] },
  { parent: "David Wilson Automotive", namePatterns: [/\bdavid wilson\b/i] },
  { parent: "Fields Auto Group", namePatterns: [/\bfields\b/i] },
  { parent: "Morgan Auto Group", namePatterns: [/\bmorgan auto\b/i] },
  { parent: "Ciocca Dealerships", namePatterns: [/\bciocca\b/i] },
  { parent: "Jim Koons Automotive", namePatterns: [/\bkoons\b/i], domains: ["koons.com"] },
  { parent: "Prime Motor Group", namePatterns: [/\bprime motor\b/i] },
  { parent: "West Herr Automotive", namePatterns: [/\bwest herr\b/i] },
  { parent: "Suburban Collection", namePatterns: [/\bsuburban collection\b/i] },
  { parent: "Bommarito Automotive", namePatterns: [/\bbommarito\b/i] },
  { parent: "Bob Rohrman Auto Group", namePatterns: [/\brohrman\b/i] },
  { parent: "Gee Automotive", namePatterns: [/\bgee automotive\b/i] },
  { parent: "Ancira Auto Group", namePatterns: [/\bancira\b/i] },
  { parent: "Gurley Leep", namePatterns: [/\bgurley leep\b/i] },
  { parent: "Kwik Kar / Sewell", namePatterns: [/\bsewell\b/i], domains: ["sewell.com"] },
  { parent: "Van Horn Automotive", namePatterns: [/\bvan horn\b/i] },
  { parent: "Walser Automotive", namePatterns: [/\bwalser\b/i], domains: ["walser.com"] },
  { parent: "Tom Wood Automotive", namePatterns: [/\btom wood\b/i] },
  { parent: "Findlay Automotive", namePatterns: [/\bfindlay\b/i] },
  { parent: "Berman / Napleton", namePatterns: [/\bberman\b/i] },
  { parent: "Chapman Automotive", namePatterns: [/\bchapman\b/i] },
  { parent: "Manhattan Motorcars / Automotive Avenues", namePatterns: [/\bmanhattan motorcars\b/i] },
  { parent: "Fox Motors", namePatterns: [/\bfox motors\b/i] },
  { parent: "LaFontaine Automotive", namePatterns: [/\blafontaine\b/i], domains: ["lafontaine.com"] },
  { parent: "Feldman Automotive", namePatterns: [/\bfeldman\b/i] },
  { parent: "Del Grande Dealer Group", namePatterns: [/\bdel grande\b/i, /\bdgdg\b/i] },
  { parent: "Fitzgerald Auto Malls", namePatterns: [/\bfitzgerald auto\b/i] },
  { parent: "Zeigler Auto Group", namePatterns: [/\bzeigler\b/i] },
  { parent: "Kelly Automotive", namePatterns: [/\bkelly automotive\b/i] },
  { parent: "Piercey / Del Grande", namePatterns: [/\bpiercey\b/i] },
  { parent: "Dilawri Group", namePatterns: [/\bdilawri\b/i], domains: ["dilawri.ca"] },
  { parent: "AutoCanada", namePatterns: [/\bautocanada\b/i], domains: ["autocanada.ca"] },
];

// OEM / registrar / social domains that many unrelated rooftops share — clustering on
// these means nothing about ownership, so they must never seed a "shared owner" cluster.
const GENERIC_DOMAINS = new Set<string>([
  "tesla.com", "rivian.com", "lucidmotors.com", "polestar.com",
  "facebook.com", "wixsite.com", "godaddysites.com", "business.site", "google.com",
  "dealer.com", "dealeron.com", "dealerinspire.com", "sincrods.com",
  "hyundaidistribuidor.com.mx", "chevrolet.com.mx", "chevrolettoro.com.mx",
  "hondaplaza.mx", "mazda.mx", "nissanusa.com", "honda.com", "chevrolet.com",
  "kiaindia-dealers.com", "dealers.kia.com", "dealer.porsche.com", "fordsgarageusa.com",
]);

/** Strip to a registrable-ish domain root (drop www + obvious subdomains). */
export function registrableDomain(domain: string | null): string | null {
  if (!domain) return null;
  const d = domain.toLowerCase().replace(/^www\./, "").trim();
  if (!d || !d.includes(".")) return null;
  const parts = d.split(".");
  // Handle common 2-label public suffixes (.co.uk, .com.mx, .com.au, .co.nz, .ca).
  const twoLabelTld = /^(co|com|net|org|gov)\.[a-z]{2}$/.test(parts.slice(-2).join("."));
  const keep = twoLabelTld ? 3 : 2;
  return parts.slice(-keep).join(".");
}

/** Seed-map match on a rooftop NAME. High confidence — an explicit brand prefix. */
export function matchGroupByName(name: string): GroupMatch | null {
  for (const seed of GROUP_SEEDS) {
    for (const re of seed.namePatterns) {
      if (re.test(name)) {
        return { parent: seed.parent, confidence: "high", evidence: `name~${re.source}` };
      }
    }
  }
  return null;
}

/** Seed-map match on a rooftop DOMAIN. High confidence — a known group domain. */
export function matchGroupByDomain(domain: string | null): GroupMatch | null {
  const root = registrableDomain(domain);
  if (!root) return null;
  for (const seed of GROUP_SEEDS) {
    for (const d of seed.domains ?? []) {
      if (root === d.toLowerCase() || root.endsWith(`.${d.toLowerCase()}`)) {
        return { parent: seed.parent, confidence: "high", evidence: `domain=${root}` };
      }
    }
  }
  return null;
}

export interface RooftopLite {
  id: number;
  name: string;
  domain: string | null;
}

/**
 * Resolve group ownership across a whole set of rooftops.
 *  - Seed name/domain hits win (high confidence).
 *  - Otherwise, cluster by shared non-generic registrable domain. A domain shared by
 *    2+ rooftops that isn't a known group gets an inferred "Independent group (<domain>)"
 *    label at medium confidence; a rooftop alone on a private domain stays null.
 * Returns a map id -> GroupMatch (only ids that resolved to something).
 */
export function resolveGroups(rows: RooftopLite[]): Map<number, GroupMatch> {
  const out = new Map<number, GroupMatch>();

  // Pass 1: seed matches (name first, then domain).
  const unresolved: RooftopLite[] = [];
  for (const r of rows) {
    const m = matchGroupByName(r.name) ?? matchGroupByDomain(r.domain);
    if (m) out.set(r.id, m);
    else unresolved.push(r);
  }

  // Pass 2: domain clustering over the remainder.
  const byDomain = new Map<string, RooftopLite[]>();
  for (const r of unresolved) {
    const root = registrableDomain(r.domain);
    if (!root || GENERIC_DOMAINS.has(root)) continue;
    (byDomain.get(root) ?? byDomain.set(root, []).get(root)!).push(r);
  }
  for (const [root, cluster] of byDomain) {
    if (cluster.length < 2) continue; // a single rooftop on its own domain proves nothing
    for (const r of cluster) {
      out.set(r.id, {
        parent: `Independent group (${root})`,
        confidence: "medium",
        evidence: `shared-domain=${root} x${cluster.length}`,
      });
    }
  }

  return out;
}
