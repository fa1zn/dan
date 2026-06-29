import type { RawRecord } from "../../lib/types";

/**
 * The common Source interface. Every adapter — the OSM backbone, each OEM
 * locator, and future additions — implements this and is registered in the
 * source registry (sources/index.ts). `kind` lets downstream steps reason about
 * provenance (e.g. OEM sources confirm brand affiliation).
 */
export interface Source {
  name: string;
  kind: "osm" | "oem";
  /** OEM brand this source confirms, when kind === "oem". */
  oem?: string;
  /** Whether the adapter is wired to a live endpoint or is a placeholder. */
  status: "active" | "stub";
  fetch(): Promise<RawRecord[]>;
}

export type { RawRecord };
