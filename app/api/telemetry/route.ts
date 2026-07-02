import { NextResponse } from "next/server";
import { recordEvents, isGloballyEnabled } from "@/lib/telemetry";

/**
 * Ingest a batch of ride-along events. Silently no-ops (200) unless the global flag is on
 * AND the rep has opted in — both checks live in recordEvents. Never errors loudly, so a
 * disabled or unconsented client just gets an accepted:0 and moves on.
 */
export async function POST(req: Request) {
  if (!isGloballyEnabled()) return NextResponse.json({ accepted: 0 });
  let body: { repId?: string; sessionId?: string; events?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ accepted: 0 });
  }
  const repId = typeof body.repId === "string" ? body.repId : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const events = Array.isArray(body.events) ? body.events : [];
  const accepted = recordEvents(repId, sessionId, events as never);
  return NextResponse.json({ accepted });
}
