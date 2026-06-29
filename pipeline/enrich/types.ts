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

// Registry of enabled enrichers. Phase 1 shipped none (free tier only); Phase 3
// adds a free website-scrape enricher. Paid providers (Clay/Apollo/ZoomInfo) can
// be added here later without touching the rest of the pipeline.
import { websiteContactEnricher } from "./website";

export const ENABLED_ENRICHERS: Enricher[] = [websiteContactEnricher];
