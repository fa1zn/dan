/*
 * Google Calendar / Meet booking. When a rep books a demo, we open a pre-filled Google
 * Calendar event for the scheduled time. On a Google Workspace account (or once the Google
 * Calendar API is connected on the Integrations page) the event carries a Google Meet link
 * automatically; the deep link below works with no credentials for the first version.
 */
export function googleCalendarUrl(opts: {
  title: string;
  startISO: string; // local ISO from a datetime-local input, e.g. "2026-07-03T10:00"
  minutes?: number;
  details?: string;
  guests?: string[];
}): string {
  const start = new Date(opts.startISO);
  const end = new Date(start.getTime() + (opts.minutes ?? 30) * 60000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${stamp(start)}/${stamp(end)}`,
    details: opts.details ?? "",
  });
  if (opts.guests?.length) p.set("add", opts.guests.join(","));
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** A readable label for a datetime-local value, e.g. "Thu, Jul 3, 10:00 AM". */
export function whenLabel(startISO: string): string {
  const d = new Date(startISO);
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Default the picker to the next business-ish slot: tomorrow at 10:00 local. */
export function defaultSlotISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
