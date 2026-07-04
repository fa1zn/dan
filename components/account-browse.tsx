"use client";

import Link from "next/link";
import { Phone, MapPin, BadgeCheck, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui";
import { StatusBadge } from "@/components/crm-panel";
import { type Status } from "@/lib/crm-constants";
import type { Bucket, BucketItem } from "@/lib/queries";
import { fmt } from "@/lib/format";

/** Plain-language framing for each work-readiness bucket (the rep, seeing it cold). */
const BUCKET_META: Record<Bucket["key"], { title: string; blurb: string }> = {
  ready: { title: "Ready to call", blurb: "Has a phone number and a named decision-maker, call this person now." },
  callable: { title: "Has a number", blurb: "Has a phone number but no named contact yet, call the main line and ask for the GM." },
  research: { title: "Needs research", blurb: "No phone number yet, enrich the rooftop before working it." },
};

// Quality at a glance, the rep should know if they can trust the row before they act.
// Platinum (manufacturer-confirmed) is the norm now; everything below it is called out
// LOUDLY as "not manufacturer-confirmed" so the rare unconfirmed rows never hide in the list.
const TIER_PILL: Record<string, { label: string; cls: string }> = {
  platinum: { label: "✓ Manufacturer-verified", cls: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
  gold: { label: "⚠ Not mfr-confirmed", cls: "bg-amber-100 text-amber-800 ring-1 ring-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800" },
  silver: { label: "⚠ Single source, verify", cls: "bg-amber-100 text-amber-800 ring-1 ring-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800" },
  flagged: { label: "⚠ Flagged", cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
};

/** One rooftop as a single, scannable unit. One hook, one action. */
function DealerCard({ d }: { d: BucketItem }) {
  const trustVariant =
    d.trustTier === "platinum" || d.trustTier === "gold" ? "success" : d.trustTier === "silver" ? "muted" : "muted";
  const tier = TIER_PILL[d.trustTier ?? "silver"] ?? TIER_PILL.silver;
  return (
    <div className="group relative flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/30">
      <div className="flex items-start justify-between gap-2">
        {/* Stretched link: the whole card navigates to detail, but siblings with z-10 stay clickable. */}
        <Link href={`/accounts/${d.id}`} className="font-medium leading-tight text-foreground after:absolute after:inset-0 group-hover:text-primary">
          {d.name}
        </Link>
        {d.brands.length > 1 ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            {d.brands.slice(0, 3).map((b) => (
              <Badge key={b} variant="muted">{b}</Badge>
            ))}
            {d.brands.length > 3 ? <Badge variant="muted">+{d.brands.length - 3}</Badge> : null}
          </div>
        ) : d.oem ? (
          <Badge variant="muted">{d.oem}</Badge>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${tier.cls}`}>{tier.label}</span>
        {d.rooftopCount > 1 ? (
          <span className="text-xs font-medium text-muted-foreground" title={`This location holds ${d.rooftopCount} franchises: ${d.brands.join(", ")}. One phone call reaches all of them.`}>
            {d.rooftopCount} franchises · one call
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3" />
        {[d.city, d.state_province].filter(Boolean).join(", ") || "Location unknown"}
      </div>

      {d.primaryName ? (
        <div className="text-sm">
          <span className="font-medium">{d.primaryName}</span>
          {d.primaryTitle ? <span className="text-muted-foreground"> · {d.primaryTitle}</span> : null}
        </div>
      ) : null}

      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={(d.status as Status) ?? "new"} />
        <Badge variant={trustVariant as "success" | "muted"} title={`${d.sources} independent source${d.sources === 1 ? "" : "s"} confirmed this rooftop`}>
          <BadgeCheck className="h-3 w-3" /> {d.sources} source{d.sources === 1 ? "" : "s"}
        </Badge>
        {d.hsInCrm ? (
          <Badge variant="success" title={d.hsOwner ? `Owned by ${d.hsOwner} in Pam's HubSpot` : "Already in Pam's HubSpot"}>
            In CRM{d.hsOwner ? ` · ${d.hsOwner}` : ""}
          </Badge>
        ) : (
          <Badge variant="outline" title="Not in Pam's HubSpot, net-new whitespace">Net-new</Badge>
        )}
      </div>

      {d.phone ? (
        <a
          href={`tel:${d.phone}`}
          className="relative z-10 mt-1 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <Phone className="h-3.5 w-3.5" /> {d.phone}
        </a>
      ) : null}
    </div>
  );
}

/** A labeled, chunked section, a finite, digestible set with a "see all" escape hatch. */
export function BucketSection({ bucket, seeAllHref }: { bucket: Bucket; seeAllHref: string }) {
  const meta = BUCKET_META[bucket.key];
  if (bucket.total === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            {meta.title}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{fmt(bucket.total)}</span>
          </h2>
          <p className="text-sm text-muted-foreground">{meta.blurb}</p>
        </div>
        {bucket.total > bucket.items.length ? (
          <Link href={seeAllHref} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            See all {fmt(bucket.total)} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {bucket.items.map((d) => (
          <DealerCard key={d.id} d={d} />
        ))}
      </div>
    </section>
  );
}
