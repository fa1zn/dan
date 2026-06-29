import type { RawRecord } from "../types";

/** Case-insensitive, multi-key getter for loosely-typed locator payloads. */
export function pick(obj: Record<string, unknown>, keys: string[]): string | undefined {
  const lowerMap = new Map(Object.keys(obj).map((k) => [k.toLowerCase(), k]));
  for (const key of keys) {
    const real = lowerMap.get(key.toLowerCase());
    if (real != null) {
      const v = obj[real];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
  }
  return undefined;
}

export function pickNum(obj: Record<string, unknown>, keys: string[]): number | undefined {
  const s = pick(obj, keys);
  if (s == null) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Find the first array of dealer objects under any of the candidate keys (deep-ish). */
export function findDealerArray(json: unknown, candidateKeys: string[]): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      if (candidateKeys.some((c) => c.toLowerCase() === k.toLowerCase()) && Array.isArray(obj[k])) {
        return obj[k] as Record<string, unknown>[];
      }
    }
    // One level deeper (payloads often wrap dealers under data/result).
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v && typeof v === "object") {
        const nested = findDealerArray(v, candidateKeys);
        if (nested.length) return nested;
      }
    }
  }
  return [];
}

/** Build a RawRecord from a flat dealer object using common field-name variants. */
export function dealerToRecord(d: Record<string, unknown>): RawRecord {
  const street =
    pick(d, ["address1", "streetAddress", "address", "addressLine1", "street", "dealerAddress"]) ?? undefined;
  return {
    source: "oem",
    name: pick(d, ["name", "dealerName", "displayName", "Name"]) ?? "Unknown Dealer",
    website: pick(d, ["url", "website", "websiteUrl", "dealerWebAddress", "webAddress", "siteUrl"]),
    phone: pick(d, ["phone", "phoneNumber", "generalPhone", "primaryPhone", "salesPhone", "Phone"]),
    email: pick(d, ["email", "emailAddress"]),
    address_street: street,
    city: pick(d, ["city", "City", "dealerCity"]),
    state_province: pick(d, ["state", "stateProvince", "region", "State"]),
    postal_code: pick(d, ["zip", "zipCode", "postalCode", "postcode", "ZipCode"]),
    lat: pickNum(d, ["latitude", "lat", "Latitude"]),
    lng: pickNum(d, ["longitude", "lng", "lon", "Longitude"]),
    raw: { dealerId: pick(d, ["code", "dealerId", "dealerNumber", "id", "DealerNumber"]), ...d },
  };
}
