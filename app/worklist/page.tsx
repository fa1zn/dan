import Link from "next/link";
import { MapPin, Phone, User, ArrowRight, Star, Zap } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { StateTabs } from "@/components/state-tabs";
import { StatusBadge } from "@/components/crm-panel";
import { getCallList, getCallListStates } from "@/lib/queries";
import { type Status } from "@/lib/crm-constants";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function WorklistPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const states = getCallListStates();
  const fallback = ["TX", "CA", "FL"].find((c) => (states.find((s) => s.code === c)?.named ?? 0) > 0)
    ?? states[0]?.code
    ?? "CA";
  const state = (one(sp.state) ?? fallback).toUpperCase();

  const items = getCallList(state);
  const named = items.filter((i) => i.primary).length;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Call list</h1>
        <p className="text-sm text-muted-foreground">
          Work your territory — who to call and where to go. Accounts with a named decision-maker come first.
        </p>
      </div>

      <StateTabs current={state} states={states} />

      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{state}</span> · {fmt(items.length)} rooftops ·{" "}
        <span className="font-medium text-brand">{fmt(named)}</span> with a named contact
      </p>

      <div className="space-y-3">
        {items.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">No rooftops in {state}.</Card>
        )}

        {items.map((it) => {
          const addr = [it.address_street, [it.city, it.state_province].filter(Boolean).join(", "), it.postal_code]
            .filter(Boolean)
            .join(" · ");
          const callNumber = it.primary?.phone ?? it.phone;
          return (
            <Card key={it.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={it.pamfit.band === "Hot" ? "brand" : it.pamfit.band === "Warm" ? "secondary" : "outline"}
                    >
                      {it.pamfit.band} · {it.pamfit.score}
                    </Badge>
                    <Link href={`/accounts/${it.id}`} className="font-semibold hover:text-primary">
                      {it.name}
                    </Link>
                    {it.oem && <Badge variant="muted">{it.oem}</Badge>}
                    {it.tier === "A" && <Badge variant="brand">Tier A</Badge>}
                    {it.rating != null && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground" title={`${it.reviewCount ?? 0} Google reviews`}>
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {it.rating}
                        {it.reviewCount ? <span className="text-muted-foreground/70"> ({it.reviewCount})</span> : null}
                      </span>
                    )}
                    <StatusBadge status={it.status as Status} />
                    {it.hs_in_crm ? <Badge variant="success">In HubSpot</Badge> : null}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" /> {addr || "Address unknown"}
                  </div>

                  {it.primary ? (
                    <div className="mt-2 flex items-center gap-1.5 text-sm">
                      <User className="h-3.5 w-3.5 shrink-0 text-brand" />
                      <span className="font-medium">{it.primary.name}</span>
                      {it.primary.title && <span className="text-muted-foreground">· {it.primary.title}</span>}
                      {it.people.length > 1 && (
                        <span className="text-xs text-muted-foreground">+{it.people.length - 1} more</span>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-muted-foreground">No named contact yet — call the main line.</div>
                  )}

                  {it.whyNow.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {it.whyNow.map((w, i) => (
                        <span
                          key={i}
                          className={
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium " +
                            (w.tone === "hot"
                              ? "bg-brand/10 text-brand"
                              : w.tone === "warn"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                                : "bg-muted text-muted-foreground")
                          }
                        >
                          <Zap className="h-3 w-3" /> {w.label}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Opener:</span> {it.pamfit.talkTrack}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  {callNumber ? (
                    <a
                      href={`tel:${callNumber.replace(/[^\d+]/g, "")}`}
                      className="inline-flex items-center gap-2 rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90"
                    >
                      <Phone className="h-4 w-4" /> {callNumber}
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground">No number</span>
                  )}
                  <Link
                    href={`/accounts/${it.id}`}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Open account <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
