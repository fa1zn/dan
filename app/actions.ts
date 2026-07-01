"use server";

import { revalidatePath } from "next/cache";
import { addNote, logActivity, setNextStep, setOwner, setStatus } from "@/lib/crm";
import { isStatus } from "@/lib/crm-constants";

function revalidate(id: number) {
  revalidatePath(`/accounts/${id}`);
  revalidatePath("/accounts");
  revalidatePath("/pipeline");
  revalidatePath("/worklist");
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

/** Log a call outcome from the worklist: records a call activity + advances the account's status. */
export async function logCallAction(id: number, status: string, note: string) {
  logActivity(id, "call", note);
  if (isStatus(status)) setStatus(id, status);
  revalidate(id);
}
