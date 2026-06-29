import { CONFIG } from "../config";
import { fetchText } from "../lib/http";
import { regionsForCountries, type Region } from "../../lib/geo/regions";
import { canonicalizeOem } from "./oem/brands";
import type { RawRecord, Source } from "./types";

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** Build the Overpass QL for one bbox: branded car shops only. */
function buildQuery([s, w, n, e]: Region["bbox"], timeout = 30): string {
  return `[out:json][timeout:${timeout}];
(
  node["shop"="car"]["brand"](${s},${w},${n},${e});
  way["shop"="car"]["brand"](${s},${w},${n},${e});
);
out center tags;`;
}

/** Overpass QL selecting a region by its admin boundary (one query, no empty tiles). */
function buildAreaQuery(iso: string, timeout = 80): string {
  return `[out:json][timeout:${timeout}];
area["ISO3166-2"="${iso}"]->.a;
(
  node["shop"="car"]["brand"](area.a);
  way["shop"="car"]["brand"](area.a);
);
out center tags;`;
}

// Fallback bbox tiling is only used when an area query fails. Dense states get
// smaller tiles; the adaptive splitter handles anything that still times out.
const DENSE = new Set([
  "CA", "NY", "NJ", "FL", "TX", "IL", "PA", "OH", "MA", "MD", "GA", "NC", "MI",
  "VA", "WA", "AZ", "CO", "CT", "TN", "IN", "MO", "WI", "MN", "SC", "ON",
]);

function fallbackTileDeg(code: string): number {
  return DENSE.has(code) ? 1.5 : 2.5;
}

const MIN_TILE_DEG = 0.75;

/** Split a bbox into a grid of tiles no larger than `step` degrees on a side. */
function gridTiles([s, w, n, e]: Region["bbox"], step: number): Region["bbox"][] {
  const tiles: Region["bbox"][] = [];
  for (let lat = s; lat < n - 1e-9; lat += step) {
    for (let lng = w; lng < e - 1e-9; lng += step) {
      tiles.push([lat, lng, Math.min(lat + step, n), Math.min(lng + step, e)]);
    }
  }
  return tiles.length ? tiles : [[s, w, n, e]];
}

type TileOutcome =
  | { status: "ok"; elements: OverpassElement[] }
  | { status: "split" }; // server timed out / too many results → caller should subdivide

/** Query one tile across mirrors. A timeout-remark or all-mirror failure asks to split. */
async function queryTile(region: Region, tile: Region["bbox"]): Promise<TileOutcome> {
  const body = "data=" + encodeURIComponent(buildQuery(tile, 30));
  for (const endpoint of CONFIG.overpassEndpoints) {
    const res = await fetchText(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cacheNs: "osm",
      cacheParts: ["overpass-v2", region.code, tile],
      timeoutMs: 40_000,
    });
    if (!res.ok) continue;
    let json: { elements?: OverpassElement[]; remark?: string };
    try {
      json = JSON.parse(res.text);
    } catch {
      continue; // HTML error page → try next mirror
    }
    // Overpass signals an overloaded/too-big query via a `remark` with empty elements.
    if (json.remark && /timed out|runtime error|too many|memory/i.test(json.remark)) {
      return { status: "split" };
    }
    if (Array.isArray(json.elements)) return { status: "ok", elements: json.elements };
  }
  return { status: "split" }; // every mirror failed; subdividing may get under limits
}

/** Adaptively fetch a bbox: query it; if the server says "too big", split into quadrants. */
async function fetchBox(
  region: Region,
  box: Region["bbox"],
  byId: Map<string, OverpassElement>
): Promise<void> {
  const outcome = await queryTile(region, box);
  if (outcome.status === "ok") {
    for (const el of outcome.elements) byId.set(`${el.type}/${el.id}`, el);
    return;
  }
  const [s, w, n, e] = box;
  if (Math.max(n - s, e - w) <= MIN_TILE_DEG) return; // can't usefully split further
  const midLat = (s + n) / 2;
  const midLng = (w + e) / 2;
  const quads: Region["bbox"][] = [
    [s, w, midLat, midLng],
    [s, midLng, midLat, e],
    [midLat, w, n, midLng],
    [midLat, midLng, n, e],
  ];
  for (const q of quads) await fetchBox(region, q, byId);
}

