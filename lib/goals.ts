import { getSqlite } from "./db";
import { getMeta } from "./meta";

/*
 * The rep's number. Sales lives and dies by the quota and the commission — so Dan ties
 * Pam's work directly to the rep's projected payout and the next bonus. Counts are real
 * (CRM + activity); the projection uses stated close-rate assumptions on the live pipeline.
 */

export interface GoalView {
  goal: number; // monthly deal target
  commissionPerDeal: number;
  bonusThreshold: number;
  bonusAmount: number;
  closed: number; // deals won
  booked: number; // meetings in play (engaged + won)
  pamBooked: number; // of those, how many Pam called
  inOutreach: number; // active outreach
  projected: number; // closed + likely conversions from the pipeline
  projectedPayout: number;
  toGoal: number; // deals from hitting goal (by projection)
  toBonus: number; // deals from unlocking the bonus
}

const DEFAULTS = { goal: 10, commissionPerDeal: 1500, bonusThreshold: 10, bonusAmount: 5000 };

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

  const pamBooked = count(
    `SELECT COUNT(DISTINCT a.dealership_id) n FROM activity a
     JOIN account_crm c ON c.dealership_id = a.dealership_id
     WHERE a.kind = 'call' AND c.status IN ('engaged','won')`
  );

  let inOutreach = 0;
  const hasSeq = !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='enrollments'").get();
  if (hasSeq) inOutreach = count("SELECT COUNT(*) n FROM enrollments WHERE state = 'active'");

  const goal = metaNum("goal_target", DEFAULTS.goal);
  const commissionPerDeal = metaNum("goal_commission", DEFAULTS.commissionPerDeal);
  const bonusThreshold = metaNum("goal_bonus_threshold", DEFAULTS.bonusThreshold);
  const bonusAmount = metaNum("goal_bonus_amount", DEFAULTS.bonusAmount);

  // Engaged meetings close ~50%; the broader outreach contributes ~10%.
  const projected = closed + Math.round(engaged * 0.5) + Math.round(inOutreach * 0.1);
  const projectedPayout = projected * commissionPerDeal + (projected >= bonusThreshold ? bonusAmount : 0);

  return {
    goal,
    commissionPerDeal,
    bonusThreshold,
    bonusAmount,
    closed,
    booked,
    pamBooked,
    inOutreach,
    projected,
    projectedPayout,
    toGoal: Math.max(0, goal - projected),
    toBonus: Math.max(0, bonusThreshold - projected),
  };
}
