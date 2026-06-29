// Canonical franchise OEM brand registry, shared by the OSM backbone (to filter
// franchise dealers from independents/used lots) and the OEM locator adapters.

/** Canonical OEM names sold through franchised dealer networks in US/CA. */
export const KNOWN_OEMS = [
  "Acura", "Alfa Romeo", "Aston Martin", "Audi", "Bentley", "BMW", "Buick",
  "Cadillac", "Chevrolet", "Chrysler", "Dodge", "Ferrari", "Fiat", "Ford",
  "Genesis", "GMC", "Honda", "Hyundai", "Infiniti", "Jaguar", "Jeep", "Kia",
  "Lamborghini", "Land Rover", "Lexus", "Lincoln", "Lucid", "Maserati", "Mazda",
  "McLaren", "Mercedes-Benz", "Mini", "Mitsubishi", "Nissan", "Polestar",
  "Porsche", "Ram", "Rivian", "Rolls-Royce", "Subaru", "Tesla", "Toyota",
  "Volkswagen", "Volvo",
] as const;

export type Oem = (typeof KNOWN_OEMS)[number];

/** Lower-cased alias → canonical OEM. Covers common OSM brand-tag spellings. */
const ALIASES: Record<string, Oem> = {
  "mercedes": "Mercedes-Benz",
  "mercedes benz": "Mercedes-Benz",
  "mercedesbenz": "Mercedes-Benz",
  "mb": "Mercedes-Benz",
  "vw": "Volkswagen",
  "volkswagon": "Volkswagen",
  "land-rover": "Land Rover",
  "landrover": "Land Rover",
  "range rover": "Land Rover",
  "mini cooper": "Mini",
  "chevy": "Chevrolet",
  "alfa": "Alfa Romeo",
  "rolls royce": "Rolls-Royce",
  "mercedes-benz": "Mercedes-Benz",
};

/** Brands that carry a brand tag but are NOT franchise OEMs (used/rental/independent). */
const EXCLUDED = new Set(
  [
    "carmax", "carvana", "vroom", "drivetime", "autonation usa", "echopark",
    "enterprise car sales", "hertz car sales", "avis", "byrider", "j.d. byrider",
    "u-haul", "uhaul", "penske used", "shift", "carshop",
  ].map((s) => s.toLowerCase())
);

const CANON_BY_LOWER = new Map<string, Oem>(KNOWN_OEMS.map((o) => [o.toLowerCase(), o]));

/**
 * Map a raw brand string to a canonical OEM, or null if it is excluded / unknown.
 * Handles multi-valued OSM tags like "Toyota;Lexus" by taking the first token.
 */
export function canonicalizeOem(brandRaw: string | null | undefined): Oem | null {
  if (!brandRaw) return null;
  const first = brandRaw.split(/[;,/|]/)[0]?.trim() ?? "";
  const lower = first.toLowerCase();
  if (!lower) return null;
  if (EXCLUDED.has(lower)) return null;
  return CANON_BY_LOWER.get(lower) ?? ALIASES[lower] ?? null;
}

export function isKnownOem(brandRaw: string | null | undefined): boolean {
  return canonicalizeOem(brandRaw) !== null;
}
