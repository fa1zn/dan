"use client";

import { useEffect, useState, useTransition } from "react";
import { Rocket } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from "@/components/ui";
import { previewSegmentAction, launchSegmentAction } from "@/app/sequences/actions";

export function SegmentLauncher({ oems, states }: { oems: string[]; states: string[] }) {
  const [oem, setOem] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!oem && !state && !city) {
      setCount(null);
      return;
    }
    const t = setTimeout(() => start(async () => setCount(await previewSegmentAction({ oem, state, city }))), 250);
    return () => clearTimeout(t);
  }, [oem, state, city]);

  const selectCls = "h-9 rounded-md border bg-transparent px-3 text-sm";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-1.5 text-base font-semibold text-foreground">
          <Rocket className="h-4 w-4 text-brand" /> Launch a segment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={launchSegmentAction} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Brand
            <select name="oem" value={oem} onChange={(e) => setOem(e.target.value)} className={selectCls}>
              <option value="">Any brand</option>
              {oems.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            State / Province
            <select name="state" value={state} onChange={(e) => setState(e.target.value)} className={selectCls}>
              <option value="">Any state</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            City (optional)
            <Input
              name="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Marysville"
              className="h-9 w-40"
            />
          </label>
          <Button type="submit" variant="brand" size="sm" disabled={count === 0}>
            <Rocket className="h-4 w-4" /> Launch{count != null ? ` ${Math.min(count, 100)}` : ""}
          </Button>
          <span className="text-sm text-muted-foreground">
            {pending
              ? "counting…"
              : count != null
                ? `≈ ${count} dealer${count === 1 ? "" : "s"} match${count > 100 ? " · first 100, paced" : ""}`
                : "pick a brand and/or area"}
          </span>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          Paced 2 min apart (compliant, never a blast). Each gets Pam&rsquo;s disclosed inquiry first; sales follow-ups wait for consent.
        </p>
      </CardContent>
    </Card>
  );
}
