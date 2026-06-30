"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Input, Label } from "@/components/ui";
import { saveConnectionAction, clearConnectionAction, testConnectionAction } from "@/app/connections/actions";
import type { ProviderStatus } from "@/lib/connections";

export function ConnectionsClient({ providers }: { providers: ProviderStatus[] }) {
  return (
    <div className="space-y-4">
      {providers.map((p) => (
        <ProviderCard key={p.id} p={p} />
      ))}
    </div>
  );
}

function ProviderCard({ p }: { p: ProviderStatus }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold text-foreground">{p.name}</CardTitle>
        <Badge variant={p.connected ? "success" : "muted"}>{p.connected ? "Connected" : "Not connected"}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{p.blurb}</p>
        <form action={saveConnectionAction} className="space-y-3">
          <input type="hidden" name="__provider" value={p.id} />
          {p.fields.map((f) => (
            <div key={f.name} className="space-y-1">
              <Label htmlFor={f.name}>{f.label}</Label>
              <Input
                id={f.name}
                name={f.name}
                type={f.secret ? "password" : "text"}
                placeholder={f.masked ?? f.placeholder ?? ""}
                autoComplete="off"
              />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="submit" variant="brand" size="sm">
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => start(async () => setResult(await testConnectionAction(p.id)))}
            >
              {pending ? "Testing…" : "Test"}
            </Button>
            {result && (
              <span className={result.ok ? "text-sm text-emerald-600 dark:text-emerald-400" : "text-sm text-red-600 dark:text-red-400"}>
                {result.message}
              </span>
            )}
          </div>
        </form>
        {p.connected && (
          <form action={clearConnectionAction}>
            <input type="hidden" name="__provider" value={p.id} />
            <button type="submit" className="text-xs text-muted-foreground underline hover:text-foreground">
              Disconnect
            </button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
