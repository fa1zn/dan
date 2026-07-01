import Link from "next/link";
import { MapPin, CircleCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import { topCities, areaView, type AreaDealer } from "@/lib/territory";
import { CitySelect } from "@/components/city-select";

export const dynamic = "force-dynamic";

function AreaList({ dealers, empty, cap }: { dealers: AreaDealer[]; empty: string; cap?: number }) {
  const shown = cap ? dealers.slice(0, cap) : dealers;
  if (dealers.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">{empty}</CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="divide-y p-0">
        {shown.map((d, i) => (
          <Link
            key={d.id}
            href={`/accounts/${d.id}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{d.name}</div>
              {d.oem && <div className="text-xs text-muted-foreground">{d.oem}</div>}
            </div>
            {d.inPipeline && d.status && (
              <span className="shrink-0 text-xs capitalize text-muted-foreground">{d.status}</span>
            )}
          </Link>
        ))}
        {cap && dealers.length > cap && (
          <div className="px-4 py-2.5 text-xs text-muted-foreground">+ {dealers.length - cap} more in the area</div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function TerritoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const cities = topCities(40);
  const sel = sp.city && sp.state ? { city: sp.city, state: sp.state } : { city: cities[0].city, state: cities[0].state };
  const view = areaView(sel.city, sel.state);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <MapPin className="h-6 w-6 text-brand" /> Territory
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Where are you today? Dan clusters your dealers by area so you can see everyone in one trip — in an efficient
          order.
        </p>
      </div>

      <CitySelect cities={cities} current={`${sel.city}|${sel.state}`} />

      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{view.total} dealers</span> in {view.city}, {view.state} ·{" "}
        {view.inPipeline.length} in your pipeline · {view.untouched.length} not yet contacted
      </p>

      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-medium">
          <CircleCheck className="h-4 w-4 text-brand" /> In your pipeline — check in while you&rsquo;re here
        </h2>
        <AreaList dealers={view.inPipeline} empty="None here in your pipeline yet — the whole area is open below." />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Not yet contacted — worth a stop</h2>
        <AreaList dealers={view.untouched} empty="You&rsquo;ve reached everyone in this area." cap={20} />
      </section>
    </div>
  );
}
