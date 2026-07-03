"use server";

import { revalidatePath } from "next/cache";
import { MOTION_PROVIDERS, setConnection, clearProvider, validateProvider, setCallProvider, getConnection } from "@/lib/connections";
import { testHubspotToken, syncHubspotForRep } from "@/lib/hubspot";

/** Save the fields a rep typed for one provider. Empty fields are left unchanged. */
export async function saveConnectionAction(formData: FormData) {
  const providerId = String(formData.get("__provider") ?? "");
  const def = MOTION_PROVIDERS.find((p) => p.id === providerId);
  if (!def) return;
  for (const f of def.fields) {
    const val = String(formData.get(f.name) ?? "").trim();
    if (val) setConnection(f.name, val); // blank = keep existing
  }
  revalidatePath("/connections");
}

export async function clearConnectionAction(formData: FormData) {
  const providerId = String(formData.get("__provider") ?? "");
  clearProvider(providerId);
  revalidatePath("/connections");
}

export async function testConnectionAction(providerId: string): Promise<{ ok: boolean; message: string }> {
  return validateProvider(providerId);
}

export async function setCallProviderAction(formData: FormData) {
  setCallProvider(String(formData.get("provider") ?? ""));
  revalidatePath("/connections");
}

/**
 * Connect the rep's HubSpot and reconcile it against our book: match their Companies
 * to our rooftops and overlay their pipeline (stage, owner, last activity, contacts).
 * If a token is supplied it's validated + saved first; blank re-syncs the saved token.
 */
export async function connectHubspotAction(token: string): Promise<{ ok: boolean; message: string }> {
  const t = token.trim();
  if (t) {
    const test = await testHubspotToken(t);
    if (!test.ok) return test;
    setConnection("HUBSPOT_TOKEN", t);
  } else if (!getConnection("HUBSPOT_TOKEN")) {
    return { ok: false, message: "Paste your HubSpot private-app token to connect." };
  }
  try {
    const r = await syncHubspotForRep();
    revalidatePath("/connections");
    revalidatePath("/accounts");
    revalidatePath("/today");
    const ex = r.examples[0];
    return {
      ok: true,
      message:
        `Matched ${r.companiesMatched} of ${r.hsCompanies} HubSpot companies to your rooftops` +
        ` · ${r.contactsAttached} contacts attached` +
        (ex ? ` · e.g. "${ex.hsName}" → ${ex.rooftop}${ex.stage ? ` (${ex.stage})` : ""}` : ""),
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
