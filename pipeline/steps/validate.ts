// Use the `core` build with explicitly-imported metadata: the prebundled
// metadata in the default entrypoint mis-resolves to `{ default }` under tsx's
// JSON/ESM interop, which breaks the convenience exports.
import { isValidPhoneNumber } from "libphonenumber-js/core";
import phoneMetadata from "libphonenumber-js/metadata.min.json";
import { CONFIG } from "../config";
import { fetchText } from "../lib/http";
import type { MasterRecord } from "../../lib/types";
import { loadAll, updateValidation } from "./persist";

/** Hosts that are valid URLs but are not a dealer's own website. */
const NON_DEALER_HOSTS = new Set([
  "facebook.com", "m.facebook.com", "instagram.com", "yelp.com", "google.com",
  "maps.google.com", "twitter.com", "x.com", "youtube.com", "cars.com",
  "cargurus.com", "carfax.com", "edmunds.com", "linktr.ee",
]);

function dealerDomainSane(website: string | null): boolean {
  if (!website) return false;
  try {
    const host = new URL(website).hostname.replace(/^www\./, "").toLowerCase();
    return !NON_DEALER_HOSTS.has(host);
  } catch {
    return false;
  }
}

/** GET the site (cached), follow redirects, require 2xx + dealer-domain sanity. */
async function checkWebsite(website: string): Promise<boolean> {
  const res = await fetchText(website, {
    cacheNs: "website-check",
    timeoutMs: CONFIG.validate.timeoutMs,
    retries: 1,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,*/*",
    },
  });
  return res.ok && dealerDomainSane(res.url);
}

export function checkPhone(phone: string | null, country: string | null): boolean {
  if (!phone) return false;
  const region = country === "CA" || country === "MX" ? country : "US";
  try {
    return isValidPhoneNumber(phone, region, phoneMetadata as never);
  } catch {
    return false;
  }
}

export function brandConfirmedFromSource(source: string, existing: boolean): boolean {
  return existing || source.split("+").some((s) => s.startsWith("oem:"));
}

/** Run `tasks` with bounded concurrency. */
async function pool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

export async function runValidate(): Promise<{ phoneChecked: number; websiteChecked: number }> {
  const rows = loadAll();

  // Phone + brand validation is cheap & local — do it for every row.
  for (const r of rows) {
    r.phoneValid = r.phone ? checkPhone(r.phone, r.country) : null;
    r.brandConfirmed = brandConfirmedFromSource(r.source, r.brandConfirmed);
  }

  // Website validation hits the network — cap and pool it.
  const withSite = rows.filter((r) => r.website);
  const cap = CONFIG.validate.maxWebsites > 0 ? CONFIG.validate.maxWebsites : withSite.length;
  const toCheck = withSite.slice(0, cap);
  const checking = new Set(toCheck);

  let websiteChecked = 0;
  await pool(toCheck, CONFIG.validate.concurrency, async (r: MasterRecord) => {
    r.websiteValid = await checkWebsite(r.website!);
    websiteChecked++;
    if (websiteChecked % 50 === 0) console.log(`  [validate] websites checked: ${websiteChecked}/${toCheck.length}`);
  });

  // Rows with a website we didn't probe this run keep websiteValid = null (unknown).
  for (const r of rows) {
    if (r.website && !checking.has(r)) r.websiteValid = r.websiteValid ?? null;
    if (!r.website) r.websiteValid = null;
    if (r.id != null) {
      updateValidation(r.id, {
        websiteValid: r.websiteValid,
        phoneValid: r.phoneValid,
        brandConfirmed: r.brandConfirmed,
      });
    }
  }

  return { phoneChecked: rows.filter((r) => r.phone).length, websiteChecked };
}
