import { activityKindFor, type Step } from "../../lib/sequence-constants";
import {
  advance,
  completeEnrollment,
  exitEnrollment,
  getCrm,
  getDealership,
  getEnrollmentById,
  getSequence,
  getStepRun,
  giftSpentCents,
  listDueEnrollments,
  logSeqActivity,
  recordStepRun,
  setStatus,
  type EnrollmentRow,
} from "../../lib/sequence";
import { resolveChannel } from "./channels";
import { render } from "./render";

const EXIT_STATUSES = new Set(["engaged", "won", "lost"]);

export interface TickOptions {
  now?: Date;
  apply?: boolean;
  /** Run due AND not-yet-due enrollments (used by `simulate`). */
  ignoreSchedule?: boolean;
  /** Only this enrollment (used by `simulate`). */
  enrollmentId?: number;
  log?: (s: string) => void;
}

export interface TickResult {
  processed: number;
  sent: number;
  skipped: number;
  exited: number;
  completed: number;
}

const intCents = (name: string, fallback: number) => {
  const v = process.env[name];
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

/** One pass of the scheduler. Idempotent and resumable — safe to run on a cron. */
export async function tick(opts: TickOptions = {}): Promise<TickResult> {
  const log = opts.log ?? ((s: string) => console.log(s));
  const res: TickResult = { processed: 0, sent: 0, skipped: 0, exited: 0, completed: 0 };

  if (process.env.SEQUENCE_ENABLED === "0") {
    log("SEQUENCE_ENABLED=0 — kill switch on, no-op.");
    return res;
  }

  const apply = opts.apply ?? process.env.SEQUENCE_APPLY === "1";
  const now = opts.now ?? new Date();
  const giftMax = intCents("SEQ_GIFT_MAX_CENTS", 4000);
  const giftBudget = intCents("SEQ_GIFT_BUDGET_CENTS", 50000);

  const due = opts.enrollmentId
    ? ([getEnrollmentById(opts.enrollmentId)].filter(Boolean) as EnrollmentRow[])
    : listDueEnrollments(now.toISOString(), opts.ignoreSchedule);

  for (const e of due) {
    if (e.state !== "active") continue;
    res.processed++;

    const seq = getSequence(e.sequence_id);
    if (!seq) {
      exitEnrollment(e.id, "sequence-missing");
      continue;
    }
    const steps = seq.steps as Step[];

    // Exit guard: a live deal stops the motion.
    const crm = getCrm(e.dealership_id);
    if (EXIT_STATUSES.has(crm.status)) {
      exitEnrollment(e.id, crm.status);
      res.exited++;
      log(`exit  · enrollment ${e.id} · ${crm.status}`);
      continue;
    }

    if (e.current_step >= steps.length) {
      completeEnrollment(e.id);
      res.completed++;
      continue;
    }

    const step = steps[e.current_step];

    // Idempotency: never re-dispatch a step already sent.
    const existing = getStepRun(e.id, e.current_step);
    if (existing?.state === "sent") {
      advance(e.id, steps, now);
      continue;
    }

    const dealership = getDealership(e.dealership_id);
    if (!dealership) {
      exitEnrollment(e.id, "dealership-missing");
      continue;
    }
    const contact = dealership.contacts?.[0];

    // Gift budget rail.
    if (step.channel === "gift") {
      const cost = step.giftBudgetCents ?? giftMax;
      if (cost > giftMax || giftSpentCents() + cost > giftBudget) {
        recordStepRun(e.id, e.current_step, "gift", now.toISOString(), {
          state: "skipped",
          provider: "budget",
          error: `over budget (cap ${giftMax}, spent ${giftSpentCents()}, budget ${giftBudget})`,
        });
        logSeqActivity(e.dealership_id, "gift", "Gift skipped: budget cap reached");
        res.skipped++;
        advance(e.id, steps, now);
        continue;
      }
    }

    const rendered = render(step.template, dealership, contact);
    const channel = resolveChannel(step.channel, process.env);
    const result = await channel.send({
      dealership,
      contact,
      rendered,
      step,
      enrollmentId: e.id,
      stepIndex: e.current_step,
      dryRun: !apply,
    });

    recordStepRun(e.id, e.current_step, step.channel, now.toISOString(), {
      state: result.state,
      provider: result.provider,
      externalRef: result.externalRef,
      costCents: result.costCents,
      payload: { rendered, giftKind: step.giftKind },
      result: result.result,
      error: result.error,
    });

    const tag = apply ? result.provider : `${result.provider}/dry`;
    logSeqActivity(e.dealership_id, activityKindFor(step.channel), summarize(step, rendered, tag));

    if (result.state === "sent") {
      if (crm.status === "new") setStatus(e.dealership_id, "working");
      advance(e.id, steps, now);
      res.sent++;
      log(`sent  · enrollment ${e.id} · ${step.channel.padEnd(4)} · ${tag} · ${rendered.slice(0, 60)}`);
    } else {
      logSeqActivity(e.dealership_id, "sequence", `Step ${e.current_step} ${result.state}: ${result.error ?? ""}`);
      res.skipped++;
      // Simple policy for the MVP: drop a failed step and move on so the motion never stalls.
      advance(e.id, steps, now);
      log(`fail  · enrollment ${e.id} · ${step.channel} · ${result.error ?? "unknown"}`);
    }
  }

  return res;
}

function summarize(step: Step, rendered: string, tag: string): string {
  const verb =
    step.channel === "call"
      ? "Call placed"
      : step.channel === "sms"
        ? "Text sent"
        : `Gift sent (${step.giftKind ?? "edible"})`;
  return `${verb} · ${tag} · "${rendered.slice(0, 80)}${rendered.length > 80 ? "…" : ""}"`;
}
