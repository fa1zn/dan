"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "./ui";

/**
 * Wraps a value so hovering it reveals exactly where the value came from and when.
 * Trust comes from "here's the source" not "trust us". The caller passes only a source
 * it can actually defend (Google-live, on-file as-of a date, estimated), so the tooltip
 * never invents provenance.
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
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
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
