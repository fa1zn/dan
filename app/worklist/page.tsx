import Link from "next/link";
import { MapPin, User, ArrowRight, Star, Phone } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { StateTabs } from "@/components/state-tabs";
import { StatusBadge } from "@/components/crm-panel";
import { DncCall } from "@/components/dnc-call";
import { LogCall } from "@/components/log-call";
import { getCallList, getCallListStates } from "@/lib/queries";
import { type Status } from "@/lib/crm-constants";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// A rep works the top of the list, not 2,000 rows. Show the day's best calls, hold the rest.
const TODAY_CAP = 20;

export default async function TodayPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const states = getCallListStates();
  const fallback = ["TX", "CA", "FL"].find((c) => (states.find((s) => s.code === c)?.named ?? 0) > 0)
    ?? states[0]?.code ?? "CA";
  const state = (one(sp.state) ?? fallback).toUpperCase();

  const all = getCallList(state);
  // Today = fresh, callable accounts not yet worked. Logging a call advances the status,
  // so it drops off the list, the rep clears their day instead of re-seeing worked rooftops.
  const callable = all.filter((i) => (i.primary?.phone || i.primary?.mobile || i.phone) && i.status === "new");
  const today = callable.slice(0, TODAY_CAP);
  const hot = today.filter((i) => i.pamfit.band === "Hot").length;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-12">
      <div>
        <h1 className="font-serif text-3xl font-medium tracking-tight">Today</h1>
        <p className="text-sm text-muted-foreground">
          Your best calls in {state}, ranked by fit for Pam. Each one has who to ask for, why now, and an opener you can read.
          Work top-down.
        </p>
      </div>

      <StateTabs current={state} states={states} />

      <p className="text-sm text-muted-foreground">
        Showing your top <span className="font-medium text-foreground">{today.length}</span>
        {" "}of {fmt(callable.length)} callable in {state}
        {hot ? <> · <span className="font-medium text-brand">{hot} Hot</span></> : null}.{" "}
        <Link href={`/accounts?state=${state}`} className="text-primary hover:underline">See the full book →</Link>
      </p>

      <ol className="border-t border-border divide-y divide-border">
        {today.length === 0 && <Card className="p-8 text-center text-muted-foreground">No callable rooftops in {state} yet.</Card>}

        {today.map((it, idx) => {
          const addr = [it.city, it.state_province].filter(Boolean).join(", ");
          // DNC-safe: prefer the champion's direct line, carry its DNC flag; fall back to the main line.
          const call = it.primary?.phone
            ? { number: it.primary.phone, dnc: !!it.primary.phoneDnc, kind: "direct" as const }
            : it.primary?.mobile
              ? { number: it.primary.mobile, dnc: !!it.primary.mobileDnc, kind: "mobile" as const }
              : it.phone
                ? { number: it.phone, dnc: false, kind: "main" as const }
                : null;
          return (
            <li key={it.id} className="py-6">
              <div className="flex items-start gap-4">
                <div className="mt-0.5 w-6 shrink-0 font-serif text-lg tabular-nums text-brand">
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  {/* headline */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={it.pamfit.band === "Hot" ? "brand" : it.pamfit.band === "Warm" ? "secondary" : "outline"}>
                      {it.pamfit.band} · {it.pamfit.score}
                    </Badge>
                    <Link href={`/accounts/${it.id}`} className="font-semibold hover:text-primary">{it.name}</Link>
                    {it.oem && <Badge variant="muted">{it.oem}</Badge>}
                    {it.rating != null && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground" title={`${it.reviewCount ?? 0} Google reviews`}>
                        <Star className="h-3 w-3 fill-muted-foreground/40 text-muted-foreground" /> {it.rating}
                        {it.reviewCount ? <span className="text-muted-foreground/70"> ({fmt(it.reviewCount)})</span> : null}
                      </span>
                    )}
                    <StatusBadge status={it.status as Status} />
                    {it.hs_in_crm ? <Badge variant="success">In HubSpot</Badge> : null}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" /> {addr || "Location unknown"}
                  </div>

                  {/* ask for */}
                  <div className="mt-2 flex items-center gap-1.5 text-sm">
                    <User className="h-3.5 w-3.5 shrink-0 text-brand" />
                    <span className="text-muted-foreground">Ask for</span>
                    <span className="font-medium">{it.primary?.name ?? it.pamfit.askFor}</span>
                    {it.primary?.title && <span className="text-muted-foreground">· {it.primary.title}</span>}
                    {call?.kind === "direct" && <Badge variant="outline" className="ml-0.5">direct line</Badge>}
                  </div>

                  {/* why now */}
                  {it.whyNow.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {it.whyNow.map((w, i) => (
                        <span key={i} className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs " +
                          (w.tone === "hot" ? "bg-brand/10 text-brand" : "bg-muted text-muted-foreground")}>
                          {w.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* the opener, the star of the card */}
                  <div className="mt-3 border-l-2 border-brand pl-3.5">
                    <p className="font-serif text-[15px] italic leading-snug text-foreground/90">{it.pamfit.opener}</p>
                  </div>

                  {/* action */}
                  <div className="mt-3 flex items-center gap-3">
                    {call ? (
                      <DncCall number={call.number} dnc={call.dnc} />
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Phone className="h-4 w-4" /> No number</span>
                    )}
                    <Link href={`/accounts/${it.id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      Full brief <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                  {/* work it, log the call outcome, advances the account */}
                  <div className="mt-2 border-t pt-2">
                    <LogCall id={it.id} dealer={it.name} />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
