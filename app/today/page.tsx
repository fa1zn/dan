import Link from "next/link";
import { Flame, Phone, ArrowRight, Workflow, MessageSquare, Gift, Activity, Coffee } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import { listHotLeads, recentActivity, motionCounts, type FeedItem } from "@/lib/sequence-ui";

export const dynamic = "force-dynamic";

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
    <Link href={`/accounts/${item.dealershipId}`} className="flex items-start gap-3 px-2 py-2.5 hover:bg-accent/40">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 text-sm">
        <span className="font-medium">{item.name}</span> <span className="text-muted-foreground">{item.body}</span>
      </div>
    </Link>
  );
}

export default function TodayPage() {
  const counts = motionCounts();
  const hot = listHotLeads();
  const feed = recentActivity(10);

  const summary =
    counts.hot > 0
      ? `${counts.hot} worth your time right now.${counts.active ? ` Pam’s working ${counts.active} more in the background.` : ""}`
      : counts.active > 0
        ? `Nothing needs you this second. Pam’s working ${counts.active} dealers — the moment one bites, it shows up here.`
        : "Nothing going yet. Head to Prospect and point Pam at a market.";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
        <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
      </div>

      {hot.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Flame className="h-4 w-4 text-brand" /> Worth your time
          </h2>
          <div className="space-y-3">
            {hot.map((l) => (
              <Card key={l.dealershipId}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/accounts/${l.dealershipId}`} className="text-base font-medium hover:underline">
                        {l.name}
                      </Link>
                      <div className="text-sm text-muted-foreground">{[l.oem, l.city].filter(Boolean).join(" · ")}</div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                      <Flame className="h-3 w-3" /> Hot
                    </span>
                  </div>
                  {l.lastOutcome && <p className="mt-2 text-sm">{l.lastOutcome}</p>}
                  {l.phone && (
                    <a
                      href={`tel:${l.phone.replace(/[^\d+]/g, "")}`}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90 sm:w-auto"
                    >
                      <Phone className="h-4 w-4" /> Call now
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {hot.length === 0 && (
        <div className="rounded-xl border bg-card px-6 py-12 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Coffee className="h-5 w-5" />
          </div>
          <p className="text-base font-medium">You&rsquo;re all caught up</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {counts.active > 0
              ? `Pam’s out there working ${counts.active} dealers. The moment one bites, they’ll show up right here.`
              : "Head to Prospect, point Pam at a market, and she’ll start the calls."}
          </p>
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">What Pam&rsquo;s been doing</h2>
        <Card>
          <CardContent className="divide-y p-2">
            {feed.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Nothing yet.</div>
            ) : (
              feed.map((item, i) => <FeedRow key={i} item={item} />)
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
