import type { Step, Channel } from "../../../lib/sequence-constants";
import type { DealershipLite } from "../../../lib/sequence";

export interface ChannelContext {
  dealership: DealershipLite;
  contact?: { name?: string; phone?: string };
  rendered: string;
  step: Step;
  enrollmentId: number;
  stepIndex: number;
  /** true unless SEQUENCE_APPLY=1 — adapters must not really send/charge when dry. */
  dryRun: boolean;
}

export interface ChannelResult {
  state: "sent" | "failed" | "skipped";
  provider: string;
  externalRef?: string;
  costCents?: number;
  result?: unknown;
  error?: string;
}

export interface ChannelAdapter {
  kind: Channel;
  send(ctx: ChannelContext): Promise<ChannelResult>;
}
