import { getSqlite } from "./db";

/*
 * The territory co-pilot. A field rep works by GEOGRAPHY, not by list — 75% of the job is
 * driving. So Dan clusters dealers by city: who's already in your pipeline (check in while
 * you're here) vs. who you've never contacted (worth a stop), ordered into an efficient
 * loop by proximity. Every dealer already has a city + lat/lng.
 */

export interface CityOption {
  city: string;
  state: string;
  count: number;
}

export interface AreaDealer {
  id: number;
  name: string;
  oem: string | null;
  lat: number | null;
  lng: number | null;
  status: string | null;
  inPipeline: boolean;
}

export interface AreaView {
  city: string;
  state: string;
  total: number;
  inPipeline: AreaDealer[];
  untouched: AreaDealer[];
}

export function topCities(limit = 40): CityOption[] {
  return getSqlite()
    .prepare(
      `SELECT city, state_province AS state, COUNT(*) AS count
       FROM dealerships WHERE city IS NOT NULL AND city <> '' AND state_province IS NOT NULL
       GROUP BY city, state_province ORDER BY count DESC LIMIT ?`
    )
    .all(limit) as CityOption[];
}

/** Greedy nearest-neighbour from the cluster centroid — a sensible one-loop visit order. */
function routeOrder(dealers: AreaDealer[]): AreaDealer[] {
  const geo = dealers.filter((d) => d.lat != null && d.lng != null);
  const noGeo = dealers.filter((d) => d.lat == null || d.lng == null);
  if (geo.length <= 2) return [...geo, ...noGeo];
  const cx = geo.reduce((s, d) => s + d.lat!, 0) / geo.length;
  const cy = geo.reduce((s, d) => s + d.lng!, 0) / geo.length;
  const remaining = [...geo];
  const ordered: AreaDealer[] = [];
  let curLat = cx;
  let curLng = cy;
  while (remaining.length) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const dx = remaining[i].lat! - curLat;
      const dy = remaining[i].lng! - curLng;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const next = remaining.splice(best, 1)[0];
    ordered.push(next);
    curLat = next.lat!;
    curLng = next.lng!;
  }
  return [...ordered, ...noGeo];
}

export function areaView(city: string, state: string): AreaView {
  const db = getSqlite();
  const rows = db
    .prepare(
      `SELECT d.id, d.name, d.oem, d.latitude AS lat, d.longitude AS lng, c.status,
              (c.status IS NOT NULL AND c.status <> 'new') AS crmActive
       FROM dealerships d LEFT JOIN account_crm c ON c.dealership_id = d.id
       WHERE d.city = ? AND d.state_province = ?`
    )
    .all(city, state) as Array<{
    id: number;
    name: string;
    oem: string | null;
    lat: number | null;
    lng: number | null;
    status: string | null;
    crmActive: number;
  }>;

  const hasSeq = !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='enrollments'").get();
  const enrolled = new Set<number>(
    hasSeq
      ? (db.prepare("SELECT DISTINCT dealership_id AS id FROM enrollments WHERE state='active'").all() as { id: number }[]).map(
          (r) => r.id
        )
      : []
  );

  const dealers: AreaDealer[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    oem: r.oem,
    lat: r.lat,
    lng: r.lng,
    status: r.status,
    inPipeline: !!r.crmActive || enrolled.has(r.id),
  }));

  return {
    city,
    state,
    total: dealers.length,
    inPipeline: routeOrder(dealers.filter((d) => d.inPipeline)),
    untouched: routeOrder(dealers.filter((d) => !d.inPipeline)),
  };
}
