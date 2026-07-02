"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, ChevronDown, X } from "lucide-react";
import {
  Input,
  Button,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "./ui";
import { cn } from "@/lib/ui";
import { STATUSES, STATUS_META } from "@/lib/crm-constants";
import type { FilterOptions } from "@/lib/queries";

const ALL = "__all";

export function AccountFilters({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const [q, setQ] = useState(sp.get("q") ?? "");
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => setParams({ q: q || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const oems = (sp.get("oem") ?? "").split(",").filter(Boolean);
  const toggleOem = (oem: string) => {
    const next = oems.includes(oem) ? oems.filter((o) => o !== oem) : [...oems, oem];
    setParams({ oem: next.join(",") || null });
  };

  const toggleFlag = (key: string) => setParams({ [key]: sp.get(key) ? null : "1" });
  const activeCount = [...sp.keys()].filter((k) => !["page", "sort", "dir"].includes(k)).length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, city, or domain…"
          className="pl-8"
        />
      </div>

      {/* OEM multi-select */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors hover:bg-accent",
              oems.length ? "border-brand text-foreground" : "text-muted-foreground"
            )}
          >
            OEM
            {oems.length > 0 && (
              <Badge variant="brand" className="ml-0.5 px-1.5 py-0">
                {oems.length}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {options.oems.map((o) => (
            <DropdownMenuCheckboxItem key={o.value} checked={oems.includes(o.value)} onCheckedChange={() => toggleOem(o.value)}>
              {o.value} <span className="ml-1 text-xs text-muted-foreground">({o.count.toLocaleString()})</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <FilterSelect
        label="Country"
        value={sp.get("country")}
        options={options.countries.map((c) => ({ value: c.value, label: `${c.value} (${c.count.toLocaleString()})` }))}
        onChange={(v) => setParams({ country: v })}
      />
      <FilterSelect
        label="State"
        value={sp.get("state")}
        options={options.states.map((s) => ({ value: s.value, label: `${s.value} (${s.count.toLocaleString()})` }))}
        onChange={(v) => setParams({ state: v })}
      />
      <FilterSelect
        label="Territory"
        value={sp.get("territory")}
        options={options.territories.map((t) => ({ value: t.value, label: `${t.value} (${t.count.toLocaleString()})` }))}
        onChange={(v) => setParams({ territory: v })}
      />
      <FilterSelect
        label="Tier"
        value={sp.get("tier")}
        options={options.tiers.map((t) => ({ value: t.value, label: `Tier ${t.value} (${t.count.toLocaleString()})` }))}
        onChange={(v) => setParams({ tier: v })}
      />
      <FilterSelect
        label="Status"
        value={sp.get("status")}
        options={STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))}
        onChange={(v) => setParams({ status: v })}
      />

      <FlagButton on={!!sp.get("hasWebsite")} onClick={() => toggleFlag("hasWebsite")}>
        Has website
      </FlagButton>
      <FlagButton on={!!sp.get("hasPhone")} onClick={() => toggleFlag("hasPhone")}>
        Has phone
      </FlagButton>
      <FlagButton on={!!sp.get("brandConfirmed")} onClick={() => toggleFlag("brandConfirmed")}>
        Brand confirmed
      </FlagButton>

      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            router.replace(pathname, { scroll: false });
          }}
        >
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      )}
    </div>
  );
}

function FlagButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center rounded-md border px-3 text-sm transition-colors",
        on ? "border-brand bg-brand/10 text-brand" : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: (string | { value: string; label: string })[];
  onChange: (v: string | null) => void;
}) {
  const norm = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <Select value={value ?? undefined} onValueChange={(v) => onChange(v === ALL ? null : v)}>
      <SelectTrigger className={cn(value ? "border-brand text-foreground" : "text-muted-foreground")}>
        <SelectValue placeholder={`${label}: All`} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label}: All</SelectItem>
        {norm.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
