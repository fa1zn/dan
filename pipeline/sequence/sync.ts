import { listUnsyncedCallRuns, setStepOutcome, setStatus, logSeqActivity } from "../../lib/sequence";
import { repEnv } from "../../lib/connections";

/*
 * Pull call outcomes back from the voice provider after a call ends: a short summary, the
 * end reason, and whether the prospect was interested. Writes the summary to the activity
 * timeline and auto-moves interested rooftops to "engaged" (which surfaces them as hot) —
 * so a rep never has to listen to a dead call.
 */

interface Outcome {
  ended: boolean;
  summary?: string;
  interested?: boolean;
  reason?: string;
}

async function vapiOutcome(key: string, id: string): Promise<Outcome | null> {
  try {
    const res = await fetch(`https://api.vapi.ai/call/${id}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) return null;
    const d = (await res.json()) as {
      status?: string;
      endedReason?: string;
      summary?: string;
      analysis?: { summary?: string; successEvaluation?: unknown };
    };
    if (d.status !== "ended") return { ended: false };
    const summary = d.analysis?.summary || d.summary;
    const se = d.analysis?.successEvaluation;
    const interested = typeof se === "string" ? /true|yes|pass|success|interest/i.test(se) : !!se;
    return { ended: true, summary, interested, reason: d.endedReason };
  } catch {
    return null;
  }
}

async function blandOutcome(key: string, id: string): Promise<Outcome | null> {
  try {
    const res = await fetch(`https://api.bland.ai/v1/calls/${id}`, { headers: { authorization: key } });
    if (!res.ok) return null;
    const d = (await res.json()) as {
      completed?: boolean;
      status?: string;
      summary?: string;
      disposition_tag?: string;
    };
    if (!d.completed && d.status !== "completed") return { ended: false };
    const interested = /interest|book|meeting|follow|warm|success/i.test(`${d.summary} ${d.disposition_tag}`);
    return { ended: true, summary: d.summary, interested, reason: d.disposition_tag };
  } catch {
    return null;
  }
}

export async function syncCallOutcomes(opts?: { log?: (s: string) => void }): Promise<{ synced: number; checked: number }> {
  const env = repEnv();
  const log = opts?.log ?? (() => {});
  const runs = listUnsyncedCallRuns();
  let synced = 0;

  for (const r of runs) {
    let outcome: Outcome | null = null;
    if (r.provider === "vapi" && env.VAPI_API_KEY) outcome = await vapiOutcome(env.VAPI_API_KEY, r.external_ref);
    else if (r.provider === "bland" && env.BLAND_API_KEY) outcome = await blandOutcome(env.BLAND_API_KEY, r.external_ref);

    if (!outcome || !outcome.ended) continue;

    const summary = outcome.summary?.trim() || `Call ended — ${outcome.reason ?? "completed"}`;
    setStepOutcome(r.enrollment_id, r.step_index, summary);
    logSeqActivity(r.dealership_id, "call", `Call outcome: ${summary}`);
    if (outcome.interested) {
      // Consent / interest captured on the inquiry call → opens the gate for the sales follow-up.
      setStatus(r.dealership_id, "engaged");
    } else {
      logSeqActivity(r.dealership_id, "sequence", "No follow-up consent captured — sales touches held (compliance gate)");
    }
    synced++;
    log(`outcome · dealership ${r.dealership_id}${outcome.interested ? " · HOT" : ""} · ${summary.slice(0, 70)}`);
  }

  return { synced, checked: runs.length };
}
