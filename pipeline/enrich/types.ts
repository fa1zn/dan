import type { Contact, MasterRecord } from "../../lib/types";

/**
 * Enricher is the extension point for contact/firmographic enrichment (Phase 3+).
 * Phase 1 ships NO paid providers — contacts[] stays empty and this interface is
 * here only so a provider (Clay, Apollo, ZoomInfo, …) can be dropped in later
 * without touching the rest of the pipeline.
 */
export interface Enricher {
  name: string;
  /** Return additional contacts for a dealership (called by a future `enrich` step). */
  enrich(record: MasterRecord): Promise<Contact[]>;
}

/** Registry of enabled enrichers. Intentionally empty in Phase 1 (free tier only). */
export const ENABLED_ENRICHERS: Enricher[] = [];
