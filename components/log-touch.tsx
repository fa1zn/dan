"use client";

import { useState, useTransition } from "react";
import { Phone, MessageSquare, Gift, Loader2, Check } from "lucide-react";
import { logTouchAction } from "@/app/actions";
import { cn } from "@/lib/ui";

type Channel = "call" | "text" | "gift";

const TOUCHES: { channel: Channel; label: string; icon: typeof Phone; placeholder: string }[] = [
  { channel: "call", label: "Log call", icon: Phone, placeholder: "Are they hiring? Who should you talk to? e.g. GM is Jane Ruiz" },
  { channel: "text", label: "Log text", icon: MessageSquare, placeholder: "What you texted, e.g. Followed up with Jane about the opening" },
  { channel: "gift", label: "Log gift", icon: Gift, placeholder: "What you sent, e.g. Cake to Jane at the front desk" },
];

/** One-tap manual logging of the call → text → gift motion. Every touch lands on the
 *  record's timeline, whether or not Pam ran it automatically. */
export function LogTouch({ id }: { id: number }) {
  const [open, setOpen] = useState<Channel | null>(null);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [justLogged, setJustLogged] = useState<Channel | null>(null);

  function submit(channel: Channel) {
    start(async () => {
      await logTouchAction(id, channel, note);
      setNote("");
      setOpen(null);
      setJustLogged(channel);
      setTimeout(() => setJustLogged(null), 2000);
    });
  }

  const active = TOUCHES.find((t) => t.channel === open);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-2.5 text-xs uppercase tracking-wide text-muted-foreground">Log a touch</div>
      <div className="flex flex-wrap gap-2">
        {TOUCHES.map((t) => {
          const Icon = t.icon;
          const isOpen = open === t.channel;
          return (
            <button
              key={t.channel}
              onClick={() => {
                setOpen(isOpen ? null : t.channel);
                setNote("");
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                isOpen ? "border-brand bg-brand/10 text-brand" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {justLogged === t.channel ? <Check className="h-4 w-4 text-emerald-600" /> : <Icon className="h-4 w-4" />}
              {t.label}
            </button>
          );
        })}
      </div>

      {active && (
        <div className="mt-3 flex gap-2">
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={active.placeholder}
            onKeyDown={(e) => e.key === "Enter" && submit(active.channel)}
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/40"
          />
          <button
            onClick={() => submit(active.channel)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Log
          </button>
        </div>
      )}
      <p className="mt-2.5 text-xs text-muted-foreground">
        Logs to this dealer&rsquo;s timeline. Dan&rsquo;s automated touches land here too, one history, whether you run it
        or he does.
      </p>
    </div>
  );
}
