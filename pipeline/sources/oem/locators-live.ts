/*
 * VERIFIED LIVE OEM dealer-locator endpoints (July 2026).
 *
 * Every endpoint below was validated by fetching it THROUGH the Bright Data
 * Web Unlocker proxy (pipeline/lib/http.ts, useProxy=true) and confirming it
 * returns real dealer JSON (names, addresses, lat/lng). Each brand exposes a
 * `fetchByZip(zip)` that returns a normalized LocatedDealer[]. These power the
 * franchise-gate step (pipeline/steps/franchise-gate.ts).
 *
 * WORKING through the proxy (proxy-verified):
 *   - Honda   (automobiles.honda.com v1, zip)        Dealers[]  Latitude/Longitude
 *   - Acura   (acura.com v1, zip, division B)        Dealers[]  Latitude/Longitude
 *   - Subaru  (subaru.com services, zip)             [{dealer}] location.latitude
 *   - Stellantis (jeep.com bdlws byGeo, zip or geo)  dealer[]   dealerShowroom*  (CDJR)
 *   - Mazda   (mazdausa.com handlers, zip or geo)    body.results[]  lat/long
 *
 * RESEARCHED but blocked FROM THIS PROXY (CloudFront/AWS-WAF / Akamai bot walls
 * that reject the Web Unlocker's TLS fingerprint — documented in the adapter, and
 * in the deliverable). These need a browser-TLS fetch (Playwright/curl-impersonate):
 *   - Toyota  GET dealers.prod.webservices.toyota.com/v1/dealers/?zipcode={zip}   (WAF 403/502)
 *   - VW      GET {ver}.ds-us.dcc.feature-app.io/bff-search/dealers ...           (502)
 *   - Nissan  POST graphql.nissanusa.com/graphql                                  (Akamai 502)
 *   - Kia     POST kia.com/us/services/dealers/search                            (Akamai)
 *   - Ford    GET ford.com/cxservices/dealer/Dealers.json (needs fresh app-id)    (401)
 *   - GM/Chevrolet chevrolet.com/bypass/pcf/quantum-dealer-locator/v1/getDealers  (proxy robots block)
 */
import { fetchText } from "../../lib/http";

export interface LocatedDealer {
  oem: string;
  dealerCode?: string;
  name: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  website?: string;
}

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function getJson(url: string, ns: string, headers?: Record<string, string>): Promise<unknown | null> {
  const res = await fetchText(url, {
    headers: { "User-Agent": BROWSER_UA, Accept: "application/json, text/plain, */*", ...headers },
    cacheNs: ns,
    useProxy: true,
    timeoutMs: 60_000,
  });
  if (!res.ok) return null;
  try {
    return JSON.parse(res.text);
  } catch {
    return null;
  }
}

const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

// ── Honda / Acura (shared platform; productDivisionCode A=Honda, B=Acura) ──────
// GET https://<host>/platform/api/v1/dealer?productDivisionCode=A&zip=<zip>&maxResults=50
function hondaPlatform(oem: string, host: string, division: string) {
  return async function fetchByZip(zip: string): Promise<LocatedDealer[]> {
    const url =
      `https://${host}/platform/api/v1/dealer` +
      `?productDivisionCode=${division}&excludeServiceCenters=true&zip=${zip}&maxResults=50`;
    const json = (await getJson(url, `oem:${oem.toLowerCase()}`, {
      Referer: `https://${host}/tools/dealership-locator`,
    })) as { Dealers?: Record<string, unknown>[] } | null;
    const arr = json?.Dealers ?? [];
    return arr
      .filter((d) => !d.IsServiceCenter)
      .map((d) => ({
        oem,
        dealerCode: d.DealerNumber != null ? String(d.DealerNumber) : undefined,
        name: String(d.Name ?? "Unknown Dealer"),
        street: d.Address != null ? String(d.Address).trim() : undefined,
        city: d.City != null ? String(d.City) : undefined,
        state: d.State != null ? String(d.State) : undefined,
        zip: d.ZipCode != null ? String(d.ZipCode) : undefined,
        lat: num(d.Latitude),
        lng: num(d.Longitude),
        phone: d.Phone != null ? String(d.Phone) : undefined,
        website: d.WebAddress != null ? String(d.WebAddress) : undefined,
      }));
  };
}

