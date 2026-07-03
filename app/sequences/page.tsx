import Link from "next/link";
import { Workflow, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import { listMotions, type MotionView } from "@/lib/sequence-ui";
import { segmentOptions } from "@/lib/sequence";
import { getGeoTree } from "@/lib/geo";
import { MotionStepper, TemperaturePill } from "@/components/sequence-card";
import { SegmentLauncher } from "@/components/segment-launcher";

export const dynamic = "force-dynamic";

const TEMP_ORDER: Record<MotionView["temperature"], number> = { hot: 0, warm: 1, cold: 2, stalled: 3 };

function nextAction(m: MotionView): string {
  if (m.state === "completed") return "Done, no reply, cooling off";
  if (m.state === "exited") return "Stopped";
  if (m.state === "paused") return "Paused";
  const step = m.steps[m.currentStep];
  if (!step) return "—";
  const label = step.channel === "call" ? "Call" : step.channel === "sms" ? "Text" : "Treat";
  const when = m.nextRunAt ? new Date(m.nextRunAt).toLocaleDateString() : "now";
  return `Next: ${label.toLowerCase()} · ${when}`;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/40 px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-medium">{value}</div>
    </div>
  );
}

export default function SequencesPage() {
  const { oems } = segmentOptions();
  const geo = getGeoTree();
  const motions = listMotions().sort(
    (a, b) => TEMP_ORDER[a.temperature] - TEMP_ORDER[b.temperature] || a.dealershipName.localeCompare(b.dealershipName)
  );

  const counts = {
    total: motions.length,
    hot: motions.filter((m) => m.temperature === "hot").length,
    warm: motions.filter((m) => m.temperature === "warm").length,
    stalled: motions.filter((m) => m.temperature === "stalled").length,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Workflow className="h-6 w-6 text-brand" /> Prospect
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a brand and area. Dan works each dealer for you: a call first, then follow-ups once they say yes.
        </p>
      </div>

      <SegmentLauncher oems={oems} geo={geo} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Dan’s working" value={counts.total} />
        <Metric label="Hot" value={counts.hot} />
        <Metric label="Warm" value={counts.warm} />
        <Metric label="Gone quiet" value={counts.stalled} />
      </div>

      {motions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No dealers in play yet. Pick a brand and area above and launch — Pam takes it from there.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {motions.map((m) => (
              <Link
                key={m.enrollmentId}
                href={`/accounts/${m.dealershipId}`}
                className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{m.dealershipName}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[m.oem, [m.city, m.stateProvince].filter(Boolean).join(", "), m.contactName]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <div className="hidden shrink-0 sm:block">
                  <MotionStepper steps={m.steps} />
                </div>
                <div className="shrink-0">
                  <TemperaturePill temp={m.temperature} />
                </div>
                <div className="hidden w-40 shrink-0 text-right text-xs text-muted-foreground md:block">
                  {nextAction(m)}
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
