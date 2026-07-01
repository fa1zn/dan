import { createOemSource } from "./base";
import { dealerToRecord, findDealerArray } from "./parse-util";

/**
 * Toyota (US/CA) dealer locator.  CURRENT endpoint identified, but WAF-BLOCKED
 * from the Bright Data proxy (July 2026).
 *
 * The old www.toyota.com/dealers/dealersByLatLong path is gone. The live page now
 * calls a dedicated REST host:
 *   GET https://dealers.prod.webservices.toyota.com/v1/dealers/?zipcode=<zip>
 *   (or ?latitude=<lat>&longitude=<lng> — both required; short lat/long rejected)
 * Response: { numDealer, totalDealer, dealers: [{ dealerId/code, name, address1,
 *   city, state, zip, lat, long, phone, url, distance }], success }.
 *
 * That host sits behind CloudFront + AWS-WAF which rejects the proxy's non-browser
 * TLS fingerprint (403 "Request blocked" / 502 through the Web Unlocker). It DOES
 * respond from a real browser-TLS context with Referer https://www.toyota.com/.
 * To populate Toyota, fetch this endpoint with Playwright/curl-impersonate. The
 * URL + parse shape below are the verified-correct ones for that path.
 */
export const toyotaSource = createOemSource({
  name: "oem:toyota",
  oem: "Toyota",
  radiusMi: 75,
  buildRequest(point) {
    const url =
      `https://dealers.prod.webservices.toyota.com/v1/dealers/` +
      `?latitude=${point.lat}&longitude=${point.lng}`;
    return {
      url,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "application/json",
        Referer: "https://www.toyota.com/",
      },
    };
  },
  parse(json) {
    return findDealerArray(json, ["dealers", "Dealers", "dealerList", "results"]).map(dealerToRecord);
  },
});
