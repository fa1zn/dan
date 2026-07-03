import type { DealershipLite } from "../../lib/sequence";

/** Substitute {{vars}} in a step template from the rooftop row + first contact. Never throws. */
export function render(template: string, d: DealershipLite, contact?: { name?: string }): string {
  const first = (contact?.name || "").trim().split(/\s+/)[0] || "there";
  const vars: Record<string, string> = {
    name: d.name ?? "",
    oem: d.oem ?? "",
    city: d.city ?? "",
    stateProvince: d.state_province ?? "",
    groupName: d.group_name ?? "",
    contactFirst: first,
  };
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}
