import { regionsForCountries, type Region } from "./regions";

export interface GridPoint {
  lat: number;
  lng: number;
  region: string;
  country: string;
}

/**
 * Build a coarse lat/lng grid over the requested regions. These points act as the
 * "postal centroids" that OEM dealer-locator adapters query by radius. A larger
 * `stepDeg` means fewer queries (faster, coarser); the locator's `radius` should be
 * sized to overlap neighbouring points so there are no gaps.
 */
export function buildGrid(opts: {
  enableMexico: boolean;
  stepDeg: number;
  regions?: Region[];
}): GridPoint[] {
  const regions = opts.regions ?? regionsForCountries(opts.enableMexico);
  const step = Math.max(0.1, opts.stepDeg);
  const points: GridPoint[] = [];

  for (const r of regions) {
    const [south, west, north, east] = r.bbox;
    const before = points.length;
    for (let lat = south + step / 2; lat < north; lat += step) {
      for (let lng = west + step / 2; lng < east; lng += step) {
        points.push({
          lat: Math.round(lat * 1e4) / 1e4,
          lng: Math.round(lng * 1e4) / 1e4,
          region: r.code,
          country: r.country,
        });
      }
    }
    // Regions smaller than the grid step still get one query at their centroid.
    if (points.length === before) {
      points.push({
        lat: Math.round(((south + north) / 2) * 1e4) / 1e4,
        lng: Math.round(((west + east) / 2) * 1e4) / 1e4,
        region: r.code,
        country: r.country,
      });
    }
  }
  return points;
}
