import { getSqlite } from "./db";
import { ensureTodayTables } from "./today";
import {
  temperature,
  type Channel,
  type EnrollmentState,
  type Step,
  type Temperature,
} from "./sequence-constants";

/*
 * Server-only read helpers shaped for the UI. Joins enrollments + dealerships + CRM +
 * step runs into a single view, and derives the engagement temperature.
 */

export type StepViewState = "sent" | "skipped" | "pending" | "next";

export interface MotionStepView {
  index: number;
  channel: Channel;
  giftKind?: string;
  state: StepViewState;
  provider?: string;
  costCents?: number;
}

export interface MotionView {
  enrollmentId: number;
  dealershipId: number;
  dealershipName: string;
  oem: string | null;
  city: string | null;
  stateProvince: string | null;
  contactName: string | null;
  sequenceName: string;
  state: EnrollmentState;
  currentStep: number;
  nextRunAt: string | null;
  exitReason: string | null;
  steps: MotionStepView[];
  temperature: Temperature;
  crmStatus: string;
  touches: number;
}

interface JoinRow {
  enrollment_id: number;
  dealership_id: number;
  name: string;
  oem: string | null;
  city: string | null;
  state_province: string | null;
  contacts: string | null;
  seq_name: string;
  steps: string;
  state: EnrollmentState;
  current_step: number;
  next_run_at: string | null;
  exit_reason: string | null;
  crm_status: string | null;
}

function toView(row: JoinRow): MotionView {
  const steps = JSON.parse(row.steps || "[]") as Step[];
  const runs = getSqlite()
    .prepare("SELECT step_index, channel, state, provider, cost_cents FROM sequence_step_runs WHERE enrollment_id = ?")
    .all(row.enrollment_id) as { step_index: number; channel: Channel; state: string; provider: string | null; cost_cents: number }[];
  const runByIdx = new Map(runs.map((r) => [r.step_index, r]));

  const stepViews: MotionStepView[] = steps.map((s, i) => {
    const run = runByIdx.get(i);
    let state: StepViewState;
    if (run) state = run.state === "sent" ? "sent" : run.state === "skipped" ? "skipped" : "pending";
    else if (i === row.current_step && row.state === "active") state = "next";
    else state = "pending";
    return { index: i, channel: s.channel, giftKind: s.giftKind, state, provider: run?.provider ?? undefined, costCents: run?.cost_cents };
  });

  const touches = stepViews.filter((s) => s.state === "sent").length;
  const crmStatus = row.crm_status ?? "new";
  const engaged = crmStatus === "engaged" || crmStatus === "won";
  const completedNoReply = row.state === "completed" && !engaged;

  let contactName: string | null = null;
  try {
    const c = JSON.parse(row.contacts || "[]");
    contactName = c[0]?.name ?? null;
  } catch {
    contactName = null;
  }

  return {
    enrollmentId: row.enrollment_id,
    dealershipId: row.dealership_id,
    dealershipName: row.name,
    oem: row.oem,
    city: row.city,
    stateProvince: row.state_province,
    contactName,
    sequenceName: row.seq_name,
    state: row.state,
    currentStep: row.current_step,
    nextRunAt: row.next_run_at,
    exitReason: row.exit_reason,
    steps: stepViews,
    temperature: temperature({ engaged, touches, completedNoReply }),
    crmStatus,
    touches,
  };
}

const SELECT = `
  SELECT e.id AS enrollment_id, e.dealership_id, d.name, d.oem, d.city, d.state_province, d.contacts,
         s.name AS seq_name, s.steps, e.state, e.current_step, e.next_run_at, e.exit_reason,
         c.status AS crm_status
  FROM enrollments e
  JOIN dealerships d ON d.id = e.dealership_id
  JOIN sequences s ON s.id = e.sequence_id
  LEFT JOIN account_crm c ON c.dealership_id = e.dealership_id
`;

function hasSequenceTables(): boolean {
  return !!getSqlite()
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='enrollments'")
    .get();
}

export function listMotions(): MotionView[] {
  if (!hasSequenceTables()) return [];
  const rows = getSqlite().prepare(`${SELECT} ORDER BY e.id DESC`).all() as JoinRow[];
  return rows.map(toView);
}

export function getMotionForDealership(dealershipId: number): MotionView | null {
  if (!hasSequenceTables()) return null;
  const row = getSqlite()
    .prepare(`${SELECT} WHERE e.dealership_id = ? ORDER BY e.id DESC LIMIT 1`)
    .get(dealershipId) as JoinRow | undefined;
  return row ? toView(row) : null;
}

export const TEMPERATURE_LABEL: Record<Temperature, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
  stalled: "Stalled",
};

/* ---------- Today inbox feeds ---------- */

export interface HotLead {
  dealershipId: number;
  name: string;
  oem: string | null;
  city: string | null;
  status: string;
  phone: string | null;
  lastOutcome: string | null;
  lastTouchAt: string | null;
  daysSinceTouch: number | null;
  whyNow: string;
}

interface HotRow {
  dealershipId: number;
  name: string;
  oem: string | null;
  city: string | null;
  status: string;
  phone: string | null;
  lastOutcome: string | null;
  lastTouchAt: string | null;
}

