import Link from "next/link";
import { ShieldCheck, Database, Layers, CircleCheck, CircleAlert, Search, PhoneOff, Globe, Check, Ban } from "lucide-react";
import { getKpis } from "@/lib/queries";
import { getSqlite } from "@/lib/db";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

function counts() {
  const db = getSqlite();
  const q = (s: string) => (db.prepare(s).get() as { n: number }).n;
  const W = "state_province IN ('CA','TX','FL')";
  return {
    total: q(`SELECT COUNT(*) n FROM dealerships WHERE ${W}`),
    platinum: q(`SELECT COUNT(*) n FROM dealerships WHERE ${W} AND trust_tier='platinum'`),
    verified: q(`SELECT COUNT(*) n FROM dealerships WHERE ${W} AND trust_tier IN ('platinum','gold')`),
    usConfirmed: q(`SELECT COUNT(*) n FROM dealerships WHERE country='US' AND brand_confirmed=1`),
    usStates: q(`SELECT COUNT(DISTINCT state_province) n FROM dealerships WHERE country='US' AND brand_confirmed=1`),
  };
}

const SOURCES = [
  { name: "Manufacturer dealer locators", how: "The carmaker's own franchise list (Toyota, Honda, Ford, Hyundai, Subaru…). The definitive source — every dealer comes with its manufacturer dealer code.", tier: "★★★★★" },
  { name: "The dealer's own website", how: "A real franchise runs a brand-specific site with new inventory; a used lot doesn't. The business confirming its own existence.", tier: "★★★★" },
  { name: "Google Places", how: "Mapping + real customer reviews (humans physically went there) + current operating status.", tier: "★★★★" },
  { name: "OpenStreetMap", how: "Independent community-mapped locations.", tier: "★★★" },
  { name: "ZoomInfo", how: "Field-researched decision-makers, direct dials, and verified emails — with accuracy scores and validation dates.", tier: "★★★" },
  { name: "HubSpot (Pam's CRM)", how: "Pam's own relationship history — who's already a customer or in pipeline, and who owns them.", tier: "—" },
];

const TIERS = [
  { label: "Platinum", cls: "text-violet-600 dark:text-violet-400", desc: "Manufacturer-confirmed with a dealer code. The carmaker says this is their franchise. The gold standard." },
  { label: "Gold", cls: "text-emerald-600 dark:text-emerald-400", desc: "Two or more independent sources agree — typically the dealer's own site + the map + community data. Verified." },
  { label: "Silver", cls: "text-muted-foreground", desc: "Only one source so far. Probably real, but verify before you act — we tell you instead of pretending it's certain." },
  { label: "Flagged", cls: "text-red-600 dark:text-red-400", desc: "Noise we caught and removed from your working views: used lots, non-dealership entities, mislabeled out-of-state rows." },
];

