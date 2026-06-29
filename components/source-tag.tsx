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
