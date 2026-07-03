import { getSqlite } from "./db";

/*
 * Today-screen helpers: the snooze primitive and the V2 flag.
 *
 * Snooze is the fix for the dead-end problem — when a rep says "not now, Q2", Today has to
 * listen or the rep stops trusting it. A snoozed account drops off Today until its date, on
 * one tap. This also gives the "I handled it, now show me the next one" behavior for free.
 */

export function todayV2Enabled(): boolean {
  // Default ON (reps get the better Today), reversible with TODAY_V2=0 so nothing goes backward.
  return process.env.TODAY_V2 !== "0";
}

export function ensureTodayTables(): void {
  getSqlite().exec(`
    CREATE TABLE IF NOT EXISTS today_snooze (
      dealership_id INTEGER PRIMARY KEY,
      snoozed_until TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

export type SnoozeSpan = "tomorrow" | "next_week" | "next_quarter";

export const SNOOZE_LABEL: Record<SnoozeSpan, string> = {
  tomorrow: "Tomorrow",
  next_week: "Next week",
  next_quarter: "Next quarter",
};

/** ISO timestamp this snooze lasts until. next_quarter = first day of the next calendar quarter. */
export function snoozeUntil(span: SnoozeSpan, now: Date = new Date()): string {
  const d = new Date(now);
  if (span === "tomorrow") d.setDate(d.getDate() + 1);
  else if (span === "next_week") d.setDate(d.getDate() + 7);
  else {
    const q = Math.floor(d.getMonth() / 3);
    d.setMonth((q + 1) * 3, 1);
    d.setHours(0, 0, 0, 0);
  }
  return d.toISOString();
}

export function snooze(dealershipId: number, span: SnoozeSpan): void {
  ensureTodayTables();
  getSqlite()
    .prepare(
      `INSERT INTO today_snooze (dealership_id, snoozed_until, reason, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(dealership_id) DO UPDATE SET
         snoozed_until=excluded.snoozed_until, reason=excluded.reason, created_at=excluded.created_at`,
    )
    .run(dealershipId, snoozeUntil(span), span, new Date().toISOString());
}

export function unsnooze(dealershipId: number): void {
  ensureTodayTables();
  getSqlite().prepare("DELETE FROM today_snooze WHERE dealership_id = ?").run(dealershipId);
}
