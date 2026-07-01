import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export const DATA_DIR = path.join(process.cwd(), "data");
export const DB_PATH = path.join(DATA_DIR, "dealerships.sqlite");

let _sqlite: Database.Database | null = null;

/**
 * Open (and lazily create) the SQLite database. The table DDL is applied
 * idempotently here so the pipeline runs without a separate migration step;
 * the Drizzle table in schema.ts remains the source of truth for typed queries.
 */
export function getSqlite(): Database.Database {
  if (_sqlite) return _sqlite;
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS dealerships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      oem TEXT,
      group_name TEXT,
      group_size INTEGER,
      website TEXT,
      domain TEXT,
      address_street TEXT,
      city TEXT,
      state_province TEXT,
      postal_code TEXT,
      country TEXT,
      territory TEXT,
      latitude REAL,
      longitude REAL,
      phone TEXT,
      email TEXT,
      tools_used TEXT DEFAULT '[]',
      contacts TEXT DEFAULT '[]',
      tier TEXT,
      source TEXT NOT NULL,
      website_valid INTEGER,
      phone_valid INTEGER,
      brand_confirmed INTEGER NOT NULL DEFAULT 0,
      dedup_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS dealerships_dedup_key_idx ON dealerships(dedup_key);
    CREATE INDEX IF NOT EXISTS dealerships_oem_idx ON dealerships(oem);
    CREATE INDEX IF NOT EXISTS dealerships_country_idx ON dealerships(country);
    CREATE INDEX IF NOT EXISTS dealerships_domain_idx ON dealerships(domain);

    -- Phase 3 CRM: the sales state Dan layers on top of each rooftop.
    CREATE TABLE IF NOT EXISTS account_crm (
      dealership_id INTEGER PRIMARY KEY REFERENCES dealerships(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'new',
      owner TEXT,
      next_step TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS account_crm_status_idx ON account_crm(status);

    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      body TEXT,
      author TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS activity_dealership_idx ON activity(dealership_id, created_at);
  `);

  // Lightweight column migrations for integrations added after the initial schema.
  const cols = new Set((db.prepare("PRAGMA table_info(dealerships)").all() as { name: string }[]).map((c) => c.name));
  if (!cols.has("hubspot_company_id")) db.exec("ALTER TABLE dealerships ADD COLUMN hubspot_company_id TEXT");
  if (!cols.has("hubspot_synced_at")) db.exec("ALTER TABLE dealerships ADD COLUMN hubspot_synced_at TEXT");
  // Pulled HubSpot engagement summary (read-only mirror of Pam's CRM).
  if (!cols.has("hs_in_crm")) db.exec("ALTER TABLE dealerships ADD COLUMN hs_in_crm INTEGER NOT NULL DEFAULT 0");
  if (!cols.has("hs_lifecycle_stage")) db.exec("ALTER TABLE dealerships ADD COLUMN hs_lifecycle_stage TEXT");
  if (!cols.has("hs_owner")) db.exec("ALTER TABLE dealerships ADD COLUMN hs_owner TEXT");
  if (!cols.has("hs_last_activity")) db.exec("ALTER TABLE dealerships ADD COLUMN hs_last_activity TEXT");
  // Extra scraped signals (rating, hours, socials, email pattern) as flexible JSON.
  if (!cols.has("enrichment")) db.exec("ALTER TABLE dealerships ADD COLUMN enrichment TEXT");
  // Google Places canonical id (dedup + idempotency for the coverage enumerator).
  if (!cols.has("place_id")) db.exec("ALTER TABLE dealerships ADD COLUMN place_id TEXT");
  // Cross-source provenance / trust.
  if (!cols.has("sources")) db.exec("ALTER TABLE dealerships ADD COLUMN sources TEXT DEFAULT '[]'");
  if (!cols.has("confirmation_count")) db.exec("ALTER TABLE dealerships ADD COLUMN confirmation_count INTEGER NOT NULL DEFAULT 0");
  if (!cols.has("trust_tier")) db.exec("ALTER TABLE dealerships ADD COLUMN trust_tier TEXT");

  _sqlite = db;
  return db;
}

export function getDb() {
  return drizzle(getSqlite(), { schema });
}

export { schema };
