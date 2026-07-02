/**
 * Admin CLI for ride-along telemetry. Makes retention and offboarding real commands, not
 * promises in a doc.
 *
 *   tsx pipeline/telemetry-admin.ts status            # counts by rep + opt-in decisions
 *   tsx pipeline/telemetry-admin.ts purge [days]      # drop events older than N (default 30)
 *   tsx pipeline/telemetry-admin.ts wipe <rep_id>     # delete one rep's events + opt-in
 *   tsx pipeline/telemetry-admin.ts export <rep_id>   # dump one rep's events as JSON (analysis)
 */
import { getSqlite } from "../lib/db";
import { purgeOld, wipeRep, RETENTION_DAYS } from "../lib/telemetry";

const [cmd, arg] = process.argv.slice(2);
const db = getSqlite();

function status() {
  const opt = db.prepare("SELECT rep_id, decision, label, decided_at FROM telemetry_optin ORDER BY decided_at DESC").all();
  const ev = db.prepare("SELECT rep_id, COUNT(*) n, MIN(created_at) first, MAX(created_at) last FROM telemetry_event GROUP BY rep_id").all();
  console.log("opt-in decisions:", JSON.stringify(opt, null, 2));
  console.log("events by rep:", JSON.stringify(ev, null, 2));
}

switch (cmd) {
  case "status":
    status();
    break;
  case "purge": {
    const days = arg ? Number(arg) : RETENTION_DAYS;
    console.log(`purged ${purgeOld(days)} events older than ${days} days`);
    break;
  }
  case "wipe": {
    if (!arg) throw new Error("usage: wipe <rep_id>");
    console.log("wiped:", wipeRep(arg));
    break;
  }
  case "export": {
    if (!arg) throw new Error("usage: export <rep_id>");
    const rows = db.prepare("SELECT * FROM telemetry_event WHERE rep_id = ? ORDER BY id").all(arg);
    console.log(JSON.stringify(rows, null, 2));
    break;
  }
  default:
    console.log("commands: status | purge [days] | wipe <rep_id> | export <rep_id>");
}
