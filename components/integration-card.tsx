"use client";

import { useState } from "react";
import { Check, ChevronDown, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "./ui";
import { cn } from "@/lib/ui";
import type { Integration, IntegrationStatus } from "@/lib/integrations";

const STATUS_META: Record<IntegrationStatus, { label: string; variant: "success" | "default" | "muted" }> = {
  connected: { label: "Connected", variant: "success" },
  available: { label: "Available", variant: "default" },
  "coming-soon": { label: "Coming soon", variant: "muted" },
};

export function IntegrationCard({ integration, status }: { integration: Integration; status: IntegrationStatus }) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[status];

  return (
    <Card className={cn(status === "connected" && "border-emerald-500/40")}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
              status === "connected" ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {integration.name[0]}
          </span>
          <div>
            <CardTitle className="text-base font-semibold text-foreground">{integration.name}</CardTitle>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {integration.category} · {integration.tier}
            </div>
          </div>
        </div>
        <Badge variant={meta.variant}>{meta.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{integration.blurb}</p>

        {integration.steps && status !== "connected" && (
          <div>
            <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
              {status === "coming-soon" ? <Lock className="h-3.5 w-3.5" /> : null}
              {status === "coming-soon" ? "Requirements" : "How to connect"}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
            </Button>
            {open && (
              <ol className="mt-3 space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
                {integration.steps.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-medium text-muted-foreground">{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {status === "connected" && (
          <div className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" /> Active — no further setup needed.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
