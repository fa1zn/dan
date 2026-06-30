import { Phone, MessageSquare, Gift, Clock, Workflow } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import type { Channel } from "@/lib/sequence-constants";
import type { MotionStepView, MotionView } from "@/lib/sequence-ui";
import { TEMPERATURE_LABEL } from "@/lib/sequence-ui";
import { cn } from "@/lib/ui";

const CHANNEL_ICON: Record<Channel, React.ComponentType<{ className?: string }>> = {
  call: Phone,
  sms: MessageSquare,
  gift: Gift,
};

const CHANNEL_LABEL: Record<Channel, string> = { call: "Call", sms: "Text", gift: "Edible" };

const TEMP_CLASS: Record<MotionView["temperature"], string> = {
  hot: "bg-red-500/10 text-red-600 dark:text-red-400",
  warm: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  cold: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  stalled: "bg-muted text-muted-foreground",
};

export function TemperaturePill({ temp }: { temp: MotionView["temperature"] }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", TEMP_CLASS[temp])}>
      {TEMPERATURE_LABEL[temp]}
    </span>
  );
}

function StepDot({ step }: { step: MotionStepView }) {
  const Icon = CHANNEL_ICON[step.channel];
  const cls =
    step.state === "sent"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : step.state === "skipped"
        ? "bg-muted text-muted-foreground line-through"
        : step.state === "next"
          ? "border border-dashed border-foreground/30 text-muted-foreground"
          : "bg-muted/50 text-muted-foreground";
  return (
    <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", cls)} title={`${CHANNEL_LABEL[step.channel]} · ${step.state}`}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

/** Horizontal call → text → edible stepper. */
export function MotionStepper({ steps }: { steps: MotionStepView[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((s, i) => (
        <div key={s.index} className="flex items-center gap-1.5">
          <StepDot step={s} />
          {i < steps.length - 1 && <span className="h-px w-4 bg-border" />}
        </div>
      ))}
    </div>
  );
}

function nextActionText(m: MotionView): string {
  if (m.state === "completed") return "Motion completed";
  if (m.state === "exited") return `Exited — ${m.exitReason ?? "stopped"}`;
  if (m.state === "paused") return "Paused";
  const step = m.steps[m.currentStep];
  if (!step) return "—";
  const label = CHANNEL_LABEL[step.channel];
  const when = m.nextRunAt ? new Date(m.nextRunAt).toLocaleString() : "now";
  return `Next: ${label.toLowerCase()} · ${when}`;
}

/** The per-rooftop motion card for the account detail page. */
export function SequenceCard({ motion }: { motion: MotionView | null }) {
  if (!motion) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-base font-semibold text-foreground">
            <Workflow className="h-4 w-4 text-brand" /> Sales motion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">
            Not enrolled in a sequence. Run <code className="text-foreground">npm run sequence:enroll -- --id {"<id>"}</code> to
            start the call → text → edible motion.
          </div>
        </CardContent>
      </Card>
    );
  }

  const sentCount = motion.touches;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-1.5 text-base font-semibold text-foreground">
          <Workflow className="h-4 w-4 text-brand" /> Sales motion
        </CardTitle>
        <TemperaturePill temp={motion.temperature} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {motion.sequenceName} · step {Math.min(motion.currentStep + 1, motion.steps.length)} of {motion.steps.length}
          </span>
          <span className="text-xs text-muted-foreground">{sentCount} sent</span>
        </div>

        <MotionStepper steps={motion.steps} />

        <div className="flex items-center gap-2 rounded-md bg-blue-500/5 px-3 py-2 text-sm text-blue-700 dark:text-blue-300">
          <Clock className="h-4 w-4 shrink-0" />
          {nextActionText(motion)}
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t pt-3 text-sm">
          <div>
            <span className="text-muted-foreground">State</span>{" "}
            <span className="font-medium capitalize">{motion.state}</span>
          </div>
          <div>
            <span className="text-muted-foreground">CRM</span>{" "}
            <span className="font-medium capitalize">{motion.crmStatus}</span>
          </div>
          {motion.steps.some((s) => s.channel === "gift" && s.costCents) && (
            <div>
              <span className="text-muted-foreground">Gift</span>{" "}
              <span className="font-medium">
                ${((motion.steps.find((s) => s.channel === "gift")?.costCents ?? 0) / 100).toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
