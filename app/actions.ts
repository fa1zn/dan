"use server";

import { revalidatePath } from "next/cache";
import { addNote, setNextStep, setOwner, setStatus } from "@/lib/crm";
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
