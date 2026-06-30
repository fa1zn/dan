import type { ChannelAdapter, ChannelContext, ChannelResult } from "./types";

/*
 * Real Bland.ai adapter — an autonomous voice agent that holds a live two-way call as Dan.
 * Unlike the Twilio TTS adapter (which just reads a script), Bland gets a conversational
 * "task" and talks with whoever answers: handles questions, books a meeting, ends politely.
 *
 * Only reached when SEQUENCE_APPLY=1 AND BLAND_API_KEY is set (see channels/index.ts).
 * SAFETY: SEQ_TEST_TO redirects the call to your own phone until you remove it.
 */

type Env = NodeJS.ProcessEnv;

function buildTask(ctx: ChannelContext): string {
  const d = ctx.dealership;
  const who = [d.oem ? `a ${d.oem} store` : null, d.city ? `in ${d.city}` : null].filter(Boolean).join(" ");
  return [
    "You are Dan, a friendly, concise sales rep for Pam — an AI sales platform for car dealerships.",
    `You're calling ${d.name}${who ? ` (${who})` : ""}.`,
    `Open with: "${ctx.rendered}"`,
    "Goal: briefly introduce Pam, gauge interest, and book a 10-minute follow-up with the GM or sales manager.",
    "Keep it under two minutes, sound natural, answer basic questions, and if they're not interested thank them and end the call politely.",
  ].join(" ");
}

export function blandCall(env: Env): ChannelAdapter {
  return {
    kind: "call",
    async send(ctx: ChannelContext): Promise<ChannelResult> {
      const to = env.SEQ_TEST_TO || ctx.contact?.phone || ctx.dealership.phone || null;
      if (!to) return { state: "failed", provider: "bland", error: "no destination phone" };
      try {
        const res = await fetch("https://api.bland.ai/v1/calls", {
          method: "POST",
          headers: { authorization: env.BLAND_API_KEY!, "Content-Type": "application/json" },
          body: JSON.stringify({
            phone_number: to,
            task: buildTask(ctx),
            voice: env.BLAND_VOICE || undefined,
            wait_for_greeting: true,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          status?: string;
          call_id?: string;
          message?: string;
          errors?: unknown;
        };
        if (res.ok && (json.status === "success" || json.call_id)) {
          return { state: "sent", provider: "bland", externalRef: json.call_id, result: { to } };
        }
        return { state: "failed", provider: "bland", error: json.message ?? JSON.stringify(json.errors) ?? `HTTP ${res.status}` };
      } catch (e) {
        return { state: "failed", provider: "bland", error: (e as Error).message };
      }
    },
  };
}
