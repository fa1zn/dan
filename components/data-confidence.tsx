import { ShieldCheck, CircleCheck, CircleAlert, ExternalLink, BadgeCheck } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui";
import { sourceLabel, sourceVerifyHref, osmLink } from "@/components/source-tag";

/**
 * Per-account DATA CONFIDENCE rubric, the trust layer made visible. Shows exactly
 * how many INDEPENDENT sources triangulate this rooftop, which ones (with verify
 * links), whether the manufacturer confirms it, field-by-field provenance, and when
 * it was last checked. The whole point: a rep can see *why* to trust a row before
 * driving to it or dialing it. Ground truth = independent agreement, shown plainly.
 */

interface Person {
  name?: string;
  title?: string;
  source?: string;
  phone?: string;
  mobile?: string;
  accuracy?: number;
  mobileDnc?: boolean;
}

const TIER = {
  platinum: { label: "Platinum", blurb: "Manufacturer-confirmed or 3+ independent sources, certified.", cls: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
  gold: { label: "Gold", blurb: "Two independent sources agree, verified.", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  silver: { label: "Silver", blurb: "Single source, probable, verify before acting.", cls: "bg-muted text-muted-foreground" },
  flagged: { label: "Flagged", blurb: "Sources conflict or the name looks non-franchise, review.", cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
} as const;

// How each independent source *learned* the dealer exists, independence is the point.
const HOW: Record<string, string> = {
  osm: "community-mapped",
  google_places: "mapping + real customer reviews",
  website: "the dealer's own site",
  zoominfo: "data vendor, field-researched",
};
const howKnows = (code: string) => (code.startsWith("oem:") ? "the manufacturer + dealer code" : HOW[code] ?? "independent record");

export function DataConfidence({
  source, confirmationCount, trustTier, brandConfirmed, placeId, website, websiteValid,
  phone, phoneValid, contacts, lat, lng, updatedAt,
}: {
  source: string; confirmationCount: number; trustTier: string | null; brandConfirmed: boolean;
  placeId: string | null; website: string | null; websiteValid: number | null;
  phone: string | null; phoneValid: number | null; contacts: string | null;
  lat: number | null; lng: number | null; updatedAt: string | null;
}) {
  const tier = TIER[(trustTier as keyof typeof TIER) ?? "silver"] ?? TIER.silver;
  const codes = source.split("+").filter(Boolean);

  let people: Person[] = [];
  try { people = JSON.parse(contacts ?? "[]"); } catch {}
  const zi = people.filter((p) => p.source === "zoominfo");
  const staff = people.filter((p) => p.source === "staff-page");
  const ziBest = zi.sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0))[0];

  // The independent confirmations, in authority order.
  const sources = codes.map((c) => ({ code: c, label: sourceLabel(c), how: howKnows(c), href: sourceVerifyHref(c, { lat, lng, placeId, website }) }));

  const lastChecked = updatedAt ? new Date(updatedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

  // What it would take to raise the grade, honest about the gap.
  const toRaise =
    trustTier === "platinum" ? null
    : brandConfirmed ? null
    : confirmationCount >= 2 ? "Add a manufacturer dealer code (OEM locator) to reach Platinum."
    : "Needs a second independent source (OEM locator / dealer website) to reach Gold.";

  const Row = ({ label, value, ok }: { label: string; value: string; ok: boolean | null }) => (
    <div className="flex items-start justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1 text-right">
        {ok === true ? <CircleCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : ok === false ? <CircleAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" /> : null}
        <span>{value}</span>
      </span>
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-1.5 text-base font-semibold">
          <ShieldCheck className="h-4 w-4 text-brand" /> Data confidence
        </CardTitle>
        <Badge className={`${tier.cls} border-transparent`}>{tier.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{tier.blurb}</p>

        {/* Independent sources */}
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Confirmed by {confirmationCount} independent source{confirmationCount === 1 ? "" : "s"}
          </div>
          <ul className="mt-2 space-y-1.5">
            {sources.map((s) => (
              <li key={s.code} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-1.5">
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span className="font-medium">{s.label}</span>
                  <span className="text-xs text-muted-foreground">· {s.how}</span>
                </span>
                {s.href ? (
                  <a href={s.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-xs text-brand hover:underline">
                    verify <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        {/* Field-level provenance + validation */}
        <div className="rounded-lg border bg-muted/30 px-3 py-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Field provenance</div>
          <div className="mt-1 divide-y divide-border/60">
            <Row label="Manufacturer-confirmed" value={brandConfirmed ? "Yes, dealer code on file" : "Not yet"} ok={brandConfirmed} />
            <Row label="Phone" value={phone ? (phoneValid === 1 ? "format-valid" : "present, unverified") : "missing"} ok={phone ? phoneValid === 1 : null} />
            <Row label="Website" value={website ? (websiteValid === 1 ? "reachable" : websiteValid === 0 ? "unreachable" : "not checked") : "missing"} ok={website ? (websiteValid == null ? null : websiteValid === 1) : null} />
            <Row
              label="People"
              value={
                ziBest ? `ZoomInfo${staff.length ? " + dealer staff page" : ""} · acc ${ziBest.accuracy ?? "?"}`
                : staff.length ? "Dealer staff page (self-reported)"
                : "none yet"
              }
              ok={ziBest ? true : staff.length ? null : false}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Last checked: {lastChecked}</span>
          {toRaise ? <span className="text-right">{toRaise}</span> : <span className="text-emerald-600 dark:text-emerald-400">Top grade ✓</span>}
        </div>
      </CardContent>
    </Card>
  );
}
