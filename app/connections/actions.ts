"use server";

import { revalidatePath } from "next/cache";
import { MOTION_PROVIDERS, setConnection, clearProvider, validateProvider } from "@/lib/connections";

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
