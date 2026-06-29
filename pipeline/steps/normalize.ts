import { z } from "zod";
import type { MasterRecord, RawRecord } from "../../lib/types";
import { deriveTerritory } from "../../lib/geo/territory";

const collapse = (s: string | undefined | null): string | null => {
  if (!s) return null;
  const t = String(s).replace(/\s+/g, " ").trim();
  return t === "" ? null : t;
};

/** Normalize a website to a canonical absolute URL, or null if unusable. */
export function normalizeWebsite(raw: string | undefined | null): string | null {
  const v = collapse(raw);
  if (!v) return null;
  let url = v;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    const u = new URL(url);
    if (!u.hostname.includes(".")) return null;
    u.hash = "";
    u.search = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** Registrable domain-ish host derived from a website (drops www. and protocol). */
export function deriveDomain(website: string | null): string | null {
  if (!website) return null;
  try {
    return new URL(website).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

const normState = (s: string | undefined | null): string | null => {
  const v = collapse(s);
  if (!v) return null;
  return v.length <= 3 ? v.toUpperCase() : v;
};

const normPostal = (s: string | undefined | null, country: string | null): string | null => {
  const v = collapse(s);
  if (!v) return null;
  const up = v.toUpperCase();
  if (country === "US") return up.slice(0, 5).replace(/[^0-9]/g, "") || up;
  return up; // CA/MX keep alphanumerics as-is
};

function normAddressKeyPart(...parts: (string | null)[]): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[.,#]/g, "")
    .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|highway|hwy|suite|ste|unit)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Deterministic dedupe key. Priority:
 *   1. oem + a REAL street address (+ city/postal) — the strongest signal;
 *   2. oem + geo cell (~110m) — merges a dealer's node+way pair without collapsing
 *      distinct same-brand rooftops that happen to lack a street address;
 *   3. oem + domain;
 *   4. oem + name + city (last resort).
 *
 * Critically, a street-less record never keys on oem+state alone (which would merge
 * every same-brand dealer in a whole state) — it uses its coordinates instead.
 */
export function buildDedupKey(r: {
  oem: string | null;
  addressStreet: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  domain: string | null;
  name: string;
  lat?: number | null;
  lng?: number | null;
}): string {
  const oem = (r.oem ?? "?").toLowerCase();
  const street = normAddressKeyPart(r.addressStreet);
  if (street) {
    const loc = normAddressKeyPart(r.city, r.stateProvince, r.postalCode);
    return `${oem}|addr|${street}|${loc}`;
  }
  if (r.lat != null && r.lng != null) {
    return `${oem}|geo|${r.lat.toFixed(3)}|${r.lng.toFixed(3)}`;
  }
  if (r.domain) return `${oem}|dom|${r.domain}`;
  return `${oem}|name|${normAddressKeyPart(r.name, r.city, r.stateProvince, r.postalCode)}`;
}

const masterSchema = z.object({
  name: z.string().min(1),
  oem: z.string().min(1).nullable(),
});

/** Map a RawRecord to a fully-normalized MasterRecord (or null if invalid). */
export function toMaster(raw: RawRecord, now: string): MasterRecord | null {
  const name = collapse(raw.name);
  if (!name) return null;
  const oem = collapse(raw.oem);

  const website = normalizeWebsite(raw.website);
  const domain = deriveDomain(website);
  const country = collapse(raw.country);
  const stateProvince = normState(raw.state_province);

  const base = {
    name,
    oem,
    addressStreet: collapse(raw.address_street),
    city: collapse(raw.city),
    stateProvince,
    postalCode: normPostal(raw.postal_code, country),
    domain,
  };

  const parsed = masterSchema.safeParse({ name, oem });
  if (!parsed.success) return null;

  return {
    name,
    oem,
    groupName: collapse(raw.group_name),
    groupSize: null,
    website,
    domain,
    addressStreet: base.addressStreet,
    city: base.city,
    stateProvince,
    postalCode: base.postalCode,
    country,
    territory: deriveTerritory(stateProvince, country),
    latitude: typeof raw.lat === "number" ? raw.lat : null,
    longitude: typeof raw.lng === "number" ? raw.lng : null,
    phone: collapse(raw.phone),
    email: collapse(raw.email),
    toolsUsed: [],
    contacts: [],
    tier: null,
    source: raw.source,
    websiteValid: null,
    phoneValid: null,
    brandConfirmed: raw.brand_confirmed === true,
    dedupKey: buildDedupKey({ ...base, name, lat: raw.lat, lng: raw.lng }),
    createdAt: now,
    updatedAt: now,
  };
}
