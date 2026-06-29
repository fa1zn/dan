// Derive a coarse sales "territory" from a US state / CA province code.
// Territories are a common CRM rollup; this is a simple, override-friendly map.

const US_TERRITORY: Record<string, string> = {
  // Northeast
  CT: "US-Northeast", ME: "US-Northeast", MA: "US-Northeast", NH: "US-Northeast",
  RI: "US-Northeast", VT: "US-Northeast", NJ: "US-Northeast", NY: "US-Northeast",
  PA: "US-Northeast",
  // Midwest
  IL: "US-Midwest", IN: "US-Midwest", MI: "US-Midwest", OH: "US-Midwest",
  WI: "US-Midwest", IA: "US-Midwest", KS: "US-Midwest", MN: "US-Midwest",
  MO: "US-Midwest", NE: "US-Midwest", ND: "US-Midwest", SD: "US-Midwest",
  // South
  DE: "US-South", DC: "US-South", FL: "US-South", GA: "US-South", MD: "US-South",
  NC: "US-South", SC: "US-South", VA: "US-South", WV: "US-South", AL: "US-South",
  KY: "US-South", MS: "US-South", TN: "US-South", AR: "US-South", LA: "US-South",
  OK: "US-South", TX: "US-South",
  // West
  AZ: "US-West", CO: "US-West", ID: "US-West", MT: "US-West", NV: "US-West",
  NM: "US-West", UT: "US-West", WY: "US-West", AK: "US-West", CA: "US-West",
  HI: "US-West", OR: "US-West", WA: "US-West",
};

const CA_TERRITORY: Record<string, string> = {
  BC: "CA-West", AB: "CA-West", SK: "CA-Prairies", MB: "CA-Prairies",
  ON: "CA-Central", QC: "CA-Central", NB: "CA-Atlantic", NS: "CA-Atlantic",
  PE: "CA-Atlantic", NL: "CA-Atlantic", YT: "CA-North", NT: "CA-North", NU: "CA-North",
};

export function deriveTerritory(stateProvince: string | null, country: string | null): string | null {
  if (!stateProvince) return country ? `${country}-Unknown` : null;
  const code = stateProvince.trim().toUpperCase();
  if (US_TERRITORY[code]) return US_TERRITORY[code];
  if (CA_TERRITORY[code]) return CA_TERRITORY[code];
  if (country === "MX") return "MX-National";
  return country ? `${country}-Other` : null;
}
