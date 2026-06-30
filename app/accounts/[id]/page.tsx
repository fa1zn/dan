import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, MapPin, Phone, Globe, Mail, Layers, Sparkles, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui";
import { CrmPanel, StatusBadge } from "@/components/crm-panel";
import { SequenceCard, TemperaturePill } from "@/components/sequence-card";
import { getMotionForDealership } from "@/lib/sequence-ui";
import { InfoTip } from "@/components/info-tip";
import { getAccount } from "@/lib/queries";
import { getCrm, getActivity } from "@/lib/crm";
import { computeIntel } from "@/lib/intel";
import { computePamFit } from "@/lib/pamfit";
import { SourceTag, contactSource, osmLink, sourceLabel } from "@/components/source-tag";
import { EXPLAIN } from "@/lib/explain";

interface Contact {
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  source?: string;
}

export const dynamic = "force-dynamic";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

/** A value Dan computed/inferred (not fetched from a source) — labelled so. */
function Inferred({ children }: { children: React.ReactNode }) {
  return (
    <span>
      {children} <span className="text-xs text-muted-foreground">· inferred by Dan</span>
    </span>
  );
}

function Flag({ label, state }: { label: string; state: boolean | null }) {
  const v = state == null ? "muted" : state ? "success" : "danger";
  const text = state == null ? "Unknown" : state ? "Valid" : "Invalid";
  return (
    <div className="flex items-center justify-between border-b py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Badge variant={v as "muted" | "success" | "danger"}>{text}</Badge>
    </div>
  );
}

