import { getSqlite } from "./db";

/* These run only in Server Components / route handlers (better-sqlite3 is native). */

export interface Kpis {
  total: number;
  us: number;
  ca: number;
  tierA: number;
  withWebsite: number;
  websiteChecked: number;
  websiteValid: number;
  withPhone: number;
  phoneValid: number;
  brandConfirmed: number;
}

export function getKpis(): Kpis {
  const db = getSqlite();
  const row = db
    .prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(country='US') AS us,
        SUM(country='CA') AS ca,
        SUM(tier='A') AS tierA,
        SUM(website IS NOT NULL) AS withWebsite,
        SUM(website_valid IS NOT NULL) AS websiteChecked,
        SUM(website_valid=1) AS websiteValid,
        SUM(phone IS NOT NULL) AS withPhone,
        SUM(phone_valid=1) AS phoneValid,
        SUM(brand_confirmed=1) AS brandConfirmed
      FROM dealerships`
    )
    .get() as Record<string, number>;
  return {
    total: row.total ?? 0,
    us: row.us ?? 0,
    ca: row.ca ?? 0,
    tierA: row.tierA ?? 0,
    withWebsite: row.withWebsite ?? 0,
    websiteChecked: row.websiteChecked ?? 0,
    websiteValid: row.websiteValid ?? 0,
    withPhone: row.withPhone ?? 0,
    phoneValid: row.phoneValid ?? 0,
    brandConfirmed: row.brandConfirmed ?? 0,
  };
}

export interface Tally {
  label: string;
  n: number;
}

export function getByOem(limit = 15): Tally[] {
  return getSqlite()
    .prepare(
      `SELECT COALESCE(oem,'(unknown)') AS label, COUNT(*) AS n
       FROM dealerships GROUP BY oem ORDER BY n DESC LIMIT ?`
    )
    .all(limit) as Tally[];
}

export function getByTerritory(): Tally[] {
  return getSqlite()
    .prepare(
      `SELECT COALESCE(territory,'(unknown)') AS label, COUNT(*) AS n
       FROM dealerships GROUP BY territory ORDER BY n DESC`
    )
    .all() as Tally[];
}

export function getByTier(): Tally[] {
  return getSqlite()
    .prepare(
      `SELECT CASE WHEN tier IS NULL THEN '(untiered)' ELSE 'Tier '||tier END AS label, COUNT(*) AS n
       FROM dealerships GROUP BY tier ORDER BY n DESC`
    )
    .all() as Tally[];
}

export interface FilterOptions {
  oems: string[];
  countries: string[];
  territories: string[];
  tiers: string[];
}

export function getFilterOptions(): FilterOptions {
  const db = getSqlite();
  const col = (sql: string) => (db.prepare(sql).all() as { v: string }[]).map((r) => r.v).filter(Boolean);
  return {
    oems: col("SELECT DISTINCT oem AS v FROM dealerships WHERE oem IS NOT NULL ORDER BY oem"),
    countries: col("SELECT DISTINCT country AS v FROM dealerships WHERE country IS NOT NULL ORDER BY country"),
    territories: col("SELECT DISTINCT territory AS v FROM dealerships WHERE territory IS NOT NULL ORDER BY territory"),
    tiers: col("SELECT DISTINCT tier AS v FROM dealerships WHERE tier IS NOT NULL ORDER BY tier"),
  };
}

export interface AccountFilters {
  q?: string;
  oem?: string[];
  country?: string;
  territory?: string;
  tier?: string;
  hasWebsite?: boolean;
  hasPhone?: boolean;
  brandConfirmed?: boolean;
  sort?: string;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface AccountRow {
  id: number;
  name: string;
  oem: string | null;
  group_name: string | null;
  tier: string | null;
  city: string | null;
  state_province: string | null;
  country: string | null;
  territory: string | null;
  website: string | null;
  domain: string | null;
  phone: string | null;
  website_valid: number | null;
  phone_valid: number | null;
  brand_confirmed: number;
}

const SORTABLE = new Set(["name", "oem", "city", "state_province", "country", "tier"]);

/** Build the shared WHERE clause + params from filters. */
function whereClause(f: AccountFilters): { sql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (f.q) {
    clauses.push("(name LIKE ? OR city LIKE ? OR domain LIKE ?)");
    const like = `%${f.q}%`;
    params.push(like, like, like);
  }
  if (f.oem?.length) {
    clauses.push(`oem IN (${f.oem.map(() => "?").join(",")})`);
    params.push(...f.oem);
  }
  if (f.country) {
    clauses.push("country = ?");
    params.push(f.country);
  }
  if (f.territory) {
    clauses.push("territory = ?");
    params.push(f.territory);
  }
  if (f.tier) {
    clauses.push("tier = ?");
    params.push(f.tier);
  }
  if (f.hasWebsite) clauses.push("website IS NOT NULL");
  if (f.hasPhone) clauses.push("phone IS NOT NULL");
  if (f.brandConfirmed) clauses.push("brand_confirmed = 1");

  return { sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

export interface AccountPage {
  rows: AccountRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export function listAccounts(f: AccountFilters): AccountPage {
  const db = getSqlite();
  const { sql: where, params } = whereClause(f);

  const total = (db.prepare(`SELECT COUNT(*) AS n FROM dealerships ${where}`).get(...params) as { n: number }).n;

  const pageSize = f.pageSize ?? 25;
  const page = Math.max(1, f.page ?? 1);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const offset = (Math.min(page, pageCount) - 1) * pageSize;

  const sort = f.sort && SORTABLE.has(f.sort) ? f.sort : "name";
  const dir = f.dir === "desc" ? "DESC" : "ASC";

  const rows = db
    .prepare(
      `SELECT id, name, oem, group_name, tier, city, state_province, country, territory,
              website, domain, phone, website_valid, phone_valid, brand_confirmed
       FROM dealerships ${where}
       ORDER BY ${sort} ${dir}, name ASC
       LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset) as AccountRow[];

  return { rows, total, page, pageSize, pageCount };
}

/** All matching rows (no pagination) — used by CSV export of the filtered view. */
export function listAllAccounts(f: AccountFilters): AccountRow[] {
  const db = getSqlite();
  const { sql: where, params } = whereClause(f);
  const sort = f.sort && SORTABLE.has(f.sort) ? f.sort : "name";
  const dir = f.dir === "desc" ? "DESC" : "ASC";
  return db
    .prepare(
      `SELECT id, name, oem, group_name, tier, city, state_province, country, territory,
              website, domain, phone, website_valid, phone_valid, brand_confirmed
       FROM dealerships ${where} ORDER BY ${sort} ${dir}, name ASC`
    )
    .all(...params) as AccountRow[];
}

export interface FullAccount extends AccountRow {
  address_street: string | null;
  postal_code: string | null;
  email: string | null;
  group_size: number | null;
  tools_used: string | null;
  source: string;
  dedup_key: string;
  created_at: string;
  updated_at: string;
  latitude: number | null;
  longitude: number | null;
}

export function getAccount(id: number): FullAccount | null {
  const row = getSqlite().prepare("SELECT * FROM dealerships WHERE id = ?").get(id) as FullAccount | undefined;
  return row ?? null;
}
