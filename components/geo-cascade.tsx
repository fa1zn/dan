"use client";

import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui";
import type { GeoTree } from "@/lib/geo";
import { cn } from "@/lib/ui";

const ANY = "__any";

export interface GeoValue {
  country: string;
  state: string;
  city: string;
}

/**
 * The Country -> State/province -> City picker used in Book and Prospect. It is a guided
 * cascade: State is inert until a Country is chosen, City until a State is chosen, and each
 * level only lists values that exist under the one above, with live counts. Changing a level
 * clears the levels beneath it so you can never hold an impossible combination.
 */
export function GeoCascade({
  tree,
  value,
  onChange,
  withLabels = false,
  className,
}: {
  tree: GeoTree;
  value: GeoValue;
  onChange: (v: GeoValue) => void;
  withLabels?: boolean;
  className?: string;
}) {
  const { country, state, city } = value;
  const states = country ? tree.states[country] ?? [] : [];
  const cities = country && state ? tree.cities[`${country}|${state}`] ?? [] : [];
  const fmt = (n: number) => n.toLocaleString();

  const wrap = (label: string, node: React.ReactNode) =>
    withLabels ? (
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {node}
      </div>
    ) : (
      node
    );

  const triggerCls = (active: boolean) => cn(withLabels && "w-full sm:w-48", active ? "border-brand text-foreground" : "text-muted-foreground");

  return (
    <div className={cn("flex flex-wrap items-end gap-2", className)}>
      {wrap(
        "Country",
        <Select value={country || ANY} onValueChange={(v) => onChange({ country: v === ANY ? "" : v, state: "", city: "" })}>
          <SelectTrigger className={triggerCls(!!country)}>
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any country</SelectItem>
            {tree.countries.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label} ({fmt(c.count)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {wrap(
        "State / province",
        <Select value={state || ANY} disabled={!country} onValueChange={(v) => onChange({ country, state: v === ANY ? "" : v, city: "" })}>
          <SelectTrigger className={triggerCls(!!state)}>
            <SelectValue placeholder={country ? "State / province" : "Pick a country first"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any state / province</SelectItem>
            {states.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label} ({fmt(s.count)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {wrap(
        "City / metro",
        <Select value={city || ANY} disabled={!state} onValueChange={(v) => onChange({ country, state, city: v === ANY ? "" : v })}>
          <SelectTrigger className={triggerCls(!!city)}>
            <SelectValue placeholder={state ? "City / metro" : "Pick a state first"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any city</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label} ({fmt(c.count)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
