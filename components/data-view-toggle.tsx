"use client";

import { useEffect, useState } from "react";
import { Sparkles, Database } from "lucide-react";
import { cn } from "@/lib/ui";

/**
 * Flip the whole record between ENRICHED (Google/ZoomInfo/HubSpot-augmented) and
 * RAW (the untouched scraped source data). Sets data-view on <html>; CSS hides the
 * other layer. Lets a rep trust the data — the raw is always one click away.
 */
export function DataViewToggle() {
  const [view, setView] = useState<"enriched" | "raw">("enriched");
  useEffect(() => {
    document.documentElement.dataset.view = view;
    return () => {
      delete document.documentElement.dataset.view;
    };
  }, [view]);

  return (
    <div className="inline-flex items-center rounded-full border bg-card p-0.5 text-xs">
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
            onClick={() => setView(o.id)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium transition-colors",
              active ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            title={o.id === "raw" ? "Show the original scraped source data" : "Show Dan's enriched, verified data"}
          >
            <Icon className="h-3 w-3" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
