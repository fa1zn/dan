"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, ChevronDown, X } from "lucide-react";
import { Input, Button, Badge } from "./ui";
import { cn } from "@/lib/ui";
import { STATUSES, STATUS_META } from "@/lib/crm-constants";
import type { FilterOptions } from "@/lib/queries";

export function AccountFilters({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  /** Apply a patch to the URL query; clearing a key removes it; page resets to 1. */
  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  // Debounced search box.
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
  const activeCount =
    [...sp.keys()].filter((k) => !["page", "sort", "dir"].includes(k)).length;

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

      <MultiSelect label="OEM" selected={oems} options={options.oems} onToggle={toggleOem} />

      <SelectBox
        label="Country"
        value={sp.get("country") ?? ""}
        options={options.countries}
        onChange={(v) => setParams({ country: v || null })}
      />
      <SelectBox
        label="Territory"
        value={sp.get("territory") ?? ""}
        options={options.territories}
        onChange={(v) => setParams({ territory: v || null })}
      />
      <SelectBox
        label="Tier"
        value={sp.get("tier") ?? ""}
        options={options.tiers.map((t) => ({ value: t, label: `Tier ${t}` }))}
        onChange={(v) => setParams({ tier: v || null })}
      />
      <SelectBox
        label="Status"
        value={sp.get("status") ?? ""}
        options={STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))}
        onChange={(v) => setParams({ status: v || null })}
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

function SelectBox({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: (string | { value: string; label: string })[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 appearance-none rounded-md border bg-background pl-3 pr-8 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          value ? "border-brand text-foreground" : "text-muted-foreground"
        )}
      >
        <option value="">{label}: All</option>
        {options.map((o) => {
          const val = typeof o === "string" ? o : o.value;
          const lab = typeof o === "string" ? o : o.label;
          return (
            <option key={val} value={val}>
              {lab}
            </option>
          );
        })}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function MultiSelect({
  label,
  selected,
  options,
  onToggle,
}: {
  label: string;
  selected: string[];
  options: string[];
  onToggle: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors hover:bg-accent",
          selected.length ? "border-brand text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        {selected.length > 0 && (
          <Badge variant="brand" className="ml-0.5 px-1.5 py-0">
            {selected.length}
          </Badge>
        )}
        <ChevronDown className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-72 w-56 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
          {options.map((o) => (
            <label
              key={o}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
            >
              <input
                type="checkbox"
                checked={selected.includes(o)}
                onChange={() => onToggle(o)}
                className="accent-brand"
              />
              {o}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
