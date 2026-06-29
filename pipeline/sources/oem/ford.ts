import { createOemSource } from "./base";
import { dealerToRecord, findDealerArray } from "./parse-util";

/**
 * Ford (US/CA) dealer locator.
 *
 * Queried by lat/lng with make=Ford. Like the other OEMs, Ford bot-protects this
 * endpoint; the adapter returns 0 from a blocked network (logged). Response shape:
 * { dealers: [{ dealerId, name, streetAddress, city, state, postalCode, phone, url,
 * latitude, longitude }] }.
 */
export const fordSource = createOemSource({
  name: "oem:ford",
  oem: "Ford",
  radiusMi: 75,
  buildRequest(point, radiusMi) {
    const url =
      `https://www.ford.com/services/dealer/v2/` +
      `?make=Ford&latitude=${point.lat}&longitude=${point.lng}&maxDealers=50&radius=${radiusMi}`;
    return {
      url,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json",
        Referer: "https://www.ford.com/dealerships/",
      },
    };
  },
  parse(json) {
    return findDealerArray(json, ["dealers", "Dealers", "dealerList", "results"]).map(dealerToRecord);
  },
});
