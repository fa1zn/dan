import { createOemSource } from "./base";
import { dealerToRecord, findDealerArray } from "./parse-util";

/**
 * Toyota (US/CA) dealer locator.
 *
 * Public locator JSON, queried by lat/lng + radius. Toyota fronts this with a CDN
 * that bot-protects automated clients; from a blocked network every request 4xx's
 * and the adapter yields 0 (logged clearly). The request/parse shape below matches
 * the locator's documented response: { dealers: [{ code, name, address1, city,
 * state, zip, phone, url, latitude, longitude }] }.
 */
export const toyotaSource = createOemSource({
  name: "oem:toyota",
  oem: "Toyota",
  radiusMi: 75,
  buildRequest(point, radiusMi) {
    const url =
      `https://www.toyota.com/dealers/dealersByLatLong/` +
      `?latitude=${point.lat}&longitude=${point.lng}&radius=${radiusMi}`;
    return {
      url,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json",
        Referer: "https://www.toyota.com/dealers/",
      },
    };
  },
  parse(json) {
    return findDealerArray(json, ["dealers", "Dealers", "dealerList", "results"]).map(dealerToRecord);
  },
});
