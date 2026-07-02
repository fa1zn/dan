import { getSqlite } from "./db";
import { encrypt, decrypt } from "./secrets";

/*
 * Per-rep provider credentials, entered through the Connections UI rather than a global
 * .env. Secrets are encrypted at rest. Until login lands there is a single implicit rep
 * (DEFAULT_REP_ID); the schema is already keyed by rep_id so multi-rep is a drop-in later.
 *
 * repEnv() merges a rep's saved credentials over process.env, so the motion engine reads
 * "this rep's keys" with .env as a fallback.
 */

export const DEFAULT_REP_ID = 1;

export interface ProviderField {
  name: string; // the env-style key, e.g. BLAND_API_KEY
  label: string;
  secret?: boolean;
  placeholder?: string;
  optional?: boolean;
  help?: string; // plain-language "where do I find this?"
}

export type ProviderSection = "voice" | "text" | "edible";

export interface ProviderDef {
  id: string;
  name: string;
  blurb: string;
  section: ProviderSection;
  fields: ProviderField[];
}

export const MOTION_PROVIDERS: ProviderDef[] = [
  {
    id: "vapi",
    name: "Vapi",
    blurb: "Composable voice AI for the call. Bring your own Vapi number and assistant.",
    section: "voice",
    fields: [
      { name: "VAPI_API_KEY", label: "API key", secret: true, help: "In your Vapi dashboard → API Keys. Use the private (server) key." },
      { name: "VAPI_PHONE_NUMBER_ID", label: "Phone number ID", help: "In Vapi → Phone Numbers → click your number → copy its ID." },
      { name: "VAPI_ASSISTANT_ID", label: "Assistant ID", optional: true, placeholder: "leave blank to use Dan’s built-in assistant" },
    ],
  },
  {
    id: "bland",
    name: "Bland.ai",
    blurb: "Turnkey conversational voice agent. Dan holds a real two-way call.",
    section: "voice",
    fields: [{ name: "BLAND_API_KEY", label: "API key", secret: true, help: "In your Bland dashboard → API Keys." }],
  },
  {
    id: "twilio",
    name: "Twilio",
    blurb: "Texts, plus a fallback TTS voice. SMS to US numbers also needs A2P 10DLC registration.",
    section: "text",
    fields: [
      { name: "TWILIO_ACCOUNT_SID", label: "Account SID", placeholder: "AC…", help: "Twilio Console home page → Account Info." },
      { name: "TWILIO_AUTH_TOKEN", label: "Auth token", secret: true, help: "Right next to the SID, click to reveal it." },
      { name: "TWILIO_FROM", label: "From number", placeholder: "+1…", help: "Your Twilio phone number, like +1 415 555 0123." },
    ],
  },
  {
    id: "gifting",
    name: "Gifting platform",
    blurb: "Programmatic edible sends (Postal / Sendoso / Reachdesk).",
    section: "edible",
    fields: [
      { name: "GIFT_API_URL", label: "API URL", placeholder: "https://…" },
      { name: "GIFT_API_KEY", label: "API key", secret: true },
    ],
  },
];

/** The voice providers a rep can choose between for the call step. */
export const CALL_PROVIDERS = [
  { id: "vapi", name: "Vapi" },
  { id: "bland", name: "Bland.ai" },
  { id: "twilio", name: "Twilio (TTS)" },
] as const;

export function getCallProvider(repId = DEFAULT_REP_ID): string {
  return getConnection("CALL_PROVIDER", repId) || "vapi";
}

export function setCallProvider(providerId: string, repId = DEFAULT_REP_ID) {
  setConnection("CALL_PROVIDER", providerId, repId);
}

let _ensured = false;
function cdb() {
  const db = getSqlite();
  if (!_ensured) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS connections (
        rep_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (rep_id, name)
      );
    `);
    _ensured = true;
  }
  return db;
}

export function setConnection(name: string, value: string, repId = DEFAULT_REP_ID) {
  const db = cdb();
  if (!value) {
    db.prepare("DELETE FROM connections WHERE rep_id = ? AND name = ?").run(repId, name);
    return;
  }
  db.prepare(
    `INSERT INTO connections (rep_id, name, value, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(rep_id, name) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
  ).run(repId, name, encrypt(value));
}

