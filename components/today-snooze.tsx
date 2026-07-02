"use client";

import { useState, useTransition } from "react";
import { Clock, Loader2 } from "lucide-react";
import { snoozeTodayAction } from "@/app/actions";

// Spans inlined (not imported from lib/today) so this client component never pulls the DB layer.
const SPANS: { span: "tomorrow" | "next_week" | "next_quarter"; label: string }[] = [
  { span: "tomorrow", label: "Tomorrow" },
  { span: "next_week", label: "Next week" },
  { span: "next_quarter", label: "Next quarter" },
];

/** One-tap "Not now" → pick when. Today hides the account until then. */
export function SnoozeMenu({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  if (pending) {
    return (
      <span className="inline-flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Snoozing…
      </span>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Clock className="h-3.5 w-3.5" /> Not now
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-1">
      {SPANS.map((s) => (
        <button
          key={s.span}
          onClick={() => start(async () => { await snoozeTodayAction(id, s.span); })}
          className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {s.label}
        </button>
      ))}
      <button onClick={() => setOpen(false)} className="px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground">
        ✕
      </button>
    </div>
  );
}
