"use server";

import { revalidatePath } from "next/cache";
import { addNote, setNextStep, setOwner, setStatus, logActivity, getCrm } from "@/lib/crm";
import { isStatus } from "@/lib/crm-constants";

function revalidate(id: number) {
  revalidatePath(`/accounts/${id}`);
  revalidatePath("/accounts");
  revalidatePath("/pipeline");
  revalidatePath("/");
}

export async function updateStatusAction(id: number, status: string) {
  if (!isStatus(status)) return;
  setStatus(id, status);
  revalidate(id);
}

export async function updateOwnerAction(id: number, owner: string) {
  setOwner(id, owner);
  revalidate(id);
}

export async function updateNextStepAction(id: number, nextStep: string) {
  setNextStep(id, nextStep);
  revalidate(id);
}

export async function addNoteAction(id: number, body: string) {
  addNote(id, body);
  revalidate(id);
}

/**
 * Manually log a motion touch on the record — call, text, or gift — whether or not
 * Pam ran it automatically. Every interaction lands on the same timeline. The first
 * real touch nudges a fresh lead into "working".
 */
export async function logTouchAction(id: number, channel: "call" | "text" | "gift", note: string) {
  const verb = channel === "call" ? "Called" : channel === "text" ? "Texted" : "Sent a gift";
  const body = note.trim() ? `${verb} — ${note.trim()}` : verb;
  logActivity(id, channel, body, "You");
  if (getCrm(id).status === "new") setStatus(id, "working", "You");
  revalidate(id);
}
