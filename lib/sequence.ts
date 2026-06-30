import { getSqlite } from "./db";
import { getCrm, setStatus } from "./crm";
import {
  DAN_SEQUENCE_NAME,
  DAN_SEQUENCE_STEPS,
  delayMs,
  type EnrollmentState,
  type SequenceActivityKind,
  type Step,
} from "./sequence-constants";

/*
 * Server-only sequence reads/writes. Raw better-sqlite3 (mirrors lib/crm.ts) so the
 * motion layer touches no shared source files: the 3 tables are created lazily here, and
 * the timeline is written straight into the existing `activity` table.
 */

let _ensured = false;
function sdb() {
  const db = getSqlite(); // bootstraps dealerships / account_crm / activity
  if (!_ensured) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sequences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        steps TEXT NOT NULL DEFAULT '[]',
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS enrollments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
        sequence_id INTEGER NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
        state TEXT NOT NULL DEFAULT 'active',
        current_step INTEGER NOT NULL DEFAULT 0,
        next_run_at TEXT,
        exit_reason TEXT,
        enrolled_by TEXT DEFAULT 'Dan',
        enrolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS enrollments_due_idx ON enrollments(state, next_run_at);
      CREATE UNIQUE INDEX IF NOT EXISTS enrollments_active_uniq
        ON enrollments(dealership_id, sequence_id) WHERE state = 'active';

      CREATE TABLE IF NOT EXISTS sequence_step_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
        step_index INTEGER NOT NULL,
        channel TEXT NOT NULL,
        provider TEXT,
        state TEXT NOT NULL DEFAULT 'pending',
        scheduled_at TEXT,
        executed_at TEXT,
        external_ref TEXT,
        cost_cents INTEGER NOT NULL DEFAULT 0,
        attempts INTEGER NOT NULL DEFAULT 0,
        payload TEXT,
        result TEXT,
        error TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS step_runs_uniq
        ON sequence_step_runs(enrollment_id, step_index);
    `);
    // Call outcome (transcript summary) synced back from the voice provider.
    const cols = new Set(
      (db.prepare("PRAGMA table_info(sequence_step_runs)").all() as { name: string }[]).map((c) => c.name)
    );
    if (!cols.has("outcome")) db.exec("ALTER TABLE sequence_step_runs ADD COLUMN outcome TEXT");
    _ensured = true;
  }
  return db;
}

const nowISO = () => new Date().toISOString();

/* ---------- sequences ---------- */

export interface SequenceRow {
  id: number;
  name: string;
  description: string | null;
  steps: Step[];
  active: boolean;
}

function parseSeq(row: any): SequenceRow {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    steps: JSON.parse(row.steps || "[]") as Step[],
    active: !!row.active,
  };
}

export function upsertSequence(name: string, steps: Step[], description?: string): number {
  const db = sdb();
  db.prepare(
    `INSERT INTO sequences (name, description, steps, updated_at)
     VALUES (@name, @description, @steps, CURRENT_TIMESTAMP)
     ON CONFLICT(name) DO UPDATE SET
       description = COALESCE(@description, description),
       steps = @steps,
       updated_at = CURRENT_TIMESTAMP`
  ).run({ name, description: description ?? null, steps: JSON.stringify(steps) });
  return (db.prepare("SELECT id FROM sequences WHERE name = ?").get(name) as { id: number }).id;
}

export function seedDanSequence(): number {
  return upsertSequence(DAN_SEQUENCE_NAME, DAN_SEQUENCE_STEPS, "Call → text → edible. Dan's core sales motion.");
}

export function getSequence(id: number): SequenceRow | null {
  const row = sdb().prepare("SELECT * FROM sequences WHERE id = ?").get(id);
  return row ? parseSeq(row) : null;
}

export function getSequenceByName(name: string): SequenceRow | null {
  const row = sdb().prepare("SELECT * FROM sequences WHERE name = ?").get(name);
  return row ? parseSeq(row) : null;
}

export function listSequences(): SequenceRow[] {
  return (sdb().prepare("SELECT * FROM sequences ORDER BY id").all() as any[]).map(parseSeq);
}

/* ---------- enrollments ---------- */

export interface EnrollmentRow {
  id: number;
  dealership_id: number;
  sequence_id: number;
  state: EnrollmentState;
  current_step: number;
  next_run_at: string | null;
  exit_reason: string | null;
}

export function getEnrollmentById(id: number): EnrollmentRow | null {
  return (sdb().prepare("SELECT * FROM enrollments WHERE id = ?").get(id) as EnrollmentRow) ?? null;
}

export function getActiveEnrollment(dealershipId: number, sequenceId: number): EnrollmentRow | null {
  return (
    (sdb()
      .prepare("SELECT * FROM enrollments WHERE dealership_id = ? AND sequence_id = ? AND state = 'active'")
      .get(dealershipId, sequenceId) as EnrollmentRow) ?? null
  );
}

/** Enroll a rooftop. Idempotent: returns the existing active enrollment if one exists. */
export function enroll(dealershipId: number, sequenceId: number, by = "Dan"): EnrollmentRow {
  const existing = getActiveEnrollment(dealershipId, sequenceId);
  if (existing) return existing;
  const seq = getSequence(sequenceId);
  if (!seq) throw new Error(`sequence ${sequenceId} not found`);
  const firstDelay = seq.steps.length ? delayMs(seq.steps[0].delay) : 0;
  const nextRun = new Date(Date.now() + firstDelay).toISOString();
  const info = sdb()
    .prepare(
      `INSERT INTO enrollments (dealership_id, sequence_id, state, current_step, next_run_at, enrolled_by)
       VALUES (?, ?, 'active', 0, ?, ?)`
    )
    .run(dealershipId, sequenceId, nextRun, by);
  logSeqActivity(dealershipId, "sequence", `Enrolled in "${seq.name}"`, by);
  return getEnrollmentById(Number(info.lastInsertRowid))!;
}

/* ---------- segment targeting (brand + geography) ---------- */

export interface SegmentFilter {
  oem?: string;
  state?: string;
  city?: string;
}

function segmentWhere(f: SegmentFilter): { sql: string; params: unknown[] } {
  const clauses = ["phone IS NOT NULL", "phone <> ''"];
  const params: unknown[] = [];
  if (f.oem) {
    clauses.push("oem = ?");
    params.push(f.oem);
  }
  if (f.state) {
    clauses.push("state_province = ?");
    params.push(f.state);
  }
  if (f.city) {
    clauses.push("city LIKE ?");
    params.push(`%${f.city}%`);
  }
  return { sql: clauses.join(" AND "), params };
}

export function countSegment(f: SegmentFilter): number {
  const { sql, params } = segmentWhere(f);
  return (sdb().prepare(`SELECT COUNT(*) AS n FROM dealerships WHERE ${sql}`).get(...params) as { n: number }).n;
}

export function segmentOptions(): { oems: string[]; states: string[] } {
  const db = sdb();
  const oems = (
    db
      .prepare("SELECT oem, COUNT(*) c FROM dealerships WHERE oem IS NOT NULL AND oem <> '' GROUP BY oem ORDER BY c DESC LIMIT 40")
      .all() as { oem: string }[]
  ).map((r) => r.oem);
  const states = (
    db
      .prepare("SELECT DISTINCT state_province AS s FROM dealerships WHERE state_province IS NOT NULL AND state_province <> '' ORDER BY s")
      .all() as { s: string }[]
  ).map((r) => r.s);
  return { oems, states };
}

/** Enroll every rooftop in a segment, paced (staggered next_run_at) and capped. */
export function enrollSegment(
  f: SegmentFilter,
  sequenceId: number,
  opts: { cap?: number; staggerSec?: number } = {}
): { matched: number; enrolled: number } {
  const cap = opts.cap ?? 100;
  const staggerSec = opts.staggerSec ?? 0;
  const { sql, params } = segmentWhere(f);
  const ids = (
    sdb()
      .prepare(`SELECT id FROM dealerships WHERE ${sql} ORDER BY id LIMIT ?`)
      .all(...params, cap) as { id: number }[]
  ).map((r) => r.id);
  const base = Date.now();
  let enrolled = 0;
  ids.forEach((id, i) => {
    const e = enroll(id, sequenceId);
    if (staggerSec > 0) setEnrollment(e.id, { next_run_at: new Date(base + i * staggerSec * 1000).toISOString() });
    enrolled++;
  });
  return { matched: countSegment(f), enrolled };
}

export function listDueEnrollments(now: string, ignoreSchedule = false): EnrollmentRow[] {
  const sql = ignoreSchedule
    ? "SELECT * FROM enrollments WHERE state = 'active' ORDER BY next_run_at"
    : "SELECT * FROM enrollments WHERE state = 'active' AND (next_run_at IS NULL OR next_run_at <= ?) ORDER BY next_run_at";
  const stmt = sdb().prepare(sql);
  return (ignoreSchedule ? stmt.all() : stmt.all(now)) as EnrollmentRow[];
}

export function setEnrollment(id: number, patch: Partial<{ state: EnrollmentState; current_step: number; next_run_at: string | null; exit_reason: string | null }>) {
  const cur = getEnrollmentById(id);
  if (!cur) return;
  sdb()
    .prepare(
      `UPDATE enrollments SET
         state = COALESCE(@state, state),
         current_step = COALESCE(@current_step, current_step),
         next_run_at = @next_run_at,
         exit_reason = COALESCE(@exit_reason, exit_reason),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = @id`
    )
    .run({
      id,
      state: patch.state ?? null,
      current_step: patch.current_step ?? null,
      next_run_at: "next_run_at" in patch ? patch.next_run_at : cur.next_run_at,
      exit_reason: patch.exit_reason ?? null,
    });
}

export function exitEnrollment(id: number, reason: string) {
  setEnrollment(id, { state: "exited", exit_reason: reason, next_run_at: null });
  const e = getEnrollmentById(id);
  if (e) logSeqActivity(e.dealership_id, "sequence", `Exited motion: ${reason}`);
}

export function completeEnrollment(id: number) {
  setEnrollment(id, { state: "completed", exit_reason: "completed", next_run_at: null });
  const e = getEnrollmentById(id);
  if (e) logSeqActivity(e.dealership_id, "sequence", "Motion completed");
}

export function pauseEnrollment(id: number) {
  setEnrollment(id, { state: "paused", next_run_at: null });
}

/** Advance to the next step; schedule it, or complete the enrollment if none remain. */
export function advance(id: number, steps: Step[], completion: Date) {
  const e = getEnrollmentById(id);
  if (!e) return;
  const next = e.current_step + 1;
  if (next >= steps.length) {
    completeEnrollment(id);
    return;
  }
  const nextRun = new Date(completion.getTime() + delayMs(steps[next].delay)).toISOString();
  setEnrollment(id, { current_step: next, next_run_at: nextRun });
}

/* ---------- step runs ---------- */

export interface StepRunRecord {
  state: string;
  provider?: string;
  externalRef?: string;
  costCents?: number;
  payload?: unknown;
  result?: unknown;
  error?: string;
}

export function getStepRun(enrollmentId: number, stepIndex: number): any | null {
  return (
    sdb()
      .prepare("SELECT * FROM sequence_step_runs WHERE enrollment_id = ? AND step_index = ?")
      .get(enrollmentId, stepIndex) ?? null
  );
}

export function recordStepRun(
  enrollmentId: number,
  stepIndex: number,
  channel: string,
  scheduledAt: string,
  rec: StepRunRecord
) {
  sdb()
    .prepare(
      `INSERT INTO sequence_step_runs
         (enrollment_id, step_index, channel, provider, state, scheduled_at, executed_at, external_ref, cost_cents, attempts, payload, result, error)
       VALUES (@enrollment_id, @step_index, @channel, @provider, @state, @scheduled_at, @executed_at, @external_ref, @cost_cents, 1, @payload, @result, @error)
       ON CONFLICT(enrollment_id, step_index) DO UPDATE SET
         provider = @provider, state = @state, executed_at = @executed_at,
         external_ref = @external_ref, cost_cents = @cost_cents,
         attempts = attempts + 1, payload = @payload, result = @result, error = @error`
    )
    .run({
      enrollment_id: enrollmentId,
      step_index: stepIndex,
      channel,
      provider: rec.provider ?? null,
      state: rec.state,
      scheduled_at: scheduledAt,
      executed_at: nowISO(),
      external_ref: rec.externalRef ?? null,
      cost_cents: rec.costCents ?? 0,
      payload: rec.payload ? JSON.stringify(rec.payload) : null,
      result: rec.result ? JSON.stringify(rec.result) : null,
      error: rec.error ?? null,
    });
}

export function getStepRuns(enrollmentId: number): any[] {
  return sdb()
    .prepare("SELECT * FROM sequence_step_runs WHERE enrollment_id = ? ORDER BY step_index")
    .all(enrollmentId) as any[];
}

/** Sent calls that don't yet have a synced outcome (transcript summary). */
export function listUnsyncedCallRuns(): Array<{
  enrollment_id: number;
  step_index: number;
  external_ref: string;
  provider: string;
  dealership_id: number;
}> {
  return sdb()
    .prepare(
      `SELECT r.enrollment_id, r.step_index, r.external_ref, r.provider, e.dealership_id
       FROM sequence_step_runs r JOIN enrollments e ON e.id = r.enrollment_id
       WHERE r.channel = 'call' AND r.state = 'sent' AND r.external_ref IS NOT NULL AND r.outcome IS NULL`
    )
    .all() as any;
}

export function setStepOutcome(enrollmentId: number, stepIndex: number, outcome: string) {
  sdb()
    .prepare("UPDATE sequence_step_runs SET outcome = ? WHERE enrollment_id = ? AND step_index = ?")
    .run(outcome, enrollmentId, stepIndex);
}

/** Running total of money committed to gifts (sent gift runs). */
export function giftSpentCents(): number {
  const row = sdb()
    .prepare("SELECT COALESCE(SUM(cost_cents),0) AS c FROM sequence_step_runs WHERE channel = 'gift' AND state = 'sent'")
    .get() as { c: number };
  return row.c;
}

/* ---------- dealership read + activity write ---------- */

export interface DealershipLite {
  id: number;
  name: string;
  oem: string | null;
  city: string | null;
  state_province: string | null;
  group_name: string | null;
  phone: string | null;
  address_street: string | null;
  postal_code: string | null;
  contacts: Array<{ name?: string; title?: string; phone?: string; email?: string }>;
}

export function getDealership(id: number): DealershipLite | null {
  const row = sdb().prepare("SELECT * FROM dealerships WHERE id = ?").get(id) as any;
  if (!row) return null;
  let contacts: any[] = [];
  try {
    contacts = JSON.parse(row.contacts || "[]");
  } catch {
    contacts = [];
  }
  return { ...row, contacts };
}

export function findDealershipByName(name: string): DealershipLite | null {
  const row = sdb()
    .prepare("SELECT id FROM dealerships WHERE name LIKE ? ORDER BY length(name) LIMIT 1")
    .get(`%${name}%`) as { id: number } | undefined;
  return row ? getDealership(row.id) : null;
}

export function logSeqActivity(dealershipId: number, kind: SequenceActivityKind, body: string, author = "Dan") {
  sdb()
    .prepare("INSERT INTO activity (dealership_id, kind, body, author) VALUES (?,?,?,?)")
    .run(dealershipId, kind, body, author);
}

// Re-exported for the tick loop's exit guard.
export { getCrm, setStatus };
