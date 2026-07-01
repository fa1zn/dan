"use client";

import { useState, useTransition } from "react";
import { Plug, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { connectHubspotAction } from "@/app/connections/actions";

export function HubspotConnect({ connected }: { connected: boolean }) {
  const [token, setToken] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function run() {
    start(async () => {
      const r = await connectHubspotAction(token);
      setResult(r);
      if (r.ok) setToken("");
    });
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ff7a59]/10 text-[#ff7a59]">
            <Plug className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-2 font-medium">
              HubSpot
              {connected && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Connected
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Connect your HubSpot and Dan matches your accounts to our rooftops — your pipeline, deal owner, and last
              activity overlaid on top of our data. Read-only; nothing is written back to HubSpot.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={connected ? "Paste a new token to replace, or re-sync below" : "HubSpot private-app token (pat-…)"}
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/40"
        />
        <button
          onClick={run}
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
          {connected ? "Re-sync" : "Connect & match"}
        </button>
      </div>

      {result && (
        <div
          className={
            "mt-3 flex items-start gap-2 rounded-md px-3 py-2 text-sm " +
            (result.ok ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-red-500/10 text-red-800 dark:text-red-300")
          }
        >
          {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{result.message}</span>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Create a token in HubSpot → Settings → Integrations → Private Apps, with scopes{" "}
        <code className="text-foreground">crm.objects.companies.read</code>,{" "}
        <code className="text-foreground">crm.objects.contacts.read</code>, and{" "}
        <code className="text-foreground">crm.objects.owners.read</code>.
      </p>
    </div>
  );
}
