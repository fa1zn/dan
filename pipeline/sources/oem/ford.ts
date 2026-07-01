import { createOemSource } from "./base";
import { dealerToRecord, findDealerArray } from "./parse-util";

/**
 * Ford (US/CA) dealer locator.  Endpoint moved; current one is TOKEN-GATED and
 * blocked from the proxy (July 2026).
 *
 * The old …/services/dealer/v2/ path is dead (HTTP 404). Ford's live locator is:
 *   GET https://www.ford.com/cxservices/dealer/Dealers.json
 *       ?make=Ford&radius=75&minDealers=1&maxDealers=100&postalCode=<zip>
 *   headers: { application-id: <uuid from ford.com>, x-requested-with: XMLHttpRequest }
 *   Response: { Response: { Dealer: [{ PACode, Name, Address:{ Street1, City, State,
 *     Zip }, Phone, Latitude, Longitude, dealerType }] } }.
 *
 * It requires a valid `application-id` header AND an Akamai session cookie minted by
 * loading ford.com first. Called directly through the proxy it returns HTTP 401
 * (Unauthorized) — the static app-id alone is no longer sufficient. See
 * ./crawl-ford.mjs for the Playwright approach that loads the page then calls the
 * endpoint with the header. URL/shape below document the current path.
 */
export const fordSource = createOemSource({
  name: "oem:ford",
  oem: "Ford",
  radiusMi: 75,
  buildRequest(point, radiusMi) {
    const url =
      `https://www.ford.com/cxservices/dealer/Dealers.json` +
      `?make=Ford&radius=${radiusMi}&minDealers=1&maxDealers=100&latitude=${point.lat}&longitude=${point.lng}`;
    return {
      url,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "application/json",
        "application-id": "07152898-698b-456e-be56-d3d83011d0a6",
        "x-requested-with": "XMLHttpRequest",
        Referer: "https://www.ford.com/dealerships/",
      },
    };
  },
  parse(json) {
    return findDealerArray(json, ["Dealer", "dealers", "Dealers", "dealerList", "results"]).map(dealerToRecord);
  },
});
