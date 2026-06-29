import type { Country } from "../types";

/**
 * Bounding box in Overpass order: [south, west, north, east] (lat, lng, lat, lng).
 * Boxes are approximate state/province envelopes — they intentionally over-cover
 * so no dealer is missed; cross-border bleed is removed downstream by the
 * state_province tag on each record.
 */
export interface Region {
  code: string;
  name: string;
  country: Country;
  bbox: [number, number, number, number];
}

export const US_STATES: Region[] = [
  { code: "AL", name: "Alabama", country: "US", bbox: [30.1, -88.5, 35.1, -84.9] },
  { code: "AK", name: "Alaska", country: "US", bbox: [51.2, -179.2, 71.5, -129.9] },
  { code: "AZ", name: "Arizona", country: "US", bbox: [31.3, -114.9, 37.1, -109.0] },
  { code: "AR", name: "Arkansas", country: "US", bbox: [33.0, -94.7, 36.6, -89.6] },
  { code: "CA", name: "California", country: "US", bbox: [32.5, -124.5, 42.1, -114.1] },
  { code: "CO", name: "Colorado", country: "US", bbox: [36.9, -109.1, 41.1, -102.0] },
  { code: "CT", name: "Connecticut", country: "US", bbox: [40.9, -73.8, 42.1, -71.7] },
  { code: "DE", name: "Delaware", country: "US", bbox: [38.4, -75.8, 39.9, -75.0] },
  { code: "DC", name: "District of Columbia", country: "US", bbox: [38.8, -77.2, 39.0, -76.9] },
  { code: "FL", name: "Florida", country: "US", bbox: [24.4, -87.7, 31.1, -79.9] },
  { code: "GA", name: "Georgia", country: "US", bbox: [30.3, -85.7, 35.1, -80.8] },
  { code: "HI", name: "Hawaii", country: "US", bbox: [18.8, -160.3, 22.3, -154.7] },
  { code: "ID", name: "Idaho", country: "US", bbox: [41.9, -117.3, 49.1, -110.9] },
  { code: "IL", name: "Illinois", country: "US", bbox: [36.9, -91.6, 42.6, -87.4] },
  { code: "IN", name: "Indiana", country: "US", bbox: [37.7, -88.2, 41.8, -84.7] },
  { code: "IA", name: "Iowa", country: "US", bbox: [40.3, -96.7, 43.6, -90.1] },
  { code: "KS", name: "Kansas", country: "US", bbox: [36.9, -102.1, 40.1, -94.5] },
  { code: "KY", name: "Kentucky", country: "US", bbox: [36.4, -89.7, 39.2, -81.9] },
  { code: "LA", name: "Louisiana", country: "US", bbox: [28.8, -94.1, 33.1, -88.7] },
  { code: "ME", name: "Maine", country: "US", bbox: [42.9, -71.2, 47.6, -66.9] },
  { code: "MD", name: "Maryland", country: "US", bbox: [37.8, -79.5, 39.8, -75.0] },
  { code: "MA", name: "Massachusetts", country: "US", bbox: [41.2, -73.6, 42.9, -69.9] },
  { code: "MI", name: "Michigan", country: "US", bbox: [41.6, -90.5, 48.4, -82.3] },
  { code: "MN", name: "Minnesota", country: "US", bbox: [43.4, -97.3, 49.5, -89.4] },
  { code: "MS", name: "Mississippi", country: "US", bbox: [30.1, -91.7, 35.1, -88.0] },
  { code: "MO", name: "Missouri", country: "US", bbox: [35.9, -95.9, 40.7, -89.0] },
  { code: "MT", name: "Montana", country: "US", bbox: [44.3, -116.1, 49.1, -103.9] },
  { code: "NE", name: "Nebraska", country: "US", bbox: [39.9, -104.1, 43.1, -95.2] },
  { code: "NV", name: "Nevada", country: "US", bbox: [35.0, -120.1, 42.1, -114.0] },
  { code: "NH", name: "New Hampshire", country: "US", bbox: [42.6, -72.6, 45.4, -70.6] },
  { code: "NJ", name: "New Jersey", country: "US", bbox: [38.8, -75.6, 41.4, -73.9] },
  { code: "NM", name: "New Mexico", country: "US", bbox: [31.3, -109.1, 37.1, -102.9] },
  { code: "NY", name: "New York", country: "US", bbox: [40.4, -79.8, 45.1, -71.8] },
  { code: "NC", name: "North Carolina", country: "US", bbox: [33.8, -84.4, 36.6, -75.4] },
  { code: "ND", name: "North Dakota", country: "US", bbox: [45.9, -104.1, 49.1, -96.5] },
  { code: "OH", name: "Ohio", country: "US", bbox: [38.4, -84.9, 42.0, -80.5] },
  { code: "OK", name: "Oklahoma", country: "US", bbox: [33.6, -103.1, 37.1, -94.4] },
  { code: "OR", name: "Oregon", country: "US", bbox: [41.9, -124.6, 46.3, -116.4] },
  { code: "PA", name: "Pennsylvania", country: "US", bbox: [39.7, -80.6, 42.3, -74.7] },
  { code: "RI", name: "Rhode Island", country: "US", bbox: [41.1, -71.9, 42.1, -71.1] },
  { code: "SC", name: "South Carolina", country: "US", bbox: [32.0, -83.4, 35.3, -78.5] },
  { code: "SD", name: "South Dakota", country: "US", bbox: [42.4, -104.1, 45.9, -96.4] },
  { code: "TN", name: "Tennessee", country: "US", bbox: [34.9, -90.4, 36.7, -81.6] },
  { code: "TX", name: "Texas", country: "US", bbox: [25.8, -106.7, 36.5, -93.5] },
  { code: "UT", name: "Utah", country: "US", bbox: [36.9, -114.1, 42.1, -109.0] },
  { code: "VT", name: "Vermont", country: "US", bbox: [42.7, -73.5, 45.1, -71.5] },
  { code: "VA", name: "Virginia", country: "US", bbox: [36.5, -83.7, 39.5, -75.2] },
  { code: "WA", name: "Washington", country: "US", bbox: [45.5, -124.9, 49.1, -116.9] },
  { code: "WV", name: "West Virginia", country: "US", bbox: [37.2, -82.7, 40.7, -77.7] },
  { code: "WI", name: "Wisconsin", country: "US", bbox: [42.4, -92.9, 47.1, -86.8] },
  { code: "WY", name: "Wyoming", country: "US", bbox: [40.9, -111.1, 45.1, -104.0] },
];