// ── Subaru ────────────────────────────────────────────────────────────────────
// GET https://www.subaru.com/services/dealers/distances/by/zipcode?zipcode=<zip>&count=60&type=Active
async function subaruByZip(zip: string): Promise<LocatedDealer[]> {
  const url = `https://www.subaru.com/services/dealers/distances/by/zipcode?zipcode=${zip}&count=60&type=Active`;
  const json = (await getJson(url, "oem:subaru")) as { dealer: Record<string, unknown> }[] | null;
  if (!Array.isArray(json)) return [];
  return json
    .map((x) => x.dealer)
    .filter(Boolean)
    .map((d) => {
      const addr = (d.address ?? {}) as Record<string, unknown>;
      const loc = (d.location ?? {}) as Record<string, unknown>;
      return {
        oem: "Subaru",
        dealerCode: d.id != null ? String(d.id) : undefined,
        name: String(d.name ?? "Unknown Dealer"),
        street: addr.street != null ? String(addr.street) : undefined,
        city: addr.city != null ? String(addr.city) : undefined,
        state: addr.state != null ? String(addr.state) : undefined,
        zip: addr.zipcode != null ? String(addr.zipcode) : undefined,
        lat: num(loc.latitude),
        lng: num(loc.longitude),
        phone: d.phoneNumber != null ? String(d.phoneNumber) : undefined,
        website: d.siteUrl != null ? String(d.siteUrl) : undefined,
      };
    });
}

// ── Stellantis (Jeep host serves all CDJR rooftops; brands[] letters C/D/J/R) ──
// GET https://www.jeep.com/bdlws/DealerLocator?brandCode=J&func=byGeo&zipCode=<zip>&radius=100&resultsPerPage=200
const STELLANTIS_BRAND: Record<string, string> = { C: "Chrysler", D: "Dodge", J: "Jeep", R: "Ram" };
async function stellantisByZip(zip: string): Promise<LocatedDealer[]> {
  const url =
    `https://www.jeep.com/bdlws/DealerLocator` +
    `?brandCode=J&func=byGeo&zipCode=${zip}&radius=100&resultsPerPage=200`;
  const json = (await getJson(url, "oem:stellantis")) as { dealer?: Record<string, unknown>[] } | null;
  const arr = json?.dealer ?? [];
  const out: LocatedDealer[] = [];
  for (const d of arr) {
    const brands = Array.isArray(d.brands) ? (d.brands as string[]) : [];
    const base = {
      dealerCode: d.dealerCode != null ? String(d.dealerCode) : undefined,
      name: String(d.dealerName ?? "Unknown Dealer"),
      street: d.dealerAddress1 != null ? String(d.dealerAddress1) : undefined,
      city: d.dealerCity != null ? String(d.dealerCity) : undefined,
      state: d.dealerState != null ? String(d.dealerState) : undefined,
      zip: d.dealerZipCode != null ? String(d.dealerZipCode) : undefined,
      lat: num(d.dealerShowroomLatitude),
      lng: num(d.dealerShowroomLongitude),
      phone: d.phoneNumber != null ? String(d.phoneNumber) : undefined,
      website: d.website != null ? String(d.website) : undefined,
    };
    // One physical rooftop can carry several CDJR marques — emit one per brand letter.
    for (const letter of brands) {
      const oem = STELLANTIS_BRAND[letter];
      if (oem) out.push({ oem, ...base });
    }
  }
  return out;
}

// ── Mazda ───────────────────────────────────────────────────────────────────
// GET https://www.mazdausa.com/handlers/dealer.ajax?zip=<zip>&maxDistance=75&p=1&accolades=
async function mazdaByZip(zip: string): Promise<LocatedDealer[]> {
  const url = `https://www.mazdausa.com/handlers/dealer.ajax?zip=${zip}&maxDistance=75&p=1&accolades=`;
  const json = (await getJson(url, "oem:mazda")) as { body?: { results?: Record<string, unknown>[] } } | null;
  const arr = json?.body?.results ?? [];
  return arr.map((d) => ({
    oem: "Mazda",
    dealerCode: d.id != null ? String(d.id) : undefined,
    name: String(d.name ?? "Unknown Dealer"),
    street: d.address1 != null ? String(d.address1) : undefined,
    city: d.city != null ? String(d.city) : undefined,
    state: d.state != null ? String(d.state) : undefined,
    zip: d.zip != null ? String(d.zip) : undefined,
    lat: num(d.lat),
    lng: num(d.long),
    phone: d.dayPhone != null ? String(d.dayPhone) : undefined,
    website: d.webUrl != null ? String(d.webUrl) : undefined,
  }));
}

/** Brand → zip-driven live fetcher. Keys are canonical OEM names (see brands.ts). */
export const LIVE_LOCATORS: Record<string, (zip: string) => Promise<LocatedDealer[]>> = {
  Honda: hondaPlatform("Honda", "automobiles.honda.com", "A"),
  Acura: hondaPlatform("Acura", "www.acura.com", "B"),
  Subaru: subaruByZip,
  // Stellantis: one call returns Chrysler/Dodge/Jeep/Ram rooftops, tagged per marque.
  Chrysler: stellantisByZip,
  Dodge: stellantisByZip,
  Jeep: stellantisByZip,
  Ram: stellantisByZip,
  Mazda: mazdaByZip,
};

/** Which OEM marques we can gate against with a working live locator. */
export const LIVE_LOCATOR_OEMS = Object.keys(LIVE_LOCATORS);
