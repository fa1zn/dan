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
  inHubspot: number;
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
        SUM(brand_confirmed=1) AS brandConfirmed,
        SUM(hs_in_crm=1) AS inHubspot
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
    inHubspot: row.inHubspot ?? 0,
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
  states: string[];
  tiers: string[];
}

export function getFilterOptions(): FilterOptions {
  const db = getSqlite();
  const col = (sql: string) => (db.prepare(sql).all() as { v: string }[]).map((r) => r.v).filter(Boolean);
  return {
    oems: col("SELECT DISTINCT oem AS v FROM dealerships WHERE oem IS NOT NULL ORDER BY oem"),
    countries: col("SELECT DISTINCT country AS v FROM dealerships WHERE country IS NOT NULL ORDER BY country"),
    territories: col("SELECT DISTINCT territory AS v FROM dealerships WHERE territory IS NOT NULL ORDER BY territory"),
    states: col("SELECT DISTINCT state_province AS v FROM dealerships WHERE state_province IS NOT NULL ORDER BY state_province"),
    tiers: col("SELECT DISTINCT tier AS v FROM dealerships WHERE tier IS NOT NULL ORDER BY tier"),
  };
}

export interface AccountFilters {
  q?: string;
  oem?: string[];
  country?: string;
  territory?: string;
  state?: string;
  tier?: string;
  status?: string;
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
  status: string;
  owner: string | null;
  hs_in_crm: number;
  hs_lifecycle_stage: string | null;
  hs_owner: string | null;
}

const FROM = "FROM dealerships d LEFT JOIN account_crm c ON c.dealership_id = d.id";
const SELECT_COLS = `d.id, d.name, d.oem, d.group_name, d.tier, d.city, d.state_province, d.country, d.territory,
  d.website, d.domain, d.phone, d.website_valid, d.phone_valid, d.brand_confirmed,
  d.hs_in_crm, d.hs_lifecycle_stage, d.hs_owner,
  COALESCE(c.status,'new') AS status, c.owner AS owner`;

const SORTABLE: Record<string, string> = {
  name: "d.name",
  oem: "d.oem",
  city: "d.city",
  state_province: "d.state_province",
  country: "d.country",
  tier: "d.tier",
  status: "COALESCE(c.status,'new')",
};

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
  if (f.state) {
    clauses.push("d.state_province = ?");
    params.push(f.state.toUpperCase());
  }
  if (f.tier) {
    clauses.push("d.tier = ?");
    params.push(f.tier);
  }
  if (f.status) {
    clauses.push("COALESCE(c.status,'new') = ?");
    params.push(f.status);
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

  const total = (db.prepare(`SELECT COUNT(*) AS n ${FROM} ${where}`).get(...params) as { n: number }).n;

  const pageSize = f.pageSize ?? 25;
  const page = Math.max(1, f.page ?? 1);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const offset = (Math.min(page, pageCount) - 1) * pageSize;

  const sort = (f.sort && SORTABLE[f.sort]) || "d.name";
  const dir = f.dir === "desc" ? "DESC" : "ASC";

  const rows = db
    .prepare(`SELECT ${SELECT_COLS} ${FROM} ${where} ORDER BY ${sort} ${dir}, d.name ASC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset) as AccountRow[];

  return { rows, total, page, pageSize, pageCount };
}

/** All matching rows (no pagination) — used by CSV export of the filtered view. */
export function listAllAccounts(f: AccountFilters): AccountRow[] {
  const db = getSqlite();
  const { sql: where, params } = whereClause(f);
  const sort = (f.sort && SORTABLE[f.sort]) || "d.name";
  const dir = f.dir === "desc" ? "DESC" : "ASC";
  return db
    .prepare(`SELECT ${SELECT_COLS} ${FROM} ${where} ORDER BY ${sort} ${dir}, d.name ASC`)
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
  hs_in_crm: number;
  hs_lifecycle_stage: string | null;
  hs_owner: string | null;
  hs_last_activity: string | null;
  enrichment: string | null;
}

/* ---------- Rep call list (territory worklist) ---------- */

export interface Person {
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  source?: string;
}

export interface CallListItem {
  id: number;
  name: string;
  oem: string | null;
  tier: string | null;
  status: string;
  city: string | null;
  state_province: string | null;
  address_street: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  hs_in_crm: number;
  hs_owner: string | null;
  primary: Person | null;
  people: Person[];
}

// Who a rep most wants to reach, in priority order.
const TITLE_RANK = [
  "general manager",
  "dealer principal",
  "owner",
  "president",
  "managing partner",
  "general sales manager",
  "director of sales",
  "internet",
  "bdc",
  "sales manager",
];

function rankPerson(p: Person): number {
  const t = (p.title ?? "").toLowerCase();
  const i = TITLE_RANK.findIndex((k) => t.includes(k));
  return i === -1 ? TITLE_RANK.length : i;
}

export function getCallListStates(): { code: string; total: number; named: number }[] {
  return getSqlite()
    .prepare(
      `SELECT state_province AS code, COUNT(*) AS total,
              SUM(contacts LIKE '%staff-page%') AS named
       FROM dealerships WHERE state_province IS NOT NULL
       GROUP BY state_province ORDER BY named DESC, total DESC`
    )
    .all() as { code: string; total: number; named: number }[];
}

export function getCallList(state: string, limit = 200): CallListItem[] {
  const rows = getSqlite()
    .prepare(
      `SELECT d.id, d.name, d.oem, d.tier, d.city, d.state_province, d.address_street, d.postal_code,
              d.country, d.phone, d.contacts, d.hs_in_crm, d.hs_owner, COALESCE(c.status,'new') AS status
       FROM dealerships d LEFT JOIN account_crm c ON c.dealership_id = d.id
       WHERE d.state_province = ?
       ORDER BY (d.contacts LIKE '%staff-page%') DESC, (d.phone IS NOT NULL) DESC, d.name
       LIMIT ?`
    )
    .all(state.toUpperCase(), limit) as (Record<string, unknown> & { contacts: string | null })[];

  return rows.map((r) => {
    let people: Person[] = [];
    try {
      people = (JSON.parse(r.contacts ?? "[]") as Person[]).filter((p) => p.name);
    } catch {
      people = [];
    }
    people.sort((a, b) => rankPerson(a) - rankPerson(b));
    return {
      id: r.id as number,
      name: r.name as string,
      oem: (r.oem as string) ?? null,
      tier: (r.tier as string) ?? null,
      status: r.status as string,
      city: (r.city as string) ?? null,
      state_province: (r.state_province as string) ?? null,
      address_street: (r.address_street as string) ?? null,
      postal_code: (r.postal_code as string) ?? null,
      country: (r.country as string) ?? null,
      phone: (r.phone as string) ?? null,
      hs_in_crm: (r.hs_in_crm as number) ?? 0,
      hs_owner: (r.hs_owner as string) ?? null,
      primary: people[0] ?? null,
      people,
    };
  });
}

export function getAccount(id: number): FullAccount | null {
  const row = getSqlite()
    .prepare(
      `SELECT d.*, COALESCE(c.status,'new') AS status, c.owner AS owner
       FROM dealerships d LEFT JOIN account_crm c ON c.dealership_id = d.id
       WHERE d.id = ?`
    )
    .get(id) as FullAccount | undefined;
  return row ?? null;
}
