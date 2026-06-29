import { CONFIG } from "../config";
import { osmSource } from "./osm";
import { toyotaSource } from "./oem/toyota";
import { hondaSource } from "./oem/honda";
import { fordSource } from "./oem/ford";
import { oemStubSources } from "./oem/stubs";
import type { Source } from "./types";

/**
 * The full source registry. Order matters only for logging; dedupe later prefers
 * OEM-sourced fields regardless of ingest order. Add new OEM adapters here (and
 * drop the matching stub) to extend coverage.
 */
export const ALL_SOURCES: Source[] = [
  osmSource, // backbone
  toyotaSource,
  hondaSource,
  fordSource,
  ...oemStubSources,
];

/** Sources actually run by `ingest`, honouring ENABLED_SOURCES and skipping stubs. */
export function enabledSources(): Source[] {
  const filter = CONFIG.enabledSources;
  return ALL_SOURCES.filter((s) => {
    if (s.status === "stub") return false; // stubs are catalogue-only
    if (!filter) return true;
    return filter.includes(s.name) || (s.oem ? filter.includes(s.oem) : false);
  });
}

export type { Source };
