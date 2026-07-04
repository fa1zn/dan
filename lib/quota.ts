import { getSqlite } from "./db";

/*
 * Monthly quota + performance. The client's targets: 16 demos per month per salesperson,
 * plus deals closed and new MRR. Demos come from the "Booked a demo" call activity; deals
 * are accounts moved to "won" this month. MRR has no per-deal value yet, so we estimate it
 * from a single plan price (edit `planMrr` to Pam's real ARPU, or capture per-deal at win).
 */

export const QUOTA = {
  demosPerRep: 16, // the client's target: 16 demos / month / salesperson
  planMrr: 1200, // assumed monthly price of a closed dealership (placeholder ARPU)
};

function monthStartSql(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01 00:00:00`; // sqlite CURRENT_TIMESTAMP is 'YYYY-MM-DD HH:MM:SS'
}

export interface RepPerf {
  rep: string;
  demos: number;
  deals: number;
  mrr: number;
}

export interface MonthPerf {
  monthLabel: string;
  dayOfMonth: number;
  daysInMonth: number;
  demos: number;
  deals: number;
  mrr: number;
  demosQuota: number; // team quota = perRep * repCount
  perRepQuota: number;
  reps: RepPerf[];
}

export function getMonthlyPerformance(): MonthPerf {
  const db = getSqlite();
  const since = monthStartSql();

  const demoRows = db
    .prepare(
      `SELECT COALESCE(author,'Dan') AS rep, COUNT(*) AS n FROM activity
       WHERE kind='call' AND lower(body) LIKE '%demo%' AND created_at >= ? GROUP BY rep`
    )
    .all(since) as { rep: string; n: number }[];

  const dealRows = db
    .prepare(
      `SELECT COALESCE(owner,'Dan') AS rep, COUNT(*) AS n FROM account_crm
       WHERE status='won' AND updated_at >= ? GROUP BY rep`
    )
    .all(since) as { rep: string; n: number }[];

  const map = new Map<string, RepPerf>();
  const ensure = (r: string) => {
    let p = map.get(r);
    if (!p) map.set(r, (p = { rep: r, demos: 0, deals: 0, mrr: 0 }));
    return p;
  };
  for (const d of demoRows) ensure(d.rep).demos += d.n;
  for (const d of dealRows) {
    const p = ensure(d.rep);
    p.deals += d.n;
    p.mrr += d.n * QUOTA.planMrr;
  }
  if (map.size === 0) ensure("Dan");

  const reps = [...map.values()].sort((a, b) => b.demos - a.demos || b.deals - a.deals);
  const demos = reps.reduce((s, r) => s + r.demos, 0);
  const deals = reps.reduce((s, r) => s + r.deals, 0);
  const mrr = reps.reduce((s, r) => s + r.mrr, 0);

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return {
    monthLabel: now.toLocaleString("en-US", { month: "long", year: "numeric" }),
    dayOfMonth: now.getDate(),
    daysInMonth,
    demos,
    deals,
    mrr,
    demosQuota: QUOTA.demosPerRep * reps.length,
    perRepQuota: QUOTA.demosPerRep,
    reps,
  };
}
