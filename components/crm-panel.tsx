"use client";

import { useState, useTransition } from "react";
import { MessageSquare, ArrowRightLeft, UserCog, Loader2, Phone, Gift, Workflow } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Input } from "./ui";
import { cn } from "@/lib/ui";
import { STATUSES, STATUS_META, type Status } from "@/lib/crm-constants";
import { addNoteAction, updateNextStepAction, updateOwnerAction, updateStatusAction } from "@/app/actions";

interface ActivityItem {
  id: number;
  kind: string;
  body: string | null;
  author: string | null;
  created_at: string;
}

function relTime(iso: string): string {
  const then = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function CrmPanel({
  id,
  status,
  owner,
  nextStep,
  activity,
}: {
  id: number;
  status: Status;
  owner: string | null;
  nextStep: string | null;
  activity: ActivityItem[];
}) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [ownerVal, setOwnerVal] = useState(owner ?? "");
  const [stepVal, setStepVal] = useState(nextStep ?? "");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-foreground">Deal</CardTitle>
        {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">Status</label>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => start(() => updateStatusAction(id, s))}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  s === status
                    ? "border-brand bg-brand/15 text-brand"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">Owner</label>
            <Input
              value={ownerVal}
              placeholder="Unassigned"
              onChange={(e) => setOwnerVal(e.target.value)}
              onBlur={() => ownerVal !== (owner ?? "") && start(() => updateOwnerAction(id, ownerVal))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">Next step</label>
            <Input
              value={stepVal}
              placeholder="e.g. Call GM re: trade-in tool"
              onChange={(e) => setStepVal(e.target.value)}
              onBlur={() => stepVal !== (nextStep ?? "") && start(() => updateNextStepAction(id, stepVal))}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">Log a note</label>
          <div className="flex gap-2">
            <Input
              value={note}
              placeholder="What happened on this account…"
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && note.trim()) {
                  start(() => addNoteAction(id, note));
                  setNote("");
                }
              }}
            />
            <Button
              variant="brand"
              disabled={!note.trim()}
              onClick={() => {
                start(() => addNoteAction(id, note));
                setNote("");
              }}
            >
              Add
            </Button>
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Activity</div>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet. Set a status or log a note to get started.</p>
          ) : (
            <ul className="space-y-3">
              {activity.map((a) => {
                const Icon =
                  a.kind === "call"
                    ? Phone
                    : a.kind === "text"
                      ? MessageSquare
                      : a.kind === "gift"
                        ? Gift
                        : a.kind === "sequence"
                          ? Workflow
                          : a.kind === "note"
                            ? MessageSquare
                            : a.kind === "owner_change"
                              ? UserCog
                              : ArrowRightLeft;
                return (
                  <li key={a.id} className="flex gap-2.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm">{a.body}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.author ?? "Dan"} · {relTime(a.created_at)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return <Badge variant={m.badge}>{m.label}</Badge>;
}
