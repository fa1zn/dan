/**
 * Dealer GROUPS — the car-industry primitive. ~35% of franchise rooftops are owned by a
 * group, and Pam sells to the GROUP (one decision → many stores), not the rooftop. This
 * first pass detects the big, name-branded public groups (the ones Pam most wants); deeper
 * ownership (ZoomInfo/HubSpot corporate hierarchy) is a later upgrade.
 */

// Canonical group → match patterns (lowercased substring in the dealership name).
const GROUP_PATTERNS: Record<string, string[]> = {
  AutoNation: ["autonation"],
  "Lithia Motors": ["lithia"],
  "Group 1 Automotive": ["group 1", "group one"],
  "Penske": ["penske"],
  "Sonic Automotive": ["sonic automotive"],
  "Asbury": ["asbury"],
  "Hendrick": ["hendrick"],
  "Ken Garff": ["ken garff"],
  "Larry H. Miller": ["larry h. miller", "larry h miller"],
  "Norm Reeves": ["norm reeves"],
  "Galpin": ["galpin"],
  "Fletcher Jones": ["fletcher jones"],
  "Sewell": ["sewell"],
  "Classic": ["classic "],
  "Gillman": ["gillman"],
  "Mac Haik": ["mac haik"],
  "DCH Auto": ["dch "],
  "Bert Ogden": ["bert ogden"],
  "Greenway": ["greenway"],
  "Napleton": ["napleton"],
  "Rusnak": ["rusnak"],
  "Findlay": ["findlay"],
  "Sterling McCall": ["sterling mccall"],
  "Crevier": ["crevier"],
  "Keyes": ["keyes "],
};

/** Return the canonical group name if the dealership name signals a known group, else null. */
export function detectGroup(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = name.toLowerCase();
  for (const [group, pats] of Object.entries(GROUP_PATTERNS)) {
    if (pats.some((p) => n.includes(p))) return group;
  }
  return null;
}
