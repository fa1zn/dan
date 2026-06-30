import { Phone, MessageSquare, Gift, Clock, Workflow, Play, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui";
import type { Channel } from "@/lib/sequence-constants";
import type { MotionStepView, MotionView } from "@/lib/sequence-ui";
import { TEMPERATURE_LABEL } from "@/lib/sequence-ui";
import { cn } from "@/lib/ui";
import { enrollAndRunAction, runStepAction, stopAction } from "@/app/motion-actions";

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
  if (m.state === "completed") return "Outreach done";
  if (m.state === "exited") return `Stopped — ${m.exitReason ?? "stopped"}`;
  if (m.state === "paused") return "Paused";
  const step = m.steps[m.currentStep];
  if (!step) return "—";
  const label = CHANNEL_LABEL[step.channel];
  const when = m.nextRunAt ? new Date(m.nextRunAt).toLocaleString() : "now";
  return `Next: ${label.toLowerCase()} · ${when}`;
}

const RUN_LABEL: Record<Channel, string> = { call: "Call now", sms: "Text now", gift: "Send gift" };

/** The per-rooftop motion card for the account detail page. */
export function SequenceCard({ motion, dealershipId }: { motion: MotionView | null; dealershipId: number }) {
  if (!motion) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-base font-semibold text-foreground">
            <Workflow className="h-4 w-4 text-brand" /> Outreach
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pam hasn&rsquo;t reached out yet. Start with a call, then follow-ups once they say yes.
          </p>
          <form action={enrollAndRunAction}>
            <input type="hidden" name="dealershipId" value={dealershipId} />
            <Button type="submit" variant="brand" size="sm">
              <Play className="h-4 w-4" /> Have Pam call
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  const sentCount = motion.touches;
  const nextStep = motion.state === "active" ? motion.steps[motion.currentStep] : undefined;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-1.5 text-base font-semibold text-foreground">
          <Workflow className="h-4 w-4 text-brand" /> Outreach
        </CardTitle>
        <TemperaturePill temp={motion.temperature} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Step {Math.min(motion.currentStep + 1, motion.steps.length)} of {motion.steps.length}
          </span>
          <span className="text-xs text-muted-foreground">{sentCount} sent</span>
        </div>

        <MotionStepper steps={motion.steps} />

        <div className="flex items-center gap-2 rounded-md bg-brand/5 px-3 py-2 text-sm text-foreground">
          <Clock className="h-4 w-4 shrink-0 text-brand" />
          {nextActionText(motion)}
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Compliance-first: Pam opens with a disclosed, no-sell inquiry. Text &amp; gift are held until consent.
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t pt-3 text-sm">
          <div>
            <span className="text-muted-foreground">Outreach</span>{" "}
            <span className="font-medium capitalize">{motion.state === "active" ? "in progress" : motion.state}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Stage</span>{" "}
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

        {nextStep ? (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <form action={runStepAction}>
              <input type="hidden" name="dealershipId" value={dealershipId} />
              <Button type="submit" variant="brand" size="sm">
                <Play className="h-4 w-4" /> {RUN_LABEL[nextStep.channel]}
              </Button>
            </form>
            <form action={stopAction}>
              <input type="hidden" name="dealershipId" value={dealershipId} />
              <Button type="submit" variant="outline" size="sm">
                Stop
              </Button>
            </form>
          </div>
        ) : (
          <div className="border-t pt-3">
            <form action={enrollAndRunAction}>
              <input type="hidden" name="dealershipId" value={dealershipId} />
              <Button type="submit" variant="outline" size="sm">
                <Play className="h-4 w-4" /> Reach out again
              </Button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
