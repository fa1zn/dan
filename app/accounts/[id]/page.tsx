import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, MapPin, Phone, Globe, Mail, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui";
import { CrmPanel, StatusBadge } from "@/components/crm-panel";
import { InfoTip } from "@/components/info-tip";
import { getAccount } from "@/lib/queries";
import { getCrm, getActivity } from "@/lib/crm";
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

  const addr = [a.address_street, [a.city, a.state_province].filter(Boolean).join(", "), a.postal_code, a.country]
    .filter(Boolean)
    .join(" · ");
  const hasGeo = a.latitude != null && a.longitude != null;
  const lat = a.latitude ?? 0;
  const lng = a.longitude ?? 0;
  const sources = a.source.split("+");

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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Identity & contact</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-8">
              <Field label="OEM brand">{a.oem ? <Badge variant="muted">{a.oem}</Badge> : null}</Field>
              <Field label="Dealer group">{a.group_name}</Field>
              <Field label="Group size">{a.group_size}</Field>
              <Field label="Territory">{a.territory}</Field>
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
                  {s}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">Location</CardTitle>
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
                      <Badge variant="outline" className="mt-1">
                        {c.source}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {tools.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-base font-semibold text-foreground">
                <Layers className="h-4 w-4 text-brand" /> Tech stack
                <InfoTip label="Tech stack">{EXPLAIN.tools}</InfoTip>
              </CardTitle>
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
        </div>
      </div>
    </div>
  );
}
