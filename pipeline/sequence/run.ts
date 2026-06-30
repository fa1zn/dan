/**
 * Master Sequence CLI — the motion layer's own entry point (no edits to pipeline/run.ts).
 *
 *   tsx pipeline/sequence/run.ts <command>
 *
 *   seed                 insert/refresh the "Dan core motion" sequence
 *   enroll --name "X"    enroll a rooftop by name match (or --id N)
 *   tick                 advance all due enrollments (the cron target)
 *   status               print sequences, enrollments, and recent step runs
 *   simulate <id>        fast-forward one enrollment through every step (dry-run, ignores delays)
 *   demo                 self-contained: ensure Honda of Dublin → seed → enroll → simulate
 *
 * Dry-run by default. Set SEQUENCE_APPLY=1 to really place calls / send texts / order gifts.
 */
import "../lib/load-env";
import {
  enroll,
  findDealershipByName,
  getDealership,
  getEnrollmentById,
  getSequenceByName,
  getStepRuns,
  listSequences,
  seedDanSequence,
} from "../../lib/sequence";
import { getSqlite } from "../../lib/db";
import { DAN_SEQUENCE_NAME } from "../../lib/sequence-constants";
import { tick } from "./tick";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const cmd = process.argv[2];

  switch (cmd) {
    case "seed": {
      const id = seedDanSequence();
      console.log(`Seeded "${DAN_SEQUENCE_NAME}" (sequence #${id}).`);
      break;
    }

    case "enroll": {
      const seq = getSequenceByName(DAN_SEQUENCE_NAME) ?? { id: seedDanSequence(), name: DAN_SEQUENCE_NAME };
      const idArg = arg("--id");
      const nameArg = arg("--name");
      const d = idArg ? getDealership(Number(idArg)) : nameArg ? findDealershipByName(nameArg) : null;
      if (!d) {
        console.error("No rooftop found. Use --id <n> or --name \"<name>\".");
        process.exit(1);
      }
      const e = enroll(d.id, seq.id);
      console.log(`Enrolled ${d.name} (#${d.id}) in "${seq.name}" → enrollment #${e.id}, next run ${e.next_run_at}.`);
      break;
    }

    case "tick": {
      const r = await tick();
      console.log(`tick: processed ${r.processed} · sent ${r.sent} · skipped ${r.skipped} · exited ${r.exited} · completed ${r.completed}`);
      break;
    }

    case "simulate": {
      const id = Number(process.argv[3]);
      const e0 = getEnrollmentById(id);
      if (!e0) {
        console.error(`Enrollment #${id} not found.`);
        process.exit(1);
      }
      console.log(`\nSimulating enrollment #${id} (dry-run, ignoring delays)\n`);
      // Fast-forward: each pass advances one step; loop until the enrollment leaves 'active'.
      for (let guard = 0; guard < 20; guard++) {
        const e = getEnrollmentById(id);
        if (!e || e.state !== "active") break;
        const before = e.current_step;
        await tick({ enrollmentId: id, ignoreSchedule: true, apply: false });
        const after = getEnrollmentById(id);
        if (after && after.current_step === before && after.state === "active") break; // no progress
      }
      printTimeline(id);
      break;
    }

    case "status":
    default: {
      printStatus();
      break;
    }
  }
}

function printStatus() {
  const seqs = listSequences();
  console.log(`\nSequences (${seqs.length}):`);
  for (const s of seqs) console.log(`  #${s.id} ${s.name} — ${s.steps.length} steps${s.active ? "" : " (inactive)"}`);

  const db = getSqlite();
  const enr = db
    .prepare(
      `SELECT e.id, e.state, e.current_step, e.next_run_at, d.name
       FROM enrollments e JOIN dealerships d ON d.id = e.dealership_id
       ORDER BY e.id DESC LIMIT 20`
    )
    .all() as any[];
  console.log(`\nEnrollments (${enr.length} shown):`);
  if (!enr.length) console.log("  (none — run `enroll` or `demo`)");
  for (const e of enr)
    console.log(`  #${e.id} ${e.name} — ${e.state}, step ${e.current_step}, next ${e.next_run_at ?? "—"}`);
}

function printTimeline(enrollmentId: number) {
  const e = getEnrollmentById(enrollmentId);
  if (!e) return;
  const d = getDealership(e.dealership_id);
  const runs = getStepRuns(enrollmentId);
  console.log(`${d?.name} — enrollment #${enrollmentId} is now: ${e.state}${e.exit_reason ? ` (${e.exit_reason})` : ""}`);
  console.log(`Step runs:`);
  for (const r of runs) {
    const cost = r.cost_cents ? ` · $${(r.cost_cents / 100).toFixed(2)}` : "";
    console.log(`  [${r.step_index}] ${r.channel.padEnd(4)} ${r.state.padEnd(6)} ${r.provider ?? ""}${cost} ${r.external_ref ?? ""}`);
  }
  const db = getSqlite();
  const acts = db
    .prepare("SELECT kind, body, created_at FROM activity WHERE dealership_id = ? ORDER BY id DESC LIMIT 8")
    .all(e.dealership_id) as any[];
  console.log(`Activity timeline (newest first):`);
  for (const a of acts) console.log(`  · ${a.kind.padEnd(13)} ${a.body}`);
  const crm = db.prepare("SELECT status FROM account_crm WHERE dealership_id = ?").get(e.dealership_id) as any;
  console.log(`CRM status: ${crm?.status ?? "new"}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
