import type { Channel } from "../../../lib/sequence-constants";
import type { ChannelAdapter, ChannelContext, ChannelResult } from "./types";

// Catalog cost for a simulated gift, so budget accounting is realistic without charging.
const GIFT_COST_CENTS: Record<string, number> = { doughnuts: 2400, pizza: 3200, local: 2800 };

/**
 * The free-tier default adapter. Logs what it WOULD send, charges nothing, and returns a
 * deterministic fake external_ref. This is what makes the whole engine runnable and
 * demo-able with no provider keys. Real adapters (twilio/vapi/bland/doordash) drop in
 * behind the same interface in channels/index.ts.
 */
export function simulatedChannel(kind: Channel): ChannelAdapter {
  return {
    kind,
    async send(ctx: ChannelContext): Promise<ChannelResult> {
      const externalRef = `sim_${kind}_${ctx.enrollmentId}_${ctx.stepIndex}`;
      const costCents =
        kind === "gift"
          ? ctx.step.giftBudgetCents ?? GIFT_COST_CENTS[ctx.step.giftKind ?? "doughnuts"] ?? 2500
          : 0;
      return {
        state: "sent",
        provider: "simulated",
        externalRef,
        costCents,
        result: { simulated: true, rendered: ctx.rendered, giftKind: ctx.step.giftKind },
      };
    },
  };
}