/** Try a single admin-boundary (area) query for US/CA regions. Returns null to fall back. */
async function fetchByArea(region: Region): Promise<OverpassElement[] | null> {
  if (region.country !== "US" && region.country !== "CA") return null;
  const iso = `${region.country}-${region.code}`;
  const body = "data=" + encodeURIComponent(buildAreaQuery(iso, 80));
  for (const endpoint of CONFIG.overpassEndpoints) {
    const res = await fetchText(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cacheNs: "osm",
      cacheParts: ["overpass-area", iso],
      timeoutMs: 95_000,
    });
    if (!res.ok) continue;
    let json: { elements?: OverpassElement[]; remark?: string };
    try {
      json = JSON.parse(res.text);
    } catch {
      continue;
    }
    if (json.remark && /timed out|runtime error|too many|memory/i.test(json.remark)) return null;
    if (Array.isArray(json.elements)) return json.elements;
  }
  return null;
}

/** Fetch a region: one area query if possible, else adaptive bbox tiling. */
async function fetchRegion(region: Region): Promise<OverpassElement[]> {
  const area = await fetchByArea(region);
  if (area) {
    const byId = new Map<string, OverpassElement>();
    for (const el of area) byId.set(`${el.type}/${el.id}`, el);
    return [...byId.values()];
  }
  // Fallback: tile the bounding box (used for Mexico or if the area query failed).
  const tiles = gridTiles(region.bbox, fallbackTileDeg(region.code));
  const byId = new Map<string, OverpassElement>();
  for (const tile of tiles) await fetchBox(region, tile, byId);
  console.log(`  [osm] ${region.code}: area query unavailable → tiled ${tiles.length} boxes`);
  return [...byId.values()];
}

function tag(tags: Record<string, string> | undefined, ...keys: string[]): string | undefined {
  if (!tags) return undefined;
  for (const k of keys) if (tags[k]) return tags[k];
  return undefined;
}

function elementToRecord(el: OverpassElement, region: Region): RawRecord | null {
  const tags = el.tags ?? {};
  const oem = canonicalizeOem(tags.brand);
  // Backbone only keeps recognised franchise OEMs — drops independents & used lots.
  if (!oem) return null;

  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  const housenumber = tag(tags, "addr:housenumber");
  const street = tag(tags, "addr:street");
  const addressStreet = [housenumber, street].filter(Boolean).join(" ") || undefined;

  return {
    source: "osm",
    oem,
    name: tag(tags, "name", "official_name", "brand") ?? `${oem} Dealer`,
    website: tag(tags, "website", "contact:website", "url"),
    phone: tag(tags, "phone", "contact:phone", "telephone"),
    email: tag(tags, "email", "contact:email"),
    address_street: addressStreet,
    city: tag(tags, "addr:city"),
    state_province: tag(tags, "addr:state", "addr:province") ?? region.code,
    postal_code: tag(tags, "addr:postcode"),
    country: region.country,
    lat,
    lng,
    brand_confirmed: false, // OSM does not confirm OEM franchise affiliation.
    raw: { id: `${el.type}/${el.id}`, tags },
  };
}

export const osmSource: Source = {
  name: "osm",
  kind: "osm",
  status: "active",
  async fetch(): Promise<RawRecord[]> {
    let regions = regionsForCountries(CONFIG.enableMexico);
    if (CONFIG.osmRegions) {
      const want = new Set(CONFIG.osmRegions.map((r) => r.toUpperCase()));
      regions = regions.filter((r) => want.has(r.code));
    }

    const out: RawRecord[] = [];
    for (const region of regions) {
      const elements = await fetchRegion(region);
      let kept = 0;
      for (const el of elements) {
        const rec = elementToRecord(el, region);
        if (rec) {
          out.push(rec);
          kept++;
        }
      }
      console.log(`  [osm] ${region.country}/${region.code}: ${elements.length} elements → ${kept} franchise records`);
    }
    return out;
  },
};
