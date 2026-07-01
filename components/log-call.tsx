"use client";

import { useState, useTransition } from "react";
import { Check, CalendarCheck } from "lucide-react";
import { logCallAction } from "@/app/actions";

// The dispositions a rep actually taps after dialing — each advances the account's status.
const OUTCOMES: { label: string; status: string; note: string; win?: boolean }[] = [
  { label: "Booked demo", status: "engaged", note: "Booked a demo", win: true },
  { label: "Interested", status: "engaged", note: "Connected — interested" },
  { label: "Left VM", status: "working", note: "Left voicemail" },
  { label: "No answer", status: "working", note: "No answer" },
  { label: "Not a fit", status: "lost", note: "Not interested / not a fit" },
];

export function LogCall({ id }: { id: number }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <Check className="h-3.5 w-3.5" /> Logged: {done}
      </span>
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
          onClick={() => start(async () => { await logCallAction(id, o.status, o.note); setDone(o.label); })}
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
