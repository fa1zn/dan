import { NextResponse } from "next/server";
import { syncCalendar } from "@/lib/calendar";

/** Re-pull today's events from the connected calendar, then return to Territory. */
export async function GET(req: Request) {
  const base = process.env.APP_BASE_URL || new URL(req.url).origin;
  try {
    await syncCalendar();
    return NextResponse.redirect(`${base}/territory?calendar=synced`);
  } catch {
    return NextResponse.redirect(`${base}/territory?calendar=error`);
  }
}
