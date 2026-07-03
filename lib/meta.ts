import { getSqlite } from "./db";

/* Tiny key-value store for system state (e.g. the autopilot heartbeat). */

let _ensured = false;
function mdb() {
  const db = getSqlite();
  if (!_ensured) {
    db.exec(`CREATE TABLE IF NOT EXISTS system_meta (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
    _ensured = true;
  }
  return db;
}

export function setMeta(key: string, value: string) {
  mdb()
    .prepare(
      `INSERT INTO system_meta (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
    )
    .run(key, value);
}

export function getMeta(key: string): string | null {
  const row = mdb().prepare("SELECT value FROM system_meta WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

const HEARTBEAT_KEY = "autopilot_heartbeat";

export function beatAutopilot() {
  setMeta(HEARTBEAT_KEY, new Date().toISOString());
}

/** Autopilot counts as active if it ticked within the last 90s. */
export function autopilotActive(): boolean {
  const hb = getMeta(HEARTBEAT_KEY);
  if (!hb) return false;
  return Date.now() - Date.parse(hb) < 90_000;
}
