import { NextResponse } from "next/server";
import { disconnectCalendar } from "@/lib/calendar";

/** Disconnect the calendar: drop the stored tokens and the synced events. */
export async function GET(req: Request) {
  const base = process.env.APP_BASE_URL || new URL(req.url).origin;
  disconnectCalendar();
  return NextResponse.redirect(`${base}/territory?calendar=disconnected`);
}