export const CA_PROVINCES: Region[] = [
  { code: "AB", name: "Alberta", country: "CA", bbox: [48.9, -120.1, 60.1, -109.9] },
  { code: "BC", name: "British Columbia", country: "CA", bbox: [48.2, -139.1, 60.1, -114.0] },
  { code: "MB", name: "Manitoba", country: "CA", bbox: [48.9, -102.1, 60.1, -88.9] },
  { code: "NB", name: "New Brunswick", country: "CA", bbox: [44.5, -69.1, 48.1, -63.7] },
  { code: "NL", name: "Newfoundland and Labrador", country: "CA", bbox: [46.6, -67.9, 60.4, -52.6] },
  { code: "NS", name: "Nova Scotia", country: "CA", bbox: [43.3, -66.4, 47.1, -59.7] },
  { code: "NT", name: "Northwest Territories", country: "CA", bbox: [60.0, -136.5, 70.0, -102.0] },
  { code: "NU", name: "Nunavut", country: "CA", bbox: [60.0, -110.0, 73.0, -61.0] },
  { code: "ON", name: "Ontario", country: "CA", bbox: [41.6, -95.2, 56.9, -74.3] },
  { code: "PE", name: "Prince Edward Island", country: "CA", bbox: [45.9, -64.5, 47.1, -61.9] },
  { code: "QC", name: "Quebec", country: "CA", bbox: [45.0, -79.8, 62.6, -57.1] },
  { code: "SK", name: "Saskatchewan", country: "CA", bbox: [48.9, -110.1, 60.1, -101.3] },
  { code: "YT", name: "Yukon", country: "CA", bbox: [60.0, -141.1, 69.7, -123.8] },
];

/** Mexico is queried as a single national envelope; only used when ENABLE_MEXICO=1. */
export const MX_REGIONS: Region[] = [
  { code: "MX", name: "Mexico", country: "MX", bbox: [14.5, -118.5, 32.8, -86.7] },
];

export function regionsForCountries(enableMexico: boolean): Region[] {
  const regions = [...US_STATES, ...CA_PROVINCES];
  if (enableMexico) regions.push(...MX_REGIONS);
  return regions;
}
