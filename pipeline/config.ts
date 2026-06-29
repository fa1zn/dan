import path from "node:path";

const bool = (v: string | undefined, dflt = false) =>
  v == null ? dflt : ["1", "true", "yes", "on"].includes(v.toLowerCase());
const num = (v: string | undefined, dflt: number) => {
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : dflt;
};
const list = (v: string | undefined): string[] | null =>
  v == null || v.trim() === "" ? null : v.split(",").map((s) => s.trim()).filter(Boolean);

export const CONFIG = {
  dataDir: path.join(process.cwd(), "data"),
  cacheDir: path.join(process.cwd(), "data", "cache"),
  rawDir: path.join(process.cwd(), "data", "raw"),
  csvPath: path.join(process.cwd(), "data", "dealerships.csv"),

  /** Mexico is opt-in per the brief. */
  enableMexico: bool(process.env.ENABLE_MEXICO, false),

  /** Comma-separated source names to enable; null = all registered sources. */
  enabledSources: list(process.env.ENABLED_SOURCES),

  /** Restrict OSM to specific state/province codes (e.g. "CA,TX,NY"); null = all. */
  osmRegions: list(process.env.OSM_REGIONS),

  /** Max degree size of an OSM sub-tile; large states are split to avoid timeouts. */
  osmTileDeg: num(process.env.OSM_TILE_DEG, 2.0),

  /** Coarse grid spacing (degrees) for OEM locator queries. ~1.0 ≈ 70mi spacing. */
  oemGridStepDeg: num(process.env.OEM_GRID_STEP_DEG, 1.0),

  /** Cap OEM grid points per source (0 = no cap). Useful for quick demos. */
  oemMaxPoints: num(process.env.OEM_MAX_POINTS, 0),

  /** Restrict OEM grid to specific region codes (e.g. "CA,TX"); null = all. */
  oemRegions: list(process.env.OEM_REGIONS),

  /** Politeness + resilience knobs for outbound HTTP. */
  http: {
    userAgent:
      process.env.HTTP_USER_AGENT ??
      "dealership-sor/0.1 (+https://example.com; franchise dealer SOR research)",
    minDelayMs: num(process.env.HTTP_MIN_DELAY_MS, 800),
    maxRetries: num(process.env.HTTP_MAX_RETRIES, 4),
    timeoutMs: num(process.env.HTTP_TIMEOUT_MS, 60_000),
    useCache: bool(process.env.HTTP_USE_CACHE, true),
  },

  /** Website validation knobs (step 4). */
  validate: {
    concurrency: num(process.env.VALIDATE_CONCURRENCY, 8),
    timeoutMs: num(process.env.VALIDATE_TIMEOUT_MS, 12_000),
    /** Cap on how many websites to probe in one run (0 = no cap). */
    maxWebsites: num(process.env.VALIDATE_MAX_WEBSITES, 0),
  },

  /** HubSpot two-way sync (Phase: integration). */
  hubspot: {
    token: process.env.HUBSPOT_TOKEN ?? "",
    /** Writes only happen when explicitly enabled; otherwise every run is a dry-run. */
    apply: bool(process.env.HUBSPOT_APPLY, false),
    /** Restrict the sync set to these state/province codes. */
    regions: list(process.env.HUBSPOT_REGIONS) ?? ["TX", "CA", "FL"],
    /** Only sync rooftops we've enriched (have contacts). Set 0 to sync all in-region. */
    onlyEnriched: bool(process.env.HUBSPOT_ONLY_ENRICHED, true),
    batchSize: num(process.env.HUBSPOT_BATCH, 100),
    /** Base URL of this app, used to write a deep link back to each Dan account. */
    appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3210",
  },

  /** Overpass API mirrors, tried in order on failure. */
  overpassEndpoints: list(process.env.OVERPASS_ENDPOINTS) ?? [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  ],
};

export type AppConfig = typeof CONFIG;
