"use client";

import { useEffect, useState, useTransition } from "react";
import { Rocket } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui";
import { previewSegmentAction, launchSegmentAction } from "@/app/sequences/actions";
import { toast } from "@/components/toast";

const ANY = "__any";

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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-1.5 text-base font-semibold text-foreground">
          <Rocket className="h-4 w-4 text-brand" /> Put Dan on a market
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          action={launchSegmentAction}
          onSubmit={() => toast("Dan's starting on these. He'll call them.", "call")}
          className="flex flex-wrap items-end gap-4"
        >
          <input type="hidden" name="oem" value={oem} />
          <input type="hidden" name="state" value={state} />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Brand</label>
            <Select value={oem || ANY} onValueChange={(v) => setOem(v === ANY ? "" : v)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any brand</SelectItem>
                {oems.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">State / province</label>
            <Select value={state || ANY} onValueChange={(v) => setState(v === ANY ? "" : v)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any state</SelectItem>
                {states.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">City (optional)</label>
            <Input
              name="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Marysville"
              className="h-9 w-40"
            />
          </div>

          <Button type="submit" variant="brand" size="sm" disabled={count === 0}>
            <Rocket className="h-4 w-4" /> Launch{count != null ? ` ${Math.min(count, 100)}` : ""}
          </Button>
          <span className="pb-1.5 text-sm text-muted-foreground">
            {pending
              ? "counting…"
              : count != null
                ? `≈ ${count} dealer${count === 1 ? "" : "s"} match${count > 100 ? " · first 100, paced" : ""}`
                : "pick a brand and/or area"}
          </span>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Dan calls one every couple of minutes, never all at once. He says he&rsquo;s an AI and never sells on the
          first call.
        </p>
      </CardContent>
    </Card>
  );
}
