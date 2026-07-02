"use server";

import { revalidatePath } from "next/cache";
import { countSegment, enrollSegment, getSequenceByName, seedDanSequence, type SegmentFilter } from "@/lib/sequence";
import { DAN_SEQUENCE_NAME } from "@/lib/sequence-constants";

function filterFrom(data: { oem?: string; country?: string; state?: string; city?: string }): SegmentFilter {
  return {
    oem: data.oem || undefined,
    country: data.country || undefined,
    state: data.state || undefined,
    city: data.city?.trim() || undefined,
  };
}

export async function previewSegmentAction(data: { oem?: string; country?: string; state?: string; city?: string }): Promise<number> {
  return countSegment(filterFrom(data));
}

export async function launchSegmentAction(formData: FormData) {
  const f = filterFrom({
    oem: String(formData.get("oem") ?? ""),
    country: String(formData.get("country") ?? ""),
    state: String(formData.get("state") ?? ""),
    city: String(formData.get("city") ?? ""),
  });
  if (!f.oem && !f.country && !f.state && !f.city) return; // refuse to enroll "everything"
  const seqId = getSequenceByName(DAN_SEQUENCE_NAME)?.id ?? seedDanSequence();
  // Paced: 2 minutes between rooftops so the campaign trickles, never blasts.
  enrollSegment(f, seqId, { cap: 100, staggerSec: 120 });
  revalidatePath("/sequences");
}
