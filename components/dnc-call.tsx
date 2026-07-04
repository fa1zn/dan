"use client";

import { Phone, PhoneOff } from "lucide-react";

/**
 * DNC-enforced call link. ZoomInfo flags numbers on the federal Do-Not-Call registry;
 * dialing one is real TCPA liability ($500–$1,500/call). For a flagged number we do NOT
 * render a one-tap call, we render a red "Do Not Call" control that requires an explicit
 * acknowledgement before it will dial. Compliance is enforced at the point of action.
 */
export function DncCall({ number, dnc, size = "sm" }: { number: string; dnc?: boolean; size?: "sm" | "xs" }) {
  const tel = number.replace(/[^\d+]/g, "");
  const cls = size === "xs" ? "text-xs" : "text-sm";
  if (dnc) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm(`⚠ DO NOT CALL\n\n${number} is on the federal Do-Not-Call registry. Calling it may violate the TCPA ($500–$1,500 per call). Proceed anyway?`)) {
            window.location.href = `tel:${tel}`;
          }
        }}
        className={`inline-flex items-center gap-1 font-medium text-red-600 hover:underline dark:text-red-400 ${cls}`}
        title="On the federal Do-Not-Call registry, calling may violate TCPA"
      >
        <PhoneOff className="h-3.5 w-3.5 shrink-0" /> {number} <span className="rounded bg-red-100 px-1 text-[10px] uppercase text-red-700 dark:bg-red-950 dark:text-red-300">Do Not Call</span>
      </button>
    );
  }
  return (
    <a href={`tel:${tel}`} onClick={(e) => e.stopPropagation()} className={`inline-flex items-center gap-1 font-medium text-brand hover:underline ${cls}`}>
      <Phone className="h-3.5 w-3.5 shrink-0" /> {number}
    </a>
  );
}
