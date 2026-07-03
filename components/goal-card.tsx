import { Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import type { GoalView } from "@/lib/goals";

const money = (n: number) => "$" + Math.round(n).toLocaleString();

export function GoalCard({ g }: { g: GoalView }) {
  const pct = g.goal > 0 ? Math.min(100, (g.closed / g.goal) * 100) : 0;

  // Nothing worked yet — don't parade a fabricated goal/pipeline. Say so plainly.
  if (g.openDeals === 0 && g.booked === 0 && g.closed === 0) {
    return (
      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Target className="h-4 w-4 text-brand" /> Your month
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            No open deals yet. As you work your book, your pipeline and progress show up here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Target className="h-4 w-4 text-brand" /> Your month
          </div>
          <span className="text-xs text-muted-foreground">
            Goal {g.goal} · {money(g.commissionPerDeal)}/deal
          </span>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-3xl font-semibold leading-none">
              {g.closed}
              <span className="text-xl text-muted-foreground"> / {g.goal}</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">deals closed</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold">{money(g.pipelineValue)}</div>
            <div className="text-sm text-muted-foreground">in pipeline</div>
          </div>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>

        <div className="flex gap-x-6 border-t pt-3 text-sm text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{g.openDeals}</span> open
          </span>
          <span>
            <span className="font-medium text-foreground">{g.booked}</span> booked
          </span>
          <span>
            <span className="font-medium text-foreground">{g.closed}</span> closed
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
