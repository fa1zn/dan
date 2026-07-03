import { getSqlite } from "./db";
import { encrypt, decrypt } from "./secrets";

/*
 * Calendar link for the territory view: the rep's real appointments, so Dan can show where
 * they're traveling and when, and plot the day's stops on the map.
 *
 * Honest by design: NO synthetic data. Events exist only after a real Google/Outlook calendar
 * is connected (OAuth) and synced. Tokens are encrypted at rest. Until connected, isConnected()
 * is false and eventsForDay() is empty, and the UI shows a "connect your calendar" state.
 */

const DEFAULT_REP_ID = "1";

export type CalProvider = "google" | "outlook";

function db() {
  const d = getSqlite();
  d.exec(`
    CREATE TABLE IF NOT EXISTS calendar_connection (
      rep_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      connected_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS calendar_event (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rep_id TEXT NOT NULL,
      title TEXT,
      location TEXT,
      lat REAL,
      lng REAL,
      start_ts TEXT NOT NULL,
      end_ts TEXT,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_calendar_event_rep_day ON calendar_event(rep_id, start_ts);
  `);
  // Token columns, added idempotently (the table may predate them).
  for (const ddl of [
    "ALTER TABLE calendar_connection ADD COLUMN access_token_enc TEXT",
    "ALTER TABLE calendar_connection ADD COLUMN refresh_token_enc TEXT",
    "ALTER TABLE calendar_connection ADD COLUMN expires_at INTEGER",
  ]) {
    try {
      d.exec(ddl);
    } catch {
      /* column already exists */
    }
  }
  return d;
}

export function ensureCalendarTables(): void {
  db();
}

export function isCalendarConnected(repId: string = DEFAULT_REP_ID): boolean {
  return !!db().prepare("SELECT 1 FROM calendar_connection WHERE rep_id = ?").get(repId);
}

export function connectedProvider(repId: string = DEFAULT_REP_ID): CalProvider | null {
  const row = db().prepare("SELECT provider FROM calendar_connection WHERE rep_id = ?").get(repId) as
    | { provider: CalProvider }
    | undefined;
  return row?.provider ?? null;
}

export function disconnectCalendar(repId: string = DEFAULT_REP_ID): void {
  const d = db();
  d.prepare("DELETE FROM calendar_connection WHERE rep_id = ?").run(repId);
  d.prepare("DELETE FROM calendar_event WHERE rep_id = ?").run(repId);
}

export interface CalEvent {
  title: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  start_ts: string;
  end_ts: string | null;
}

/** The rep's events for a given local day (YYYY-MM-DD). Empty until a calendar is synced. */
export function eventsForDay(day: string, repId: string = DEFAULT_REP_ID): CalEvent[] {
  return db()
    .prepare(
      `SELECT title, location, lat, lng, start_ts, end_ts
       FROM calendar_event WHERE rep_id = ? AND substr(start_ts, 1, 10) = ? ORDER BY start_ts`,
    )
    .all(repId, day) as CalEvent[];
}

// ------------------------------- OAuth config -------------------------------

interface ProviderConfig {
  clientId?: string;
  clientSecret?: string;
  tokenUrl: string;
  scope: string;
  extraTokenParams?: Record<string, string>;
}

