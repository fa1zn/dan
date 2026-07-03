import { getSqlite } from "./db";
import { US_STATES, CA_PROVINCES } from "./geo/regions";

/**
 * The geographic drill-down that both Book and Prospect filter by: Country then
 * State/province then City. A rep works an area top-down (pick USA, then Ohio, then
 * Columbus), so the picker is a dependent cascade: each level only offers values that
 * actually exist under the one above it, each with its live rooftop count.
 *
 * The whole tree is small enough to compute once per process and hand to the client, so
 * the dropdowns are instant with no round-trip between steps.
 */
export interface GeoCount {
  value: string; // the stored code/value, e.g. "US", "OH", "Columbus"
  label: string; // what the rep reads, e.g. "United States", "Ohio", "Columbus"
  count: number;
}

export interface GeoTree {
  countries: GeoCount[]; // sorted by size (biggest market first)
  states: Record<string, GeoCount[]>; // country code -> its states, sorted by name
  cities: Record<string, GeoCount[]>; // `${country}|${state}` -> its cities, sorted by name
}

const COUNTRY_LABEL: Record<string, string> = { US: "United States", CA: "Canada", MX: "Mexico" };

// State/province code -> full name, so the picker reads "Ohio" not "OH".
const STATE_NAME = new Map<string, string>();
for (const r of US_STATES) STATE_NAME.set(`US|${r.code}`, r.name);
for (const r of CA_PROVINCES) STATE_NAME.set(`CA|${r.code}`, r.name);

let _tree: GeoTree | null = null;

export function getGeoTree(): GeoTree {
  if (_tree) return _tree;
  const db = getSqlite();
  const rows = db
    .prepare(
      `SELECT country, state_province AS st, city, COUNT(*) AS n
       FROM dealerships
       WHERE country IS NOT NULL AND country <> ''
       GROUP BY country, state_province, city`
    )
    .all() as { country: string; st: string | null; city: string | null; n: number }[];

  const countryCount = new Map<string, number>();
  const stateMap = new Map<string, Map<string, number>>(); // country -> state -> count
  // country|state -> UPPER(city) -> best spelling + total count. Cities are grouped
  // case-insensitively so "Akron" and "AKRON" collapse into one option (the more common
  // spelling wins the label); the filter matches COLLATE NOCASE so both rows are still hit.
  const cityMap = new Map<string, Map<string, { label: string; count: number; best: number }>>();

  for (const r of rows) {
    countryCount.set(r.country, (countryCount.get(r.country) ?? 0) + r.n);
    if (!r.st) continue;
    const sm = stateMap.get(r.country) ?? new Map<string, number>();
    sm.set(r.st, (sm.get(r.st) ?? 0) + r.n);
    stateMap.set(r.country, sm);
    if (!r.city) continue;
    const key = `${r.country}|${r.st}`;
    const cm = cityMap.get(key) ?? new Map<string, { label: string; count: number; best: number }>();
    const uc = r.city.toUpperCase();
    const cur = cm.get(uc) ?? { label: r.city, count: 0, best: 0 };
    cur.count += r.n;
    if (r.n > cur.best) {
      cur.best = r.n;
      cur.label = r.city;
    }
    cm.set(uc, cur);
    cityMap.set(key, cm);
  }

  const countries: GeoCount[] = [...countryCount.entries()]
    .map(([value, count]) => ({ value, label: COUNTRY_LABEL[value] ?? value, count }))
    .sort((a, b) => b.count - a.count);

  const states: Record<string, GeoCount[]> = {};
  for (const [country, sm] of stateMap) {
    states[country] = [...sm.entries()]
      .map(([value, count]) => ({ value, label: STATE_NAME.get(`${country}|${value}`) ?? value, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  const cities: Record<string, GeoCount[]> = {};
  for (const [key, cm] of cityMap) {
    cities[key] = [...cm.values()]
      .map(({ label, count }) => ({ value: label, label, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  _tree = { countries, states, cities };
  return _tree;
}
