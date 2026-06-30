import { Target, TrendingUp, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import type { GoalView } from "@/lib/goals";

const money = (n: number) => "$" + Math.round(n).toLocaleString();

export function GoalCard({ g }: { g: GoalView }) {
  const closedPct = Math.min(100, (g.closed / g.goal) * 100);
  const projPct = Math.min(100, (g.projected / g.goal) * 100);
  const bonusPct = Math.min(100, (g.bonusThreshold / g.goal) * 100);

  return (
    <Card>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Target className="h-4 w-4 text-brand" /> Your month
          </div>
          <span className="text-xs text-muted-foreground">
            Goal {g.goal} deals · {money(g.commissionPerDeal)}/deal
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
            <div className="text-2xl font-semibold text-brand">{money(g.projectedPayout)}</div>
            <div className="text-sm text-muted-foreground">projected payout</div>
          </div>
        </div>

        <div className="relative h-2.5 w-full rounded-full bg-muted">
          <div className="absolute inset-y-0 left-0 rounded-full bg-brand/30" style={{ width: `${projPct}%` }} />
          <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${closedPct}%` }} />
          <div
            className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded bg-foreground/40"
            style={{ left: `${bonusPct}%` }}
            title={`Bonus at ${g.bonusThreshold} deals`}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="h-4 w-4" /> On pace for ~{g.projected} deals
          </span>
          <span className="flex items-center gap-1.5">
            <Trophy className="h-4 w-4 text-amber-500" />
            {g.toBonus > 0 ? (
              <span>
                <span className="font-medium">{g.toBonus} more</span> to unlock your {money(g.bonusAmount)} bonus
              </span>
            ) : (
              <span className="font-medium text-amber-600 dark:text-amber-400">
                Bonus unlocked — {money(g.bonusAmount)}
              </span>
            )}
          </span>
        </div>

        <div className="border-t pt-3 text-sm text-muted-foreground">
          {g.booked > 0 ? (
            <span>
              <span className="font-medium text-foreground">
                Pam booked {g.pamBooked} of your {g.booked}
              </span>{" "}
              meetings this month — {g.pamBooked} call{g.pamBooked === 1 ? "" : "s"} you didn&rsquo;t have to make.
            </span>
          ) : (
            <span>
              Pam&rsquo;s working <span className="font-medium text-foreground">{g.inOutreach} dealers</span> toward your
              goal. Every meeting she books is one less call for you.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
