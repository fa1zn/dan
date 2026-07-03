import { tick } from "./tick";
import { syncCallOutcomes } from "./sync";
import { beatAutopilot } from "../../lib/meta";

/*
 * Autopilot: the always-on loop that makes the motion run itself. Each cycle advances every
 * due enrollment (tick) and pulls back any finished call outcomes (sync), then records a
 * heartbeat the UI reads to show "Autopilot active". Run it in the background:
 *   tsx pipeline/sequence/run.ts watch
 */
export async function watch(intervalSec = 20, log: (s: string) => void = console.log) {
  log(`Autopilot on — ticking every ${intervalSec}s. Ctrl-C to stop.`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const t = await tick({ log: () => {} });
      const s = await syncCallOutcomes();
      beatAutopilot();
      if (t.sent || t.exited || t.completed || s.synced) {
        log(`tick: sent ${t.sent} · exited ${t.exited} · completed ${t.completed} · outcomes ${s.synced}`);
      }
    } catch (e) {
      log(`autopilot error: ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, intervalSec * 1000));
  }
}
