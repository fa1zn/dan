import { getSqlite } from "./db";
import { getMeta } from "./meta";

/*
 * The rep's month, stated plainly — closed vs quota, and the value of what's in play.
 * No gamification, no pitch: this is their job, shown like a sales rep's own numbers.
 * Counts are real (CRM + activity).
 */

export interface GoalView {
  goal: number; // monthly deal target
  commissionPerDeal: number;
  closed: number; // deals won
  booked: number; // meetings in play (engaged + won)
  inOutreach: number; // dealers Pam is actively working
  openDeals: number; // in outreach + engaged — the live pipeline
  pipelineValue: number; // openDeals × commissionPerDeal
}

const DEFAULTS = { goal: 10, commissionPerDeal: 1500 };

function metaNum(key: string, fallback: number): number {
  const v = getMeta(key);
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export function computeGoal(): GoalView {
  const db = getSqlite();
  const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;

  const closed = count("SELECT COUNT(*) n FROM account_crm WHERE status = 'won'");
  const engaged = count("SELECT COUNT(*) n FROM account_crm WHERE status = 'engaged'");
  const booked = engaged + closed;

  let inOutreach = 0;
  const hasSeq = !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='enrollments'").get();
  if (hasSeq) inOutreach = count("SELECT COUNT(*) n FROM enrollments WHERE state = 'active'");

  const goal = metaNum("goal_target", DEFAULTS.goal);
  const commissionPerDeal = metaNum("goal_commission", DEFAULTS.commissionPerDeal);

  const openDeals = inOutreach + engaged;
  const pipelineValue = openDeals * commissionPerDeal;

  return { goal, commissionPerDeal, closed, booked, inOutreach, openDeals, pipelineValue };
}
