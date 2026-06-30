import type { ChannelContext } from "./channels/types";

/** The conversational objective handed to a voice agent (Bland / Vapi) as its system task. */
export function buildCallTask(ctx: ChannelContext): string {
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
