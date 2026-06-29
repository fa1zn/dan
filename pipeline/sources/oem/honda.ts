import { createOemSource } from "./base";
import { dealerToRecord, findDealerArray } from "./parse-util";

/**
 * Honda (US) dealer locator.
 *
 * productDivisionCode "A" selects Honda Automobiles. Honda's endpoint sits behind
 * Akamai and returns "Access Denied" to non-browser clients; the adapter degrades
 * gracefully in that case. Response shape: { Dealers: [{ DealerNumber, Name,
 * Address, City, State, ZipCode, Phone, DealerWebAddress, Latitude, Longitude }] }.
 */
export const hondaSource = createOemSource({
  name: "oem:honda",
  oem: "Honda",
  radiusMi: 75,
  buildRequest(point, radiusMi) {
    const url =
      `https://automobiles.honda.com/platform/api/v3/dealers` +
      `?productDivisionCode=A&excludeServiceCenters=false` +
      `&latitude=${point.lat}&longitude=${point.lng}&maxResults=50&radius=${radiusMi}`;
    return {
      url,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json",
        Referer: "https://automobiles.honda.com/tools/dealership-locator",
      },
    };
  },
  parse(json) {
    return findDealerArray(json, ["Dealers", "dealers", "DealerList", "results"]).map(dealerToRecord);
  },
});
