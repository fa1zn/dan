// Shared domain types for the dealership system of record.

export type Country = "US" | "CA" | "MX";

export type Tier = "A" | "B";

/** A contact attached to a dealership. Phase 1 leaves this empty (enrichment is Phase 3+). */
export interface Contact {
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  source?: string;
}

/**
 * RawRecord is the loose, source-shaped record produced by a Source adapter's fetch().
 * Adapters do the minimum mapping to these common fields; full normalization happens
 * in the normalize step. `raw` carries the untouched payload for debugging/auditing.
 */
export interface RawRecord {
  source: string;
  oem?: string;
  name?: string;
  website?: string;
  phone?: string;
  email?: string;
  address_street?: string;
  city?: string;
  state_province?: string;
  postal_code?: string;
  country?: Country | string;
  lat?: number;
  lng?: number;
  group_name?: string;
  /** Set true by OEM-locator sources; OSM does not confirm brand affiliation. */
  brand_confirmed?: boolean;
  raw?: unknown;
}

/** MasterRecord mirrors the `dealerships` table (camelCase view of the columns). */
export interface MasterRecord {
  id?: number;
  name: string;
  oem: string | null;
  groupName: string | null;
  groupSize: number | null;
  website: string | null;
  domain: string | null;
  addressStreet: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  country: string | null;
  territory: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  toolsUsed: string[];
  contacts: Contact[];
  tier: Tier | null;
  source: string;
  websiteValid: boolean | null;
  phoneValid: boolean | null;
  brandConfirmed: boolean;
  dedupKey: string;
  createdAt: string;
  updatedAt: string;
}
