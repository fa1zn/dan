import { createOemSource } from "./base";
import { dealerToRecord, findDealerArray } from "./parse-util";

/**
 * Honda (US) dealer locator.  VERIFIED WORKING through PROXY_URL (July 2026).
 *
 * The old v3 lat/lng path (…/platform/api/v3/dealers) now returns an HTML
 * "Access Denied" page. The CURRENT working endpoint is the v1 ZIP-based one:
 *   GET https://automobiles.honda.com/platform/api/v1/dealer
 *       ?productDivisionCode=A&excludeServiceCenters=true&zip=<zip>&maxResults=50
 * productDivisionCode "A" selects Honda Automobiles. Response shape:
 *   { ZipCode, Dealers: [{ DealerNumber, Name, Address, City, State, ZipCode,
 *     Phone, WebAddress, Latitude, Longitude, IsServiceCenter }] }.
 *
 * NOTE: this locator keys off ZIP, not lat/lng. The zip-driven live fetcher lives
 * in ./locators-live.ts (LIVE_LOCATORS.Honda) and is what the franchise-gate step
 * calls. The grid-walking adapter below maps its GridPoint to the nearest ZIP via
 * a reverse lookup is out of scope; kept here for endpoint/shape documentation and
 * so `dealerToRecord` (case-insensitive) still parses the payload when a ZIP is passed.
 */
export const hondaSource = createOemSource({
  name: "oem:honda",
  oem: "Honda",
  radiusMi: 75,
  buildRequest(point) {
    // buildRequest receives lat/lng grid points; Honda's live endpoint is ZIP-keyed.
    // The proxy-verified call is done zip-first in locators-live.ts. This URL is left
    // as the documented v1 shape (lat/lng accepted only as a fallback query, may 404).
    const url =
      `https://automobiles.honda.com/platform/api/v1/dealer` +
      `?productDivisionCode=A&excludeServiceCenters=true&latitude=${point.lat}&longitude=${point.lng}&maxResults=50`;
    return {
      url,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "application/json",
        Referer: "https://automobiles.honda.com/tools/dealership-locator",
      },
    };
  },
  parse(json) {
    return findDealerArray(json, ["Dealers", "dealers", "DealerList", "results"]).map(dealerToRecord);
  },
});
