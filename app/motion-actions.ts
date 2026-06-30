"use server";

import { revalidatePath } from "next/cache";
import {
  enroll,
  exitEnrollment,
  getActiveEnrollment,
  getSequenceByName,
  seedDanSequence,
} from "@/lib/sequence";
import { DAN_SEQUENCE_NAME } from "@/lib/sequence-constants";
import { tick } from "@/pipeline/sequence/tick";

function danSequenceId(): number {
  return getSequenceByName(DAN_SEQUENCE_NAME)?.id ?? seedDanSequence();
}

function refresh(id: number) {
  revalidatePath(`/accounts/${id}`);
  revalidatePath("/sequences");
}

/** Enroll the rooftop and immediately fire the first step. A person clicked this → human-initiated. */
export async function enrollAndRunAction(formData: FormData) {
  const id = Number(formData.get("dealershipId"));
  const seqId = danSequenceId();
  const e = enroll(id, seqId);
  await tick({ enrollmentId: e.id, ignoreSchedule: true, humanInitiated: true });
  refresh(id);
}

/** Advance one step now. A person clicked this → human-initiated (allowed to place a real call). */
export async function runStepAction(formData: FormData) {
  const id = Number(formData.get("dealershipId"));
  const e = getActiveEnrollment(id, danSequenceId());
  if (e) await tick({ enrollmentId: e.id, ignoreSchedule: true, humanInitiated: true });
  refresh(id);
}

/** Stop the motion for this rooftop. */
export async function stopAction(formData: FormData) {
  const id = Number(formData.get("dealershipId"));
  const e = getActiveEnrollment(id, danSequenceId());
  if (e) exitEnrollment(e.id, "stopped by rep");
  refresh(id);
}
