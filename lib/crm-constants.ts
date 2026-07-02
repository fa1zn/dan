// Shared CRM vocabulary — safe to import from both client and server components.

export const STATUSES = ["new", "working", "engaged", "won", "lost"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_META: Record<Status, { label: string; badge: "muted" | "default" | "brand" | "success" | "danger" }> = {
  new: { label: "New", badge: "muted" },
  working: { label: "Working", badge: "default" },
  engaged: { label: "Replied", badge: "brand" },
  won: { label: "Won", badge: "success" },
  lost: { label: "Lost", badge: "danger" },
};

export const DEFAULT_STATUS: Status = "new";

export function isStatus(v: unknown): v is Status {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}

export const ACTIVITY_KINDS = ["note", "status_change", "owner_change", "call", "text", "gift", "email", "sequence"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
