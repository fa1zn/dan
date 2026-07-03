"use client";

import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui";

/**
 * Wraps a value so it reveals exactly where the value came from and when. Trust comes
 * from "here's the source" not "trust us". On desktop the source shows on hover; on
 * touch (no hover) it shows on tap. If the value is also a link, the first tap reveals
 * the source (navigation blocked) and a second tap follows the link. The caller passes
 * only a source it can actually defend, so the tooltip never invents provenance.
 */
export function Provenance({
  source,
  when,
  detail,
  href,
  children,
}: {
  source: string; // where this specific value came from
  when?: string; // "checked live" | "as of Jun 30, 2026"
  detail?: string; // optional extra line, e.g. the exact marker matched on a page
  href?: string | null; // optional verify link
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          aria-label={`Source: ${source}`}
          className="cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
          onClick={(e) => {
            // Touch devices have no hover. First tap reveals the source (and blocks a
            // link so the rep always sees provenance); a second tap follows the link.
            if (!open) {
              e.preventDefault();
              e.stopPropagation();
              setOpen(true);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen((o) => !o);
            }
          }}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="text-xs">
          <span className="text-muted-foreground">Source:</span> <span className="font-medium">{source}</span>
          {when ? <span className="text-muted-foreground"> · {when}</span> : null}
        </div>
        {detail ? <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div> : null}
        {href ? <div className="mt-0.5 text-xs text-muted-foreground">Click the source tag to verify</div> : null}
      </TooltipContent>
    </Tooltip>
  );
}