function firstSentence(s: string): string {
  const t = s.trim().split(/(?<=[.!?])\s/)[0] ?? s;
  return t.length > 90 ? t.slice(0, 87) + "…" : t;
}

/**
 * One concrete sentence for why this account is worth a call *right now* — the actual signal,
 * not "they're in your territory". Combines what Pam last heard with how stale it's gotten,
 * because a hot lead you haven't touched in days is the one about to cool.
 */
function whyNow(r: HotRow, daysSinceTouch: number | null): string {
  const outcome = r.lastOutcome ? firstSentence(cleanBody(r.lastOutcome) ?? r.lastOutcome) : null;
  if (daysSinceTouch === null) return outcome ? `${outcome} — no follow-up logged yet` : "Engaged — no follow-up logged yet, reach out";
  if (daysSinceTouch <= 0) return outcome ? `${outcome} — replied today, strike while it's warm` : "Replied today — strike while it's warm";
  const ago = `${daysSinceTouch}d since last touch`;
  return outcome ? `${outcome} — ${ago}, follow up before it cools` : `Engaged, ${ago} — follow up before it cools`;
}

/**
 * The rep's "worth your time" queue. Excludes snoozed accounts, and orders by most-overdue
 * first (oldest / never-touched engaged leads), so the top card is a defensible "do this next"
 * rather than a recency coin flip. NOTE: the most-overdue ranking is a hypothesis — validate it
 * against the ride-along event stream before trusting it as the permanent order.
 */
export function listHotLeads(limit = 25): HotLead[] {
  if (!hasSequenceTables()) return [];
  ensureTodayTables();
  const nowIso = new Date().toISOString();
  const rows = getSqlite()
    .prepare(
      `SELECT d.id AS dealershipId, d.name, d.oem, d.city, d.phone, c.status,
         (SELECT r.outcome FROM sequence_step_runs r JOIN enrollments e ON e.id = r.enrollment_id
          WHERE e.dealership_id = d.id AND r.outcome IS NOT NULL ORDER BY r.id DESC LIMIT 1) AS lastOutcome,
         (SELECT MAX(a.created_at) FROM activity a WHERE a.dealership_id = d.id) AS lastTouchAt
       FROM dealerships d JOIN account_crm c ON c.dealership_id = d.id
       LEFT JOIN today_snooze sn ON sn.dealership_id = d.id
       WHERE c.status IN ('engaged','won')
         AND (sn.snoozed_until IS NULL OR sn.snoozed_until <= ?)
       ORDER BY COALESCE(lastTouchAt, '0000') ASC
       LIMIT ?`
    )
    .all(nowIso, limit) as HotRow[];

  const now = Date.now();
  return rows.map((r) => {
    const daysSinceTouch = r.lastTouchAt
      ? Math.max(0, Math.floor((now - new Date(r.lastTouchAt).getTime()) / 86_400_000))
      : null;
    return { ...r, daysSinceTouch, whyNow: whyNow(r, daysSinceTouch) };
  });
}

export interface FeedItem {
  dealershipId: number;
  name: string;
  kind: string;
  body: string | null;
  created_at: string;
}

/** Translate any legacy / system phrasing in a log line into plain, human language. */
function cleanBody(body: string | null): string | null {
  if (!body) return body;
  return body
    .replace(/Enrolled in ".*?"/g, "Pam started outreach")
    .replace(/ · (vapi|bland|twilio|simulated)(\/dry)?/g, "")
    .replace(/"Dan core motion"/g, "the outreach")
    .replace(/Dan core motion/g, "outreach")
    .replace(/Status: \w+ → (\w+)/g, (_m, to: string) => `Now ${to}`);
}

export function recentActivity(limit = 12): FeedItem[] {
  const rows = getSqlite()
    .prepare(
      `SELECT a.dealership_id AS dealershipId, d.name, a.kind, a.body, a.created_at
       FROM activity a JOIN dealerships d ON d.id = a.dealership_id
       WHERE a.kind IN ('call','sms','gift','sequence','status_change')
       ORDER BY a.id DESC LIMIT ?`
    )
    .all(limit * 3) as FeedItem[];
  // Clean the copy, then drop the low-signal "started outreach" noise so the feed shows
  // what actually happened (calls, replies, gifts), not bulk enrollment events.
  return rows
    .map((r) => ({ ...r, body: cleanBody(r.body) }))
    .filter((r) => r.body !== "Pam started outreach")
    .slice(0, limit);
}

export function motionCounts(): { active: number; hot: number; dueSoon: number } {
  const db = getSqlite();
  const hot = (db.prepare("SELECT COUNT(*) AS n FROM account_crm WHERE status IN ('engaged','won')").get() as { n: number }).n;
  if (!hasSequenceTables()) return { active: 0, hot, dueSoon: 0 };
  const active = (db.prepare("SELECT COUNT(*) AS n FROM enrollments WHERE state='active'").get() as { n: number }).n;
  const dueSoon = (
    db
      .prepare("SELECT COUNT(*) AS n FROM enrollments WHERE state='active' AND (next_run_at IS NULL OR next_run_at <= datetime('now','+1 day'))")
      .get() as { n: number }
  ).n;
  return { active, hot, dueSoon };
}
