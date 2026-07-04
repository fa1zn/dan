"use client";

import { useState, useTransition } from "react";
import { Check, CalendarCheck, Video } from "lucide-react";
import { logCallAction } from "@/app/actions";
import { googleCalendarUrl, whenLabel, defaultSlotISO } from "@/lib/calendar";

// The dispositions a rep actually taps after dialing, each advances the account's status.
const OUTCOMES: { label: string; status: string; note: string; win?: boolean }[] = [
  { label: "Booked demo", status: "engaged", note: "Booked a demo", win: true },
  { label: "Interested", status: "engaged", note: "Connected, interested" },
  { label: "Left VM", status: "working", note: "Left voicemail" },
  { label: "No answer", status: "working", note: "No answer" },
  { label: "Not a fit", status: "lost", note: "Not interested / not a fit" },
];

export function LogCall({ id, dealer }: { id: number; dealer?: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [when, setWhen] = useState(defaultSlotISO());

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-brand">
        <Check className="h-3.5 w-3.5" /> Logged: {done}
        {done === "Booked demo" && <span className="text-muted-foreground">· Google Calendar opened with a Meet</span>}
      </span>
    );
  }

  // Booking a demo captures the time and opens a Google Calendar event (with Meet) for it.
  if (booking) {
    const confirm = () =>
      start(async () => {
        await logCallAction(id, "engaged", `Booked a demo for ${whenLabel(when)}`);
        window.open(
          googleCalendarUrl({
            title: `Pam demo${dealer ? `, ${dealer}` : ""}`,
            startISO: when,
            minutes: 30,
            details: "Pam product demo over Google Meet. If a Meet link isn't attached automatically, add Google Meet on the event.",
          }),
          "_blank"
        );
        setDone("Booked demo");
      });
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Demo time:</span>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="rounded-md border bg-background px-2 py-1 text-xs"
        />
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-full border border-brand bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand transition-colors hover:bg-brand/20 disabled:opacity-50"
        >
          <Video className="h-3 w-3" /> Book + Google Meet
        </button>
        <button type="button" onClick={() => setBooking(false)} className="text-xs text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Log call:</span>
      {OUTCOMES.map((o) => (
        <button
          key={o.label}
          type="button"
          disabled={pending}
          onClick={() =>
            o.win
              ? setBooking(true)
              : start(async () => {
                  await logCallAction(id, o.status, o.note);
                  setDone(o.label);
                })
          }
          className={
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 " +
            (o.win
              ? "border-brand bg-brand/10 text-brand hover:bg-brand/20"
              : "text-muted-foreground hover:border-foreground/30 hover:text-foreground")
          }
        >
          {o.win ? <CalendarCheck className="h-3 w-3" /> : null}
          {o.label}
        </button>
      ))}
    </div>
  );
}
