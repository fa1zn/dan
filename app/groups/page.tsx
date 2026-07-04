import Link from "next/link";
import { Building2, BadgeCheck, MapPin } from "lucide-react";
import { Badge } from "@/components/ui";
import { StateTabs } from "@/components/state-tabs";
import { getDealerGroups, getCallListStates } from "@/lib/queries";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const MVP = ["CA", "TX", "FL"];

export default async function GroupsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const stateParam = one(sp.state)?.toUpperCase();
  const states = stateParam ? [stateParam] : MVP;
  const { groups, groupedRooftops } = getDealerGroups(states);
  const stateOpts = getCallListStates().filter((s) => MVP.includes(s.code));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="font-serif text-3xl font-medium tracking-tight">Dealer groups</h1>
        <p className="text-sm text-muted-foreground">
          One decision, many rooftops, sell to the group, not the store. {fmt(groupedRooftops)} rooftops roll up into {groups.length} known groups.
        </p>
      </div>

      <StateTabs current={stateParam ?? "CA"} states={stateOpts.map((s) => ({ code: s.code, total: s.total, named: s.named }))} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.name} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-brand" />
                <span className="font-semibold">{g.name}</span>
              </div>
              {g.inHubspot > 0 ? <Badge variant="success">In Pam&apos;s CRM</Badge> : <Badge variant="outline">Net-new</Badge>}
            </div>

            {/* Deal size, the number that matters when you sell to a group. */}
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-2xl font-semibold">{g.rooftops}</span>
              <span className="text-sm text-muted-foreground">rooftops</span>
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <BadgeCheck className="h-3 w-3" /> {g.verified} verified
              </span>
            </div>

            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {g.states.join(" · ")} · {g.brands.length} brand{g.brands.length === 1 ? "" : "s"}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {g.brands.slice(0, 8).map((b) => (
                <Badge key={b} variant="muted">{b}</Badge>
              ))}
              {g.brands.length > 8 ? <span className="text-xs text-muted-foreground">+{g.brands.length - 8}</span> : null}
            </div>

            <div className="mt-3 flex items-center justify-between border-t pt-2 text-xs">
              <span className="text-muted-foreground">{g.withContacts} with decision-makers</span>
              <Link href={`/accounts?view=table&q=${encodeURIComponent(g.name.split(" ")[0])}`} className="font-medium text-brand hover:underline">
                View {g.rooftops} stores →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
