import { ExternalLink } from "lucide-react";

/**
 * Provenance label shown next to every data group: where Dan got it, with a link
 * to verify. Trust comes from "fetched from X [↗]", not "trust our database."
 */
export function SourceTag({ label, href }: { label: string; href?: string | null }) {
  const body = (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      Source: <span className="font-medium">{label}</span>
      {href ? <ExternalLink className="h-3 w-3" /> : null}
    </span>
  );
  if (!href) return body;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">
      {body}
    </a>
  );
}

/** Human label + verify-link for a contact's scrape source. */
export function contactSource(source: string | undefined, website: string | null): { label: string; href?: string | null } {
  switch (source) {
    case "staff-page":
      return { label: "Dealer staff page", href: website };
    case "website":
      return { label: "Dealer website", href: website };
    case "zoominfo":
      return { label: "ZoomInfo (verified)" };
    case "hubspot":
      return { label: "HubSpot" };
    default:
      return { label: source ?? "—", href: website };
  }
}

/** OpenStreetMap map link centred on the rooftop, for verifying identity/address. */
export function osmLink(lat: number | null, lng: number | null): string | undefined {
  if (lat == null || lng == null) return undefined;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=19/${lat}/${lng}`;
}

/** Human-readable label for an ingest source code (osm, oem:toyota, …). */
export function sourceLabel(code: string): string {
  if (code === "osm") return "OpenStreetMap";
  if (code === "google_places" || code === "google") return "Google Places";
  if (code === "website" || code === "staff-page") return "Dealer website";
  if (code === "zoominfo") return "ZoomInfo";
  if (code === "hubspot") return "HubSpot";
  if (code.startsWith("oem:")) {
    const brand = code.slice(4);
    return `${brand.charAt(0).toUpperCase()}${brand.slice(1)} dealer locator`;
  }
  return code;
}

/** Combined provenance summary for a whole record's `source` string. Honest: names every
 *  source that fed the record, and flags when the brand was never confirmed against an OEM. */
export function recordSourceSummary(source: string | null | undefined, brandConfirmed?: number): string {
  const parts = Array.from(new Set((source ?? "").split("+").filter(Boolean).map(sourceLabel)));
  const label = parts.length ? parts.join(" + ") : "Unknown";
  return brandConfirmed ? label : `${label} (brand unconfirmed)`;
}

/** "as of Jun 30, 2026" from a stored timestamp — the honest "when" for on-file data. */
export function asOf(iso: string | null | undefined): string {
  if (!iso) return "date unknown";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return "date unknown";
  return "as of " + d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
