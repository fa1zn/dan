import { createOemSource, type OemLocatorConfig } from "./base";
import { dealerToRecord, findDealerArray } from "./parse-util";
import type { GridPoint } from "../../../lib/geo/grid";
import type { Source } from "../types";

/*
 * OEM dealer-locator adapters for every remaining major brand, behind the existing
 * createOemSource interface. Each queries the brand's public locator JSON by lat/lng
 * over the US+CA(+MX) grid and sets brand_confirmed=true (handled by the base).
 *
 * All requests are proxy-routed (useProxy via base). NOTE: OEM locators are CDN/
 * bot-protected, so these only return data through PROXY_URL pointed at a non-blocked
 * IP. Endpoint shapes below follow each brand's documented public locator; the generic
 * parser (findDealerArray + dealerToRecord) tolerates field/shape variation, and any
 * adapter that 4xx's degrades to zero (logged) rather than breaking the run. Validate
 * the exact endpoints against the live sites once a proxy is available.
 */

const BROWSER = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
};

const ARRAY_KEYS = ["dealers", "Dealers", "dealerList", "DealerList", "results", "data", "items", "locations"];

/** Standard lat/lng JSON locator config. */
function locator(
  oem: string,
  url: (p: GridPoint, radiusMi: number) => string,
  opts: { headers?: Record<string, string>; arrayKeys?: string[]; radiusMi?: number } = {}
): OemLocatorConfig {
  return {
    name: `oem:${oem.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    oem,
    radiusMi: opts.radiusMi ?? 75,
    buildRequest: (p, r) => ({ url: url(p, r), headers: { ...BROWSER, ...opts.headers } }),
    parse: (json) => findDealerArray(json, opts.arrayKeys ?? ARRAY_KEYS).map(dealerToRecord),
  };
}

// GM — unified "quantum" dealer locator; makeCodes differ per brand.
const GM = (brand: string, makeCode: string) =>
  locator(
    brand,
    (p, r) =>
      `https://www.${brand.toLowerCase()}.com/bypass/pcf/quantum-dealer-locator/v1/getDealers` +
      `?desiredCount=25&distance=${r}&latitude=${p.lat}&longitude=${p.lng}&makeCodes=${makeCode}`,
    { arrayKeys: ["dealers", "data", "results"] }
  );

// Stellantis brands — shared dealer-locator backend (BLM); brandCode per make.
const STELLANTIS = (brand: string, brandCode: string) =>
  locator(
    brand,
    (p, r) =>
      `https://www.${brand.toLowerCase().replace(/\s+/g, "")}.com/hostd/dealerLocator/getDealersByLatLng.json` +
      `?brandCode=${brandCode}&latitude=${p.lat}&longitude=${p.lng}&radius=${r}&maxResults=25`,
    { arrayKeys: ["dealers", "dealerList", "data"] }
  );

// Honda platform (Honda already wired); Acura = productDivisionCode B.
const HONDA_PLATFORM = (oem: string, division: string) =>
  locator(
    oem,
    (p, r) =>
      `https://automobiles.honda.com/platform/api/v3/dealers` +
      `?productDivisionCode=${division}&excludeServiceCenters=false&latitude=${p.lat}&longitude=${p.lng}&maxResults=25&radius=${r}`,
    { arrayKeys: ["Dealers", "dealers"] }
  );

export const OEM_CONFIGS: OemLocatorConfig[] = [
  // General Motors
  GM("Chevrolet", "001"),
  GM("Buick", "002"),
  GM("GMC", "003"),
  GM("Cadillac", "006"),
  // Stellantis
  STELLANTIS("Chrysler", "C"),
  STELLANTIS("Dodge", "D"),
  STELLANTIS("Jeep", "J"),
  STELLANTIS("Ram", "R"),
  // Honda family
  HONDA_PLATFORM("Acura", "B"),
  // Hyundai Motor Group
  locator("Hyundai", (p, r) => `https://www.hyundaiusa.com/var/hyundai/services/dealer/dealersByLatLong.json?lat=${p.lat}&long=${p.lng}&maxdealers=25&radius=${r}`),
  locator("Kia", (p, r) => `https://www.kia.com/us/services/en/dealers/search?long=${p.lng}&lat=${p.lat}&radius=${r}&max=25`),
  locator("Genesis", (p, r) => `https://www.genesis.com/us/en/services/dealers.json?lat=${p.lat}&lng=${p.lng}&radius=${r}`),
  // Nissan
  locator("Nissan", (p, r) => `https://www.nissanusa.com/bin/dealers?lat=${p.lat}&lng=${p.lng}&radius=${r}&max=25`),
  locator("Infiniti", (p, r) => `https://www.infinitiusa.com/bin/dealers?lat=${p.lat}&lng=${p.lng}&radius=${r}`),
  // Independents
  locator("Subaru", (p, r) => `https://www.subaru.com/services/dealers/by/distance?lat=${p.lat}&long=${p.lng}&count=25&radius=${r}`),
  locator("Mazda", (p, r) => `https://www.mazdausa.com/api/v1/dealers?latitude=${p.lat}&longitude=${p.lng}&radius=${r}&max=25`),
  locator("Mitsubishi", (p, r) => `https://www.mitsubishicars.com/api/dealers?lat=${p.lat}&lng=${p.lng}&radius=${r}`),
  // Volkswagen Group
  locator("Volkswagen", (p, r) => `https://www.vw.com/api/dealers?latitude=${p.lat}&longitude=${p.lng}&radius=${r}&maxResults=25`),
  locator("Audi", (p, r) => `https://www.audiusa.com/bin/dealers?lat=${p.lat}&lng=${p.lng}&radius=${r}`),
  locator("Porsche", (p, r) => `https://www.porsche.com/usa/api/dealers?lat=${p.lat}&lng=${p.lng}&radius=${r}`),
  // German luxury
  locator("BMW", (p, r) => `https://www.bmwusa.com/bin/api/dealers?lat=${p.lat}&lng=${p.lng}&radius=${r}&max=25`),
  locator("Mini", (p, r) => `https://www.miniusa.com/bin/api/dealers?lat=${p.lat}&lng=${p.lng}&radius=${r}`),
  locator("Mercedes-Benz", (p, r) => `https://www.mbusa.com/en/dealers/search?lat=${p.lat}&lng=${p.lng}&radius=${r}&max=25`),
  // Toyota luxury
  locator("Lexus", (p, r) => `https://www.lexus.com/dealers/byLatLong?latitude=${p.lat}&longitude=${p.lng}&radius=${r}`),
  // Volvo
  locator("Volvo", (p, r) => `https://www.volvocars.com/api/retailers?lat=${p.lat}&lng=${p.lng}&radius=${r}&market=us`),
];

export const registryOemSources: Source[] = OEM_CONFIGS.map(createOemSource);
