import { getSqlite } from "../../lib/db";
import type { Contact, MasterRecord, Tier } from "../../lib/types";

interface Row {
  id: number;
  name: string;
  oem: string | null;
  group_name: string | null;
  group_size: number | null;
  website: string | null;
  domain: string | null;
  address_street: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string | null;
  territory: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  tools_used: string | null;
  contacts: string | null;
  tier: string | null;
  source: string;
  website_valid: number | null;
  phone_valid: number | null;
  brand_confirmed: number;
  dedup_key: string;
  created_at: string;
  updated_at: string;
}

const b2i = (b: boolean | null): number | null => (b == null ? null : b ? 1 : 0);
const i2b = (i: number | null): boolean | null => (i == null ? null : i !== 0);

function rowToMaster(r: Row): MasterRecord {
  return {
    id: r.id,
    name: r.name,
    oem: r.oem,
    groupName: r.group_name,
    groupSize: r.group_size,
    website: r.website,
    domain: r.domain,
    addressStreet: r.address_street,
    city: r.city,
    stateProvince: r.state_province,
    postalCode: r.postal_code,
    country: r.country,
    territory: r.territory,
    latitude: r.latitude,
    longitude: r.longitude,
    phone: r.phone,
    email: r.email,
    toolsUsed: safeJson<string[]>(r.tools_used, []),
    contacts: safeJson<Contact[]>(r.contacts, []),
    tier: (r.tier as Tier | null) ?? null,
    source: r.source,
    websiteValid: i2b(r.website_valid),
    phoneValid: i2b(r.phone_valid),
    brandConfirmed: i2b(r.brand_confirmed) ?? false,
    dedupKey: r.dedup_key,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function safeJson<T>(s: string | null, dflt: T): T {
  if (!s) return dflt;
  try {
    return JSON.parse(s) as T;
  } catch {
    return dflt;
  }
}

/** Replace the entire table with `records` (used by normalize & dedupe). */
export function replaceAll(records: MasterRecord[]): void {
  const db = getSqlite();
  const insert = db.prepare(`
    INSERT INTO dealerships
      (name, oem, group_name, group_size, website, domain, address_street, city,
       state_province, postal_code, country, territory, latitude, longitude, phone, email, tools_used,
       contacts, tier, source, website_valid, phone_valid, brand_confirmed,
       dedup_key, created_at, updated_at)
    VALUES
      (@name, @oem, @group_name, @group_size, @website, @domain, @address_street, @city,
       @state_province, @postal_code, @country, @territory, @latitude, @longitude, @phone, @email, @tools_used,
       @contacts, @tier, @source, @website_valid, @phone_valid, @brand_confirmed,
       @dedup_key, @created_at, @updated_at)
  `);

  const tx = db.transaction((rows: MasterRecord[]) => {
    db.exec("DELETE FROM dealerships");
    for (const r of rows) {
      insert.run({
        name: r.name,
        oem: r.oem,
        group_name: r.groupName,
        group_size: r.groupSize,
        website: r.website,
        domain: r.domain,
        address_street: r.addressStreet,
        city: r.city,
        state_province: r.stateProvince,
        postal_code: r.postalCode,
        country: r.country,
        territory: r.territory,
        latitude: r.latitude,
        longitude: r.longitude,
        phone: r.phone,
        email: r.email,
        tools_used: JSON.stringify(r.toolsUsed ?? []),
        contacts: JSON.stringify(r.contacts ?? []),
        tier: r.tier,
        source: r.source,
        website_valid: b2i(r.websiteValid),
        phone_valid: b2i(r.phoneValid),
        brand_confirmed: b2i(r.brandConfirmed) ?? 0,
        dedup_key: r.dedupKey,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
      });
    }
  });
  tx(records);
}

export function loadAll(): MasterRecord[] {
  const db = getSqlite();
  const rows = db.prepare("SELECT * FROM dealerships ORDER BY id").all() as Row[];
  return rows.map(rowToMaster);
}

export function countRows(): number {
  const db = getSqlite();
  return (db.prepare("SELECT COUNT(*) AS n FROM dealerships").get() as { n: number }).n;
}

/** Persist per-row validation results. */
export function updateValidation(
  id: number,
  v: { websiteValid: boolean | null; phoneValid: boolean | null; brandConfirmed: boolean }
): void {
  getSqlite()
    .prepare(
      "UPDATE dealerships SET website_valid=@w, phone_valid=@p, brand_confirmed=@b, updated_at=CURRENT_TIMESTAMP WHERE id=@id"
    )
    .run({ id, w: b2i(v.websiteValid), p: b2i(v.phoneValid), b: v.brandConfirmed ? 1 : 0 });
}

export function updateContacts(id: number, contacts: Contact[]): void {
  getSqlite()
    .prepare("UPDATE dealerships SET contacts=@c, updated_at=CURRENT_TIMESTAMP WHERE id=@id")
    .run({ id, c: JSON.stringify(contacts ?? []) });
}

export function updateTools(id: number, tools: string[]): void {
  getSqlite()
    .prepare("UPDATE dealerships SET tools_used=@t, updated_at=CURRENT_TIMESTAMP WHERE id=@id")
    .run({ id, t: JSON.stringify(tools ?? []) });
}

export function updateEnrichment(id: number, signals: unknown): void {
  getSqlite()
    .prepare("UPDATE dealerships SET enrichment=@e, updated_at=CURRENT_TIMESTAMP WHERE id=@id")
    .run({ id, e: JSON.stringify(signals ?? {}) });
}

/** Backfill a phone discovered during enrichment (it was already libphonenumber-validated). */
export function backfillPhone(id: number, phone: string): void {
  getSqlite()
    .prepare("UPDATE dealerships SET phone=@p, phone_valid=1, updated_at=CURRENT_TIMESTAMP WHERE id=@id AND phone IS NULL")
    .run({ id, p: phone });
}

export function updateTier(id: number, tier: Tier, groupName: string | null, groupSize: number | null): void {
  getSqlite()
    .prepare(
      "UPDATE dealerships SET tier=@tier, group_name=COALESCE(@gn, group_name), group_size=COALESCE(@gs, group_size), updated_at=CURRENT_TIMESTAMP WHERE id=@id"
    )
    .run({ id, tier, gn: groupName, gs: groupSize });
}
