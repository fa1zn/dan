import { CalendarDays, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import type { CalEvent } from "@/lib/calendar";

/**
 * "Today's plan" for the territory view. Shows the rep's real appointments so Dan can lay the
 * day out as a route. No synthetic events: until a calendar is connected it shows an empty day
 * and the option to connect Google or Outlook.
 */
export function CalendarPanel({
  connected,
  events,
  dateLabel,
  setupProvider,
}: {
  connected: boolean;
  events: CalEvent[];
  dateLabel: string;
  setupProvider?: string;
}) {
  const time = (iso: string) => {
    const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
    return isNaN(d.getTime()) ? "" : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-medium">Today&rsquo;s plan</h2>
          <span className="text-xs text-muted-foreground">{dateLabel}</span>
        </div>

        {connected ? (
          <>
            {events.length > 0 ? (
              <ul className="mt-3 divide-y">
                {events.map((e, i) => (
                  <li key={i} className="flex items-start gap-3 py-2.5">
                    <span className="w-16 shrink-0 text-sm font-medium tabular-nums">{time(e.start_ts)}</span>
                    <div className="min-w-0">
                      <div className="text-sm">{e.title ?? "Appointment"}</div>
                      {e.location && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {e.location}
                          {e.lat != null && e.lng != null && <span className="text-brand"> · on the map</span>}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Nothing on your calendar today. Enjoy the open road.</p>
            )}
            <div className="mt-3 flex gap-4 border-t pt-3 text-xs">
              <a href="/api/calendar/sync" className="font-medium text-brand hover:underline">
                Refresh
              </a>
              <a href="/api/calendar/disconnect" className="text-muted-foreground hover:text-foreground">
                Disconnect
              </a>
            </div>
          </>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-muted-foreground">
              No calendar connected. Connect yours to see today&rsquo;s appointments and your drive between them on the
              map.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href="/api/calendar/oauth/google"
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                <GoogleGlyph /> Connect Google Calendar
              </a>
              <a
                href="/api/calendar/oauth/outlook"
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                <OutlookGlyph /> Connect Outlook
              </a>
            </div>
            {setupProvider && (
              <p className="mt-2 text-xs text-muted-foreground">
                To finish connecting {setupProvider === "outlook" ? "Outlook" : "Google Calendar"}, add its OAuth client
                id to the environment ({setupProvider === "outlook" ? "MS_CALENDAR_CLIENT_ID" : "GOOGLE_CALENDAR_CLIENT_ID"}
                ). Nothing is shown until a real calendar is linked.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function OutlookGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <rect x="2" y="5" width="13" height="14" rx="2" fill="#0A66C2" />
      <path fill="#fff" d="M8.5 8.4c-1.9 0-3.2 1.5-3.2 3.6s1.3 3.6 3.2 3.6 3.2-1.5 3.2-3.6-1.3-3.6-3.2-3.6zm0 5.7c-1 0-1.6-.9-1.6-2.1s.6-2.1 1.6-2.1 1.6.9 1.6 2.1-.6 2.1-1.6 2.1z" />
      <path fill="#28A8EA" d="M15 8.5l7 4V7l-7 1.5z" />
      <path fill="#0A66C2" d="M22 7v10a1 1 0 0 1-1 1h-6V8.5L22 7z" opacity=".7" />
    </svg>
  );
}
