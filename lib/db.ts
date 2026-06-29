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
  `);

  _sqlite = db;
  return db;
}

export function getDb() {
  return drizzle(getSqlite(), { schema });
}

export { schema };