export default async function AccountDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accountId = Number(id);
  const a = getAccount(accountId);
  if (!a) notFound();
  const crm = getCrm(accountId);
  const activity = getActivity(accountId);
  const motion = getMotionForDealership(accountId);
  let contacts: Contact[] = [];
  try {
    contacts = JSON.parse((a as unknown as { contacts?: string }).contacts ?? "[]");
  } catch {
    contacts = [];
  }
  let tools: string[] = [];
  try {
    tools = JSON.parse(a.tools_used ?? "[]");
  } catch {
    tools = [];
  }
  // Group "Category: Tool" strings by category for display.
  const toolsByCat = tools.reduce<Record<string, string[]>>((acc, t) => {
    const [cat, tool] = t.includes(": ") ? t.split(": ") : ["Other", t];
    (acc[cat] ??= []).push(tool);
    return acc;
  }, {});
  let signals: { rating?: number; reviewCount?: number; hours?: string; socials?: Record<string, string>; emailPattern?: string } = {};
  try {
    signals = JSON.parse(a.enrichment ?? "{}");
  } catch {
    signals = {};
  }
  const techSignals: Array<{ vendor: string; category: string; evidence: string }> =
    (signals as { techSignals?: Array<{ vendor: string; category: string; evidence: string }> }).techSignals ?? [];
  const pamAngles: string[] = (signals as { pamAngles?: string[] }).pamAngles ?? [];
  const hasSignals = !!(signals.rating || signals.hours || signals.emailPattern || (signals.socials && Object.keys(signals.socials).length));

  const intel = computeIntel({
    contacts,
    tools,
    signals,
    phone: a.phone,
    phoneValid: a.phone_valid === 1,
    website: a.website,
    websiteValid: a.website_valid == null ? null : a.website_valid === 1,
    brandConfirmed: a.brand_confirmed === 1,
  });
  const confVariant = intel.confidence.label === "High" ? "success" : intel.confidence.label === "Medium" ? "default" : "muted";
  const fit = computePamFit({
    contacts,
    tools,
    signals,
    phone: a.phone,
    phoneValid: a.phone_valid === 1,
    website: a.website,
    websiteValid: a.website_valid == null ? null : a.website_valid === 1,
    brandConfirmed: a.brand_confirmed === 1,
    tier: a.tier,
  });
  const fitVariant = fit.band === "Hot" ? "brand" : fit.band === "Warm" ? "secondary" : "outline";
  const trustTier = (a as unknown as { trust_tier?: string }).trust_tier;
  const confCount = (a as unknown as { confirmation_count?: number }).confirmation_count ?? 0;
  const trustVariant =
    trustTier === "platinum" ? "success" : trustTier === "gold" ? "default" : trustTier === "silver" ? "muted" : "danger";

  const addr = [a.address_street, [a.city, a.state_province].filter(Boolean).join(", "), a.postal_code, a.country]
    .filter(Boolean)
    .join(" · ");
  const hasGeo = a.latitude != null && a.longitude != null;
  const lat = a.latitude ?? 0;
  const lng = a.longitude ?? 0;
  const sources = a.source.split("+");

  const whyCall =
    crm.status === "engaged" || crm.status === "won"
      ? "They responded. Your turn — give them a call."
      : motion && motion.touches > 0
        ? "Pam reached out. No reply yet — worth a personal call."
        : pamAngles[0]
          ? pamAngles[0]
          : "Fresh lead — start with a call.";

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/accounts" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to accounts
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{a.name}</h1>
            <StatusBadge status={crm.status} />
            {a.tier === "A" ? <Badge variant="brand">Tier A</Badge> : a.tier ? <Badge variant="muted">Tier {a.tier}</Badge> : null}
            <InfoTip label="Tier">{EXPLAIN.tier}</InfoTip>
            {trustTier ? (
              <Badge
                variant={trustVariant as "success" | "default" | "muted" | "danger"}
                title={`${confCount} independent source${confCount === 1 ? "" : "s"} confirmed this rooftop`}
              >
                {trustTier} · {confCount} source{confCount === 1 ? "" : "s"}
              </Badge>
            ) : null}
            {a.hs_in_crm ? <Badge variant="success">In HubSpot</Badge> : null}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {addr || "Address unknown"}
          </p>
        </div>
        <div className="flex gap-2">
          {a.website && (
            <Link href={a.website} target="_blank">
              <Button variant="outline" size="sm">
                <Globe className="h-4 w-4" /> Website <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          )}
          {a.phone && (
            <a href={`tel:${a.phone}`}>
              <Button variant="brand" size="sm">
                <Phone className="h-4 w-4" /> Call
              </Button>
            </a>
          )}
        </div>
      </div>

      {a.phone && (
        <div className="rounded-lg border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Why call</div>
              <p className="mt-1 text-base">{whyCall}</p>
            </div>
            {motion?.temperature && <TemperaturePill temp={motion.temperature} />}
          </div>
          <a
            href={`tel:${a.phone.replace(/[^\d+]/g, "")}`}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90 sm:w-auto"
          >
            <Phone className="h-4 w-4" /> Call {a.phone}
          </a>
        </div>
      )}

      <SequenceCard motion={motion} dealershipId={accountId} />

      <div className="flex items-center gap-3 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        More on this dealer
        <div className="h-px flex-1 bg-border" />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-1.5 text-base font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-brand" /> Sales intel
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={fitVariant as "brand" | "secondary" | "outline"}>
              Pam-fit {fit.band} · {fit.score}/100
            </Badge>
            <Badge variant={confVariant as "success" | "default" | "muted"}>
              {intel.confidence.label} confidence
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-brand/30 bg-brand/5 px-3 py-2 text-sm">
            <span className="font-medium text-brand">Opener:</span> {fit.talkTrack}
          </div>
          <div className="grid gap-5 md:grid-cols-2">
          <div>
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              <Target className="h-3.5 w-3.5" /> Call first
            </div>
            {intel.champion ? (
              <div className="mt-1.5">
                <div className="font-medium">{intel.champion.name}</div>
                <div className="text-sm text-muted-foreground">
                  {intel.champion.title} · {intel.champion.reason}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-3 text-sm">
                  {(intel.champion.phone ?? a.phone) && (
                    <a href={`tel:${(intel.champion.phone ?? a.phone)!.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 text-brand hover:underline">
                      <Phone className="h-3.5 w-3.5" /> {intel.champion.phone ?? a.phone}
                    </a>
                  )}
                  {intel.champion.email && (
                    <a href={`mailto:${intel.champion.email}`} className="inline-flex items-center gap-1 text-brand hover:underline">
                      <Mail className="h-3.5 w-3.5" /> {intel.champion.email}
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-1.5 text-sm text-muted-foreground">
                No named decision-maker yet — call the main line{a.phone ? ` (${a.phone})` : ""}.
              </div>
            )}
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Why call them</div>
            {intel.whyCall.length ? (
              <ul className="mt-1.5 space-y-1.5 text-sm">
                {intel.whyCall.map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    {w.label}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-1.5 text-sm text-muted-foreground">
                No standout trigger scraped yet — enrich this rooftop for tech/hours/reviews signals.
              </div>
            )}
          </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold text-foreground">Identity & contact</CardTitle>
            <SourceTag label="OpenStreetMap" href={osmLink(a.latitude, a.longitude)} />
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-8">
              <Field label="OEM brand">{a.oem ? <Badge variant="muted">{a.oem}</Badge> : null}</Field>
              <Field label="Dealer group">
                {a.group_name ? <Inferred>{a.group_name}</Inferred> : null}
              </Field>
              <Field label="Group size">{a.group_size ? <Inferred>{a.group_size}</Inferred> : null}</Field>
              <Field label="Territory">{a.territory ? <Inferred>{a.territory}</Inferred> : null}</Field>
              <Field label="Website">
                {a.website ? (
                  <a href={a.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    {a.domain ?? a.website}
                  </a>
                ) : null}
              </Field>
              <Field label="Phone">{a.phone}</Field>
              <Field label="Email">
                {a.email ? (
                  <a href={`mailto:${a.email}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <Mail className="h-3 w-3" /> {a.email}
                  </a>
                ) : null}
              </Field>
              <Field label="Coordinates">{hasGeo ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : null}</Field>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Validation</CardTitle>
          </CardHeader>
          <CardContent>
            <Flag label="Website" state={a.website ? (a.website_valid == null ? null : a.website_valid === 1) : null} />
            <Flag label="Phone" state={a.phone ? a.phone_valid === 1 : null} />
            <Flag label="Brand confirmed" state={a.brand_confirmed === 1} />
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
              <span className="text-xs text-muted-foreground">Sources:</span>
              {sources.map((s) => (
                <Badge key={s} variant="outline">
                  {sourceLabel(s)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-semibold text-foreground">Location</CardTitle>
          <SourceTag label="OpenStreetMap" href={osmLink(a.latitude, a.longitude)} />
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {hasGeo ? (
            <iframe
              title="map"
              className="h-72 w-full border-0"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.02}%2C${lat - 0.02}%2C${lng + 0.02}%2C${lat + 0.02}&layer=mapnik&marker=${lat}%2C${lng}`}
            />
          ) : (
            <div className="px-5 pb-5 text-sm text-muted-foreground">No coordinates on file for this rooftop.</div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CrmPanel
            id={accountId}
            status={crm.status}
            owner={crm.owner}
            nextStep={crm.nextStep}
            activity={activity}
          />
        </div>

        <div className="space-y-4">
        {(pamAngles.length > 0 || techSignals.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-base font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-brand" /> Why Pam fits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pamAngles.map((angle, i) => (
                <p key={i} className="text-sm">
                  {angle}
                </p>
              ))}
              {techSignals.length > 0 && (
                <div className="border-t pt-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Detected · with evidence</div>
                  <ul className="mt-1.5 space-y-1.5 text-sm">
                    {techSignals.map((d, i) => (
                      <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium">{d.vendor}</span>
                        <span className="text-xs text-muted-foreground">{d.category}</span>
                        <code className="text-xs text-muted-foreground">&ldquo;{d.evidence}&rdquo;</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        {a.hs_in_crm ? (
          <Card className="border-emerald-500/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-base font-semibold text-foreground">
                <Badge variant="success">In HubSpot</Badge>
                <InfoTip label="In HubSpot">{EXPLAIN.inHubspot}</InfoTip>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Lifecycle</span>
                <span className="font-medium capitalize">{a.hs_lifecycle_stage ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Owner</span>
                <span className="font-medium">{a.hs_owner ?? "Unassigned"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Last activity</span>
                <span className="font-medium">{a.hs_last_activity ? a.hs_last_activity.slice(0, 10) : "—"}</span>
              </div>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-base font-semibold text-foreground">
              Contacts <InfoTip label="Contacts">{EXPLAIN.primaryContact}</InfoTip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contacts.length === 0 ? (
              <div className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">
                No enriched contacts yet. Run <code className="text-foreground">npm run pipeline:enrich</code> to pull
                contacts from dealer websites.
              </div>
            ) : (
              <ul className="space-y-3">
                {contacts.map((c, i) => (
                  <li key={i} className="border-b pb-3 last:border-0">
                    <div className="text-sm font-medium">{c.name ?? c.email ?? "Contact"}</div>
                    {c.title && <div className="text-xs text-muted-foreground">{c.title}</div>}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="text-xs text-primary hover:underline">
                        {c.email}
                      </a>
                    )}
                    {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                    {c.source && (
                      <div className="mt-1">
                        <SourceTag {...contactSource(c.source, a.website)} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {tools.length > 0 && (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-1.5 text-base font-semibold text-foreground">
                <Layers className="h-4 w-4 text-brand" /> Tech stack
                <InfoTip label="Tech stack">{EXPLAIN.tools}</InfoTip>
              </CardTitle>
              <SourceTag label={`${a.domain ?? "dealer site"} · scripts`} href={a.website} />
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(toolsByCat).map(([cat, list]) => (
                <div key={cat}>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{cat}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {list.map((t) => (
                      <Badge key={t} variant="secondary">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {hasSignals && (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-semibold text-foreground">Signals</CardTitle>
              <SourceTag label={`${a.domain ?? "dealer site"} · schema.org`} href={a.website} />
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {signals.rating ? (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Rating</span>
                  <span className="font-medium">
                    ★ {signals.rating}
                    {signals.reviewCount ? <span className="text-muted-foreground"> ({signals.reviewCount} reviews)</span> : null}
                  </span>
                </div>
              ) : null}
              {signals.hours ? (
                <div className="flex justify-between gap-3">
                  <span className="shrink-0 text-muted-foreground">Hours</span>
                  <span className="text-right font-medium">{signals.hours}</span>
                </div>
              ) : null}
              {signals.emailPattern ? (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Email pattern</span>
                  <code className="font-medium">{signals.emailPattern}</code>
                </div>
              ) : null}
              {signals.socials && Object.keys(signals.socials).length ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Object.entries(signals.socials).map(([k, u]) => (
                    <a key={k} href={u} target="_blank" rel="noreferrer">
                      <Badge variant="outline" className="capitalize hover:bg-accent">
                        {k}
                      </Badge>
                    </a>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </div>
  );
}
