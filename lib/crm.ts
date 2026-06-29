import { getSqlite } from "./db";
import { DEFAULT_STATUS, type ActivityKind, type Status } from "./crm-constants";

/* CRM reads/writes. Server-only (better-sqlite3). */

export interface Crm {
  dealershipId: number;
  status: Status;
  owner: string | null;
  nextStep: string | null;
  updatedAt: string | null;
}

export function getCrm(id: number): Crm {
  const row = getSqlite()
    .prepare("SELECT status, owner, next_step, updated_at FROM account_crm WHERE dealership_id = ?")
    .get(id) as { status: string; owner: string | null; next_step: string | null; updated_at: string } | undefined;
  return {
    dealershipId: id,
    status: (row?.status as Status) ?? DEFAULT_STATUS,
    owner: row?.owner ?? null,
    nextStep: row?.next_step ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

function upsert(id: number, patch: { status?: string; owner?: string | null; next_step?: string | null }) {
  const db = getSqlite();
  db.prepare(
    `INSERT INTO account_crm (dealership_id, status, owner, next_step, updated_at)
     VALUES (@id, COALESCE(@status,'new'), @owner, @next_step, CURRENT_TIMESTAMP)
     ON CONFLICT(dealership_id) DO UPDATE SET
       status = COALESCE(@status, status),
       owner = COALESCE(@owner, owner),
       next_step = COALESCE(@next_step, next_step),
       updated_at = CURRENT_TIMESTAMP`
  ).run({
    id,
    status: patch.status ?? null,
    owner: patch.owner ?? null,
    next_step: patch.next_step ?? null,
  });
}

export function logActivity(id: number, kind: ActivityKind, body: string, author = "Dan") {
  getSqlite()
    .prepare("INSERT INTO activity (dealership_id, kind, body, author) VALUES (?,?,?,?)")
    .run(id, kind, body, author);
}

export function setStatus(id: number, status: Status, author = "Dan") {
  const prev = getCrm(id).status;
  if (prev === status) return;
  upsert(id, { status });
  logActivity(id, "status_change", `Status: ${prev} → ${status}`, author);
}

export function setOwner(id: number, owner: string, author = "Dan") {
  upsert(id, { owner: owner || null });
  logActivity(id, "owner_change", owner ? `Owner set to ${owner}` : "Owner cleared", author);
}

export function setNextStep(id: number, nextStep: string) {
  upsert(id, { next_step: nextStep || null });
}

export function addNote(id: number, body: string, author = "Dan") {
  const text = body.trim();
  if (!text) return;
  // Touch the CRM row so the account shows as recently worked.
  upsert(id, {});
  logActivity(id, "note", text, author);
}

export interface ActivityItem {
  id: number;
  kind: ActivityKind;
  body: string | null;
  author: string | null;
  created_at: string;
}

export function getActivity(id: number): ActivityItem[] {
  return getSqlite()
    .prepare("SELECT id, kind, body, author, created_at FROM activity WHERE dealership_id = ? ORDER BY created_at DESC, id DESC")
    .all(id) as ActivityItem[];
}

export function getPipelineCounts(): Record<Status, number> {
  const rows = getSqlite()
    .prepare(
      `SELECT COALESCE(c.status,'new') AS status, COUNT(*) AS n
       FROM dealerships d LEFT JOIN account_crm c ON c.dealership_id = d.id
       GROUP BY COALESCE(c.status,'new')`
    )
    .all() as { status: Status; n: number }[];
  const out = { new: 0, working: 0, engaged: 0, won: 0, lost: 0 } as Record<Status, number>;
  for (const r of rows) out[r.status] = r.n;
  return out;
}