export function providerConfig(provider: CalProvider): ProviderConfig {
  if (provider === "google") {
    return {
      clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      tokenUrl: "https://oauth2.googleapis.com/token",
      scope: "https://www.googleapis.com/auth/calendar.readonly",
    };
  }
  return {
    clientId: process.env.MS_CALENDAR_CLIENT_ID,
    clientSecret: process.env.MS_CALENDAR_CLIENT_SECRET,
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scope: "Calendars.Read offline_access",
  };
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

/** Exchange an authorization code for tokens and store the connection (tokens encrypted). */
export async function exchangeCodeAndConnect(
  provider: CalProvider,
  code: string,
  redirectUri: string,
  repId: string = DEFAULT_REP_ID,
): Promise<void> {
  const cfg = providerConfig(provider);
  if (!cfg.clientId || !cfg.clientSecret) throw new Error(`${provider} client id/secret not configured`);
  const body = new URLSearchParams({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  if (provider === "outlook") body.set("scope", cfg.scope);
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  const tok = (await res.json()) as TokenResponse;
  saveConnection(provider, tok, repId);
}

function saveConnection(provider: CalProvider, tok: TokenResponse, repId: string): void {
  const expiresAt = Math.floor(Date.now() / 1000) + (tok.expires_in ?? 3600);
  db()
    .prepare(
      `INSERT INTO calendar_connection (rep_id, provider, connected_at, access_token_enc, refresh_token_enc, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(rep_id) DO UPDATE SET provider=excluded.provider, connected_at=excluded.connected_at,
         access_token_enc=excluded.access_token_enc,
         refresh_token_enc=COALESCE(excluded.refresh_token_enc, calendar_connection.refresh_token_enc),
         expires_at=excluded.expires_at`,
    )
    .run(
      repId,
      provider,
      new Date().toISOString(),
      encrypt(tok.access_token),
      tok.refresh_token ? encrypt(tok.refresh_token) : null,
      expiresAt,
    );
}

/** A valid access token, refreshing via the stored refresh token if the current one expired. */
async function validAccessToken(repId: string): Promise<{ provider: CalProvider; token: string } | null> {
  const row = db()
    .prepare("SELECT provider, access_token_enc, refresh_token_enc, expires_at FROM calendar_connection WHERE rep_id = ?")
    .get(repId) as
    | { provider: CalProvider; access_token_enc: string | null; refresh_token_enc: string | null; expires_at: number | null }
    | undefined;
  if (!row || !row.access_token_enc) return null;
  const now = Math.floor(Date.now() / 1000);
  if (row.expires_at && now < row.expires_at - 60) {
    return { provider: row.provider, token: decrypt(row.access_token_enc) };
  }
  // Expired: refresh.
  if (!row.refresh_token_enc) return { provider: row.provider, token: decrypt(row.access_token_enc) };
  const cfg = providerConfig(row.provider);
  if (!cfg.clientId || !cfg.clientSecret) return null;
  const body = new URLSearchParams({
    refresh_token: decrypt(row.refresh_token_enc),
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "refresh_token",
  });
  if (row.provider === "outlook") body.set("scope", cfg.scope);
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return null;
  const tok = (await res.json()) as TokenResponse;
  saveConnection(row.provider, tok, repId);
  return { provider: row.provider, token: tok.access_token };
}

// ------------------------------- event sync -------------------------------

function dayRange(): { startISO: string; endISO: string; day: string } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { startISO: start.toISOString(), endISO: end.toISOString(), day: now.toISOString().slice(0, 10) };
}

interface RawEvent {
  title: string | null;
  location: string | null;
  start: string;
  end: string | null;
}

async function fetchGoogleEvents(token: string, startISO: string, endISO: string): Promise<RawEvent[]> {
  const u = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  u.searchParams.set("timeMin", startISO);
  u.searchParams.set("timeMax", endISO);
  u.searchParams.set("singleEvents", "true");
  u.searchParams.set("orderBy", "startTime");
  const res = await fetch(u.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`google events failed: ${res.status}`);
  const data = (await res.json()) as {
    items?: Array<{ summary?: string; location?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } }>;
  };
  return (data.items ?? []).map((e) => ({
    title: e.summary ?? null,
    location: e.location ?? null,
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? null,
  }));
}

async function fetchOutlookEvents(token: string, startISO: string, endISO: string): Promise<RawEvent[]> {
  const u = new URL("https://graph.microsoft.com/v1.0/me/calendarView");
  u.searchParams.set("startDateTime", startISO);
  u.searchParams.set("endDateTime", endISO);
  u.searchParams.set("$orderby", "start/dateTime");
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' },
  });
  if (!res.ok) throw new Error(`outlook events failed: ${res.status}`);
  const data = (await res.json()) as {
    value?: Array<{ subject?: string; location?: { displayName?: string }; start?: { dateTime?: string }; end?: { dateTime?: string } }>;
  };
  return (data.value ?? []).map((e) => ({
    title: e.subject ?? null,
    location: e.location?.displayName ?? null,
    start: e.start?.dateTime ?? "",
    end: e.end?.dateTime ?? null,
  }));
}

/** Best-effort geocode via OpenStreetMap Nominatim so appointments can plot on the map. */
async function geocode(location: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const u = new URL("https://nominatim.openstreetmap.org/search");
    u.searchParams.set("q", location);
    u.searchParams.set("format", "json");
    u.searchParams.set("limit", "1");
    const res = await fetch(u.toString(), { headers: { "User-Agent": "Dan/1.0 (territory map)" } });
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!arr.length) return null;
    return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
  } catch {
    return null;
  }
}

/** Pull today's events from the connected provider into calendar_event. Returns count synced. */
export async function syncCalendar(repId: string = DEFAULT_REP_ID): Promise<number> {
  const auth = await validAccessToken(repId);
  if (!auth) return 0;
  const { startISO, endISO, day } = dayRange();
  const raw =
    auth.provider === "google"
      ? await fetchGoogleEvents(auth.token, startISO, endISO)
      : await fetchOutlookEvents(auth.token, startISO, endISO);

  const d = db();
  const now = new Date().toISOString();
  // Replace today's synced events so a resync is idempotent, not additive.
  d.prepare("DELETE FROM calendar_event WHERE rep_id = ? AND substr(start_ts,1,10) = ?").run(repId, day);
  const insert = d.prepare(
    `INSERT INTO calendar_event (rep_id, title, location, lat, lng, start_ts, end_ts, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  let n = 0;
  for (const e of raw) {
    if (!e.start) continue;
    let lat: number | null = null;
    let lng: number | null = null;
    if (e.location) {
      const g = await geocode(e.location);
      if (g) {
        lat = g.lat;
        lng = g.lng;
      }
    }
    insert.run(repId, e.title, e.location, lat, lng, e.start, e.end, auth.provider, now);
    n++;
  }
  return n;
}