export default async function MethodologyPage() {
  const c = counts();
  getKpis();
  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-brand" /> How your data is sourced &amp; verified
        </h1>
        <p className="mt-1 text-muted-foreground">
          You&rsquo;re betting your day on this list. Here&rsquo;s exactly where every record comes from, how we know it&rsquo;s real,
          and how we&rsquo;re honest with you when we&rsquo;re not 100% sure. No black box.
        </p>
      </div>

      <section className="grid grid-cols-3 gap-3">
        {[["Rooftops", fmt(c.total)], ["Multi-source verified", fmt(c.verified)], ["Manufacturer-confirmed", fmt(c.platinum)]].map(([k, v]) => (
          <div key={k} className="rounded-xl border bg-card p-4">
            <div className="text-2xl font-semibold">{v}</div>
            <div className="text-xs text-muted-foreground">{k}</div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Globe className="h-4 w-4 text-brand" /> What&rsquo;s in this book &mdash; and what isn&rsquo;t</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This is a <strong>new-car franchise</strong> system of record, built from each manufacturer&rsquo;s own dealer list &mdash;
          not a scrape of everything that sells a car. Currently <strong>{fmt(c.usConfirmed)}</strong> US rooftops are
          manufacturer-confirmed across <strong>{c.usStates}</strong> states, and growing as the national rollout completes.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-card px-4 py-3">
            <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400"><Check className="h-4 w-4" /> In scope</div>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>Franchised new-car rooftops from ~27 manufacturers&rsquo; official dealer locators</li>
              <li>All 50 US states (CA, TX &amp; FL complete; the rest confirming now)</li>
              <li>Every record cross-checked against Google, OpenStreetMap &amp; the dealer&rsquo;s own site</li>
            </ul>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground"><Ban className="h-4 w-4" /> Deliberately excluded</div>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>Used-car lots, independent (non-franchise) dealers &amp; powersports &mdash; flagged as noise, hidden</li>
              <li>Tesla &amp; Rivian &mdash; direct-sale, no franchises</li>
              <li>Mexican border dealers &mdash; quarantined so they never pose as US rooftops</li>
              <li>Canada is mapped but not yet manufacturer-confirmed &mdash; a planned next pass</li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Database className="h-4 w-4 text-brand" /> Where it comes from</h2>
        <p className="mt-1 text-sm text-muted-foreground">Six independent sources — each knows a dealer exists a <em>different</em> way. That independence is the whole point.</p>
        <ul className="mt-3 space-y-2">
          {SOURCES.map((s) => (
            <li key={s.name} className="flex items-start justify-between gap-3 rounded-lg border bg-card px-4 py-3">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-muted-foreground">{s.how}</div>
              </div>
              <span className="shrink-0 text-xs text-amber-500">{s.tier}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Layers className="h-4 w-4 text-brand" /> What the trust labels mean</h2>
        <p className="mt-1 text-sm text-muted-foreground">Every account shows its confidence tier. We never dress up a guess as a fact.</p>
        <ul className="mt-3 space-y-2">
          {TIERS.map((t) => (
            <li key={t.label} className="rounded-lg border bg-card px-4 py-3">
              <span className={`font-semibold ${t.cls}`}>{t.label}</span>
              <span className="text-sm text-muted-foreground"> — {t.desc}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Search className="h-4 w-4 text-brand" /> How we remove the junk</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Raw web data is ~30% noise — used-car lots, motorcycle shops, corporate offices, Mexico-border dealers mislabeled as in-state.
            We filter by manufacturer franchise lists, dealer-site brand match, and name patterns, then <strong>quarantine</strong> what doesn&rsquo;t hold up.
            Flagged noise is hidden from your working views by default — you only ever see what we&rsquo;d stake our name on.
          </p>
        </div>
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><CircleCheck className="h-4 w-4 text-emerald-500" /> How we know it&rsquo;s real (measured, not claimed)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We ran a <strong>ground-truth audit</strong>: a random sample of rooftops, each independently re-checked against Google&rsquo;s live data.
            Result: <strong>93% confirmed real operating dealers — 100% on cross-confirmed records.</strong> The misses were exactly where the labels warn you (single-source).
            Every field is also click-through verifiable on each account — &ldquo;verify ↗&rdquo; takes you to the source.
          </p>
        </div>
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><PhoneOff className="h-4 w-4 text-red-500" /> We protect you when you call</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Numbers on the federal Do-Not-Call registry are flagged and <strong>cannot be one-tap dialed</strong> — calling one is a real legal risk, so we make you confirm first.
          </p>
        </div>
      </section>

      <section className="rounded-xl border-l-2 border-brand bg-brand/5 px-4 py-3">
        <div className="flex items-center gap-1.5 text-sm font-medium"><CircleAlert className="h-4 w-4 text-brand" /> Our one rule</div>
        <p className="mt-1 text-sm text-muted-foreground">
          When we&rsquo;re sure, we show it. When we&rsquo;re not, we say so. A number you can&rsquo;t trust that <em>looks</em> certain is worse than one we honestly flag.
          That&rsquo;s the deal — so you can pick up the phone without second-guessing the list.
        </p>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Questions about a specific record? Open it — the <Link href="/accounts" className="underline">Data confidence</Link> panel shows every source behind it.
      </p>
    </div>
  );
}