export function clearProvider(providerId: string, repId = DEFAULT_REP_ID) {
  const def = MOTION_PROVIDERS.find((p) => p.id === providerId);
  if (!def) return;
  const db = cdb();
  for (const f of def.fields) db.prepare("DELETE FROM connections WHERE rep_id = ? AND name = ?").run(repId, f.name);
}

export function getConnection(name: string, repId = DEFAULT_REP_ID): string | null {
  const row = cdb().prepare("SELECT value FROM connections WHERE rep_id = ? AND name = ?").get(repId, name) as
    | { value: string }
    | undefined;
  return row ? decrypt(row.value) : null;
}

/** A rep's saved credentials merged over process.env (DB wins). */
export function repEnv(repId = DEFAULT_REP_ID): NodeJS.ProcessEnv {
  const rows = cdb().prepare("SELECT name, value FROM connections WHERE rep_id = ?").all(repId) as {
    name: string;
    value: string;
  }[];
  const out: Record<string, string> = {};
  for (const r of rows) {
    const v = decrypt(r.value);
    if (v) out[r.name] = v;
  }
  return { ...process.env, ...out };
}

export interface ProviderStatus {
  id: string;
  name: string;
  blurb: string;
  section: ProviderSection;
  connected: boolean;
  fields: Array<ProviderField & { masked: string | null }>;
}

function mask(v: string, secret?: boolean): string {
  return secret ? `••••${v.slice(-4)}` : v;
}

/** Status reflects the effective value (saved credential OR .env fallback). */
export function connectionStatus(repId = DEFAULT_REP_ID): ProviderStatus[] {
  const env = repEnv(repId);
  return MOTION_PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    blurb: p.blurb,
    section: p.section,
    connected: p.fields.filter((f) => !f.optional).every((f) => !!env[f.name]),
    fields: p.fields.map((f) => ({ ...f, masked: env[f.name] ? mask(env[f.name]!, f.secret) : null })),
  }));
}

export async function validateProvider(providerId: string, repId = DEFAULT_REP_ID): Promise<{ ok: boolean; message: string }> {
  const env = repEnv(repId);
  if (providerId === "vapi") {
    if (!env.VAPI_API_KEY) return { ok: false, message: "No API key saved." };
    if (!env.VAPI_PHONE_NUMBER_ID) return { ok: false, message: "API key saved. Add a Phone number ID to place calls." };
    try {
      const r = await fetch("https://api.vapi.ai/phone-number", { headers: { Authorization: `Bearer ${env.VAPI_API_KEY}` } });
      if (r.ok) return { ok: true, message: "Vapi key valid." };
      if (r.status === 401 || r.status === 403) return { ok: false, message: "Vapi rejected the key." };
      return { ok: true, message: "Saved (couldn't fully verify; will confirm on first call)." };
    } catch (e) {
      return { ok: true, message: `Saved (network check skipped: ${(e as Error).message}).` };
    }
  }
  if (providerId === "bland") {
    if (!env.BLAND_API_KEY) return { ok: false, message: "No API key saved." };
    try {
      const r = await fetch("https://api.bland.ai/v1/me", { headers: { authorization: env.BLAND_API_KEY } });
      if (r.ok) return { ok: true, message: "Bland key valid." };
      if (r.status === 401 || r.status === 403) return { ok: false, message: "Bland rejected the key." };
      return { ok: true, message: "Saved (couldn't fully verify; will confirm on first call)." };
    } catch (e) {
      return { ok: true, message: `Saved (network check skipped: ${(e as Error).message}).` };
    }
  }
  if (providerId === "twilio") {
    const sid = env.TWILIO_ACCOUNT_SID;
    const tok = env.TWILIO_AUTH_TOKEN;
    if (!sid || !tok) return { ok: false, message: "Account SID + auth token required." };
    try {
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
        headers: { Authorization: `Basic ${Buffer.from(`${sid}:${tok}`).toString("base64")}` },
      });
      return r.ok
        ? { ok: true, message: "Twilio credentials valid." }
        : { ok: false, message: `Twilio rejected the credentials (HTTP ${r.status}).` };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }
  if (providerId === "gifting") {
    return env.GIFT_API_URL && env.GIFT_API_KEY
      ? { ok: true, message: "Saved (no live check for this provider)." }
      : { ok: false, message: "API URL + key required." };
  }
  return { ok: false, message: "Unknown provider." };
}
