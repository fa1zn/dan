"use client";

import { useEffect, useState } from "react";
import { Sparkles, Database } from "lucide-react";
import { cn } from "@/lib/ui";

type View = "enriched" | "raw";

/**
 * Product-wide mode: the whole app shows EITHER Dan's enriched/verified data or the
 * RAW scraped source data. One product, both layers — flip anytime. Persisted so it's
 * a real mode, not a per-page toggle. Sets data-view on <html>; CSS hides the other
 * layer (.enriched-only / .raw-only).
 */
export function DataViewToggle() {
  const [view, setView] = useState<View>("enriched");

  useEffect(() => {
    const saved = (localStorage.getItem("dan-view") as View) || "enriched";
    setView(saved);
    document.documentElement.dataset.view = saved;
  }, []);

  function choose(v: View) {
    setView(v);
    document.documentElement.dataset.view = v;
    try {
      localStorage.setItem("dan-view", v);
    } catch {}
  }

  return (
    <div className="inline-flex items-center rounded-full border bg-card p-0.5 text-xs" title="Switch the whole app between Dan's enriched data and the raw scraped source">
      {(
        [
          { id: "enriched", label: "Enriched", icon: Sparkles },
          { id: "raw", label: "Raw", icon: Database },
        ] as const
      ).map((o) => {
        const Icon = o.icon;
        const active = view === o.id;
        return (
          <button
            key={o.id}
            onClick={() => choose(o.id)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium transition-colors",
              active ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3 w-3" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
