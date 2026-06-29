import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

/**
 * The single master table for the system of record. JSON-bearing columns
 * (tools_used, contacts) are stored as TEXT and (de)serialized at the edges.
 * Booleans are stored as 0/1 integers (nullable where "unknown" is meaningful).
 */
export const dealerships = sqliteTable(
  "dealerships",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    oem: text("oem"),
    groupName: text("group_name"),
    groupSize: integer("group_size"),
    website: text("website"),
    domain: text("domain"),
    addressStreet: text("address_street"),
    city: text("city"),
    stateProvince: text("state_province"),
    postalCode: text("postal_code"),
    country: text("country"),
    territory: text("territory"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    phone: text("phone"),
    email: text("email"),
    toolsUsed: text("tools_used", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
    contacts: text("contacts", { mode: "json" }).$type<unknown[]>().default(sql`'[]'`),
    tier: text("tier"),
    source: text("source").notNull(),
    websiteValid: integer("website_valid", { mode: "boolean" }),
    phoneValid: integer("phone_valid", { mode: "boolean" }),
    brandConfirmed: integer("brand_confirmed", { mode: "boolean" }).notNull().default(false),
    dedupKey: text("dedup_key").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    dedupKeyIdx: uniqueIndex("dealerships_dedup_key_idx").on(t.dedupKey),
    oemIdx: index("dealerships_oem_idx").on(t.oem),
    countryIdx: index("dealerships_country_idx").on(t.country),
    domainIdx: index("dealerships_domain_idx").on(t.domain),
  })
);

export type DealershipRow = typeof dealerships.$inferSelect;
export type DealershipInsert = typeof dealerships.$inferInsert;
