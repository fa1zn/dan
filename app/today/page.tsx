import Link from "next/link";
import { Flame, Phone, ArrowRight, Workflow, MessageSquare, Gift, ArrowUpRight, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import { listHotLeads, recentActivity, motionCounts, type FeedItem } from "@/lib/sequence-ui";
import { autopilotActive } from "@/lib/meta";

export const dynamic = "force-dynamic";

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-2xl font-medium">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  call: Phone,
  sms: MessageSquare,
  gift: Gift,
  sequence: Workflow,
  status_change: ArrowRight,
};

function FeedRow({ item }: { item: FeedItem }) {
  const Icon = KIND_ICON[item.kind] ?? Activity;
  return (
    <Link href={`/accounts/${item.dealershipId}`} className="flex items-start gap-3 px-1 py-2.5 hover:bg-accent/40">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-sm">
          <span className="font-medium">{item.name}</span>{" "}
          <span className="text-muted-foreground">{item.body}</span>
        </div>
      </div>
    </Link>
  );
}

export default function TodayPage() {
  const counts = motionCounts();
  const hot = listHotLeads();
  const feed = recentActivity(14);
  const autopilot = autopilotActive();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What needs you. Pam works the rest in the background and surfaces the conversations worth your time.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Hot leads" value={counts.hot} hint="responded — need you" />
        <Metric label="In outreach" value={counts.active} hint="Pam working" />
        <Metric label="Due soon" value={counts.dueSoon} hint="next 24h" />
        <Metric label="Autopilot" value={autopilot ? "On" : "Off"} hint={autopilot ? "running" : "start with watch"} />
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-medium">
          <Flame className="h-4 w-4 text-brand" /> Needs you now
        </h2>
        {hot.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nothing hot yet. When a prospect responds on a call or text, they land here with the gist of what was said.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {hot.map((l) => (
                <div key={l.dealershipId} className="flex items-start gap-3 px-4 py-3.5">
                  <Flame className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/accounts/${l.dealershipId}`} className="text-sm font-medium hover:underline">
                      {l.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {[l.oem, l.city].filter(Boolean).join(" · ")}
                    </div>
                    {l.lastOutcome && <p className="mt-1 text-sm text-muted-foreground">{l.lastOutcome}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {l.phone && (
                      <a
                        href={`tel:${l.phone.replace(/[^\d+]/g, "")}`}
                        className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
                      >
                        <Phone className="h-3.5 w-3.5" /> Call
                      </a>
                    )}
                    <Link href={`/accounts/${l.dealershipId}`} className="text-muted-foreground hover:text-foreground">
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Recent activity</h2>
        <Card>
          <CardContent className="divide-y p-2">
            {feed.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">No activity yet.</div>
            ) : (
              feed.map((item, i) => <FeedRow key={i} item={item} />)
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
