import { getSqlite } from "./db";

/**
 * Ride-along instrumentation (server side).
 *
 * This exists to make a real rep's session produce data instead of an observer's guesses.
 * It is held to the same standard as everything else Dan does: consent-first, ids-not-content,
 * and a written retention rule. Two independent gates must BOTH be true before a single event
 * is stored:
 *   1. a global kill switch (TELEMETRY_ENABLED=1) — defaulted OFF,
 *   2. a per-rep opt-in row this rep set after seeing exactly what is logged and why.
 *
 * What is NEVER stored: message content, account content beyond an id, phone numbers (a tel:
 * tap logs the scheme "tel", not the number), typed content (only field name + character
 * count), or any location beyond what the app already has. If in doubt, it is dropped.
 */

export const RETENTION_DAYS = 30;
export const NOTICE_VERSION = 1; // bump when the disclosure text changes, so consent is re-asked

// The only event types accepted. Anything else is dropped at the door.
const EVENT_TYPES = new Set([
  "app_open",       // a screen became active
  "nav",            // route change within Dan
  "first_tap",      // time from screen open to first interaction (detail.ms)
  "tap",            // an element tap (detail.element structural descriptor, detail.hesitation_ms)
  "type",           // typing into a field (detail.field name, detail.chars count — never content)
  "scroll_depth",   // max scroll reached on a screen (detail.pct)
  "external_nav",   // rep left to another app/site (detail.target = scheme or host only)
  "visibility",     // tab backgrounded/foregrounded (detail.state)
  "session_end",    // page unloaded (detail.duration_ms)
]);

// Per-type allowlist of detail keys. Values are coerced to bounded scalars; unknown keys dropped.
const DETAIL_KEYS: Record<string, string[]> = {
  app_open: [],
  nav: ["from", "to"],
  first_tap: ["ms"],
  tap: ["element", "hesitation_ms"],
  type: ["field", "chars"],
  scroll_depth: ["pct"],
  external_nav: ["target"],
  visibility: ["state"],
  session_end: ["duration_ms"],
};

function db() {
  const d = getSqlite();
  d.exec(`
    CREATE TABLE IF NOT EXISTS telemetry_optin (
      rep_id TEXT PRIMARY KEY,
      decision INTEGER NOT NULL,          -- 1 opted in, 0 declined
      label TEXT,                          -- rep-chosen initials/handle, <=40 chars
      notice_version INTEGER NOT NULL,
      decided_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS telemetry_event (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rep_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      screen TEXT,
      detail TEXT NOT NULL DEFAULT '{}',   -- sanitized, allowlisted scalars only
      client_ts INTEGER,                    -- epoch ms on the device
      created_at TEXT NOT NULL              -- server ISO, drives retention
    );
    CREATE INDEX IF NOT EXISTS idx_telemetry_event_rep ON telemetry_event(rep_id);
    CREATE INDEX IF NOT EXISTS idx_telemetry_event_created ON telemetry_event(created_at);
  `);
  return d;
}

export function isGloballyEnabled(): boolean {
  return process.env.TELEMETRY_ENABLED === "1";
}

export function getOptIn(repId: string): { decision: number; notice_version: number } | null {
  if (!repId) return null;
  const row = db()
    .prepare("SELECT decision, notice_version FROM telemetry_optin WHERE rep_id = ?")
    .get(repId) as { decision: number; notice_version: number } | undefined;
  return row ?? null;
}

export function setOptIn(repId: string, decision: boolean, label?: string): void {
  const clean = (label ?? "").replace(/[^\w .\-]/g, "").slice(0, 40);
  db()
    .prepare(
      `INSERT INTO telemetry_optin (rep_id, decision, label, notice_version, decided_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(rep_id) DO UPDATE SET
         decision=excluded.decision, label=excluded.label,
         notice_version=excluded.notice_version, decided_at=excluded.decided_at`,
    )
    .run(repId, decision ? 1 : 0, clean, NOTICE_VERSION, new Date().toISOString());
}

function scalar(v: unknown): string | number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") return v.slice(0, 120);
  return null;
}

function sanitizeDetail(type: string, raw: unknown): string {
  const out: Record<string, string | number> = {};
  const allowed = DETAIL_KEYS[type] ?? [];
  if (raw && typeof raw === "object") {
    for (const k of allowed) {
      const v = scalar((raw as Record<string, unknown>)[k]);
      if (v !== null) out[k] = v;
    }
  }
  return JSON.stringify(out);
}

export interface RawEvent {
  type?: string;
  screen?: string;
  detail?: unknown;
  ts?: number;
}

/** Store a batch. Enforces both gates and the per-type allowlist. Returns how many were kept. */
export function recordEvents(repId: string, sessionId: string, events: RawEvent[]): number {
  if (!isGloballyEnabled()) return 0;
  if (!repId || !sessionId) return 0;
  const opt = getOptIn(repId);
  if (!opt || opt.decision !== 1) return 0; // no consent, no storage

  const d = db();
  const now = new Date().toISOString();
  const insert = d.prepare(
    `INSERT INTO telemetry_event (rep_id, session_id, type, screen, detail, client_ts, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const batch = (events ?? []).slice(0, 500); // hard cap per request
  let kept = 0;
  const tx = d.transaction((rows: RawEvent[]) => {
    for (const e of rows) {
      const type = typeof e.type === "string" ? e.type : "";
      if (!EVENT_TYPES.has(type)) continue;
      const screen = typeof e.screen === "string" ? e.screen.slice(0, 80) : null;
      const clientTs = typeof e.ts === "number" && Number.isFinite(e.ts) ? Math.trunc(e.ts) : null;
      insert.run(repId, sessionId.slice(0, 60), type, screen, sanitizeDetail(type, e.detail), clientTs, now);
      kept++;
    }
  });
  tx(batch);
  purgeOld();
  return kept;
}

/** Retention: drop anything older than RETENTION_DAYS. Called opportunistically on write. */
export function purgeOld(days: number = RETENTION_DAYS): number {
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
  const r = db().prepare("DELETE FROM telemetry_event WHERE created_at < ?").run(cutoff);
  return r.changes as number;
}

/** Offboarding: wipe one rep's events and their opt-in record entirely. */
export function wipeRep(repId: string): { events: number; optin: number } {
  const d = db();
  const e = d.prepare("DELETE FROM telemetry_event WHERE rep_id = ?").run(repId);
  const o = d.prepare("DELETE FROM telemetry_optin WHERE rep_id = ?").run(repId);
  return { events: e.changes as number, optin: o.changes as number };
}
