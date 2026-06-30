import { CONFIG } from "../../config";
import { fetchText } from "../../lib/http";
import { buildGrid, type GridPoint } from "../../../lib/geo/grid";
import { regionsForCountries } from "../../../lib/geo/regions";
import type { RawRecord, Source } from "../types";

export interface OemRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

/**
 * Declarative config for an OEM dealer-locator adapter. An OEM is wired up by
 * describing (a) how to turn a grid point into an HTTP request against the
 * brand's public locator JSON endpoint, and (b) how to parse that JSON into
 * RawRecords. The base handles the grid walk, caching, rate-limiting, retries,
 * within-source dedupe, and graceful degradation when the endpoint blocks bots.
 */
export interface OemLocatorConfig {
  /** Source name, conventionally "oem:<brand>". */
  name: string;
  /** Canonical OEM brand (see brands.ts). */
  oem: string;
  /** Search radius in miles passed to the locator (used by buildRequest). */
  radiusMi?: number;
  buildRequest(point: GridPoint, radiusMi: number): OemRequest;
  parse(json: unknown, point: GridPoint): RawRecord[];
}

/** Stable per-dealer key for within-source dedupe (grid points overlap). */
function dealerKey(r: RawRecord): string {
  const rawId = (r.raw as { dealerId?: string } | undefined)?.dealerId;
  if (rawId) return `id:${rawId}`;
  return ["k", r.name, r.address_street, r.postal_code].map((x) => (x ?? "").toLowerCase().trim()).join("|");
}

function gridForOem(): GridPoint[] {
  let regions = regionsForCountries(CONFIG.enableMexico);
  if (CONFIG.oemRegions) {
    const want = new Set(CONFIG.oemRegions.map((r) => r.toUpperCase()));
    regions = regions.filter((r) => want.has(r.code));
  }
  let grid = buildGrid({ enableMexico: CONFIG.enableMexico, stepDeg: CONFIG.oemGridStepDeg, regions });
  if (CONFIG.oemMaxPoints > 0) grid = grid.slice(0, CONFIG.oemMaxPoints);
  return grid;
}

export function createOemSource(cfg: OemLocatorConfig): Source {
  const radiusMi = cfg.radiusMi ?? 75;
  return {
    name: cfg.name,
    kind: "oem",
    oem: cfg.oem,
    status: "active",
    async fetch(): Promise<RawRecord[]> {
      const grid = gridForOem();
      const seen = new Set<string>();
      const out: RawRecord[] = [];
      let okPoints = 0;
      let blockedPoints = 0;

      for (const point of grid) {
        const req = cfg.buildRequest(point, radiusMi);
        const res = await fetchText(req.url, {
          method: req.method ?? "GET",
          headers: req.headers,
          body: req.body,
          cacheNs: cfg.name,
          cacheParts: [point.lat, point.lng, radiusMi],
          useProxy: true,
        });
        if (!res.ok) {
          blockedPoints++;
          continue;
        }
        let json: unknown;
        try {
          json = JSON.parse(res.text);
        } catch {
          blockedPoints++;
          continue;
        }
        okPoints++;
        for (const rec of cfg.parse(json, point)) {
          rec.source = cfg.name;
          rec.oem = cfg.oem;
          rec.brand_confirmed = true; // OEM locator = confirmed franchise affiliation.
          const k = dealerKey(rec);
          if (seen.has(k)) continue;
          seen.add(k);
          out.push(rec);
        }
      }

      console.log(
        `  [${cfg.name}] grid points: ${grid.length} (ok ${okPoints}, blocked/empty ${blockedPoints}) → ${out.length} dealers`
      );
      if (grid.length > 0 && okPoints === 0) {
        console.log(
          `  [${cfg.name}] NOTE: every request was refused — the locator endpoint is blocking automated traffic ` +
            `(CDN/bot protection) from this network. The adapter is correct; run it from a non-blocked IP/proxy to populate.`
        );
      }
      return out;
    },
  };
}
