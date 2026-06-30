import type { ChannelAdapter, ChannelContext, ChannelResult } from "./types";
import { buildCallTask } from "../call-script";

/*
 * Real Bland.ai adapter — an autonomous voice agent that holds a live two-way call as Dan.
 * Unlike the Twilio TTS adapter (which just reads a script), Bland gets a conversational
 * "task" and talks with whoever answers: handles questions, books a meeting, ends politely.
 *
 * Only reached when the rep selects Bland as their call provider AND BLAND_API_KEY is set.
 * SAFETY: SEQ_TEST_TO redirects the call to your own phone until you remove it.
 */

type Env = NodeJS.ProcessEnv;

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
            task: buildCallTask(ctx),
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
