"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Ride-along instrumentation (client side).
 *
 * Renders nothing and attaches no listeners unless (1) the global flag is on (passed as
 * `enabled` from the server) and (2) the rep has seen the disclosure and opted in. It captures
 * behavior, never content: element descriptors not text, field names not what was typed, a
 * tel: tap logs "tel" not the number. Buffered and sent with sendBeacon so it never blocks the
 * rep, and flushed when the tab is hidden or unloaded so a real session isn't lost.
 */

type Ev = { type: string; screen: string; detail?: Record<string, string | number>; ts: number };

const LS_REP = "dan_rep_id";
const LS_DECISION = "dan_tel_decision"; // "in" | "out"
const LS_NOTICE = "dan_tel_notice";

function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return "r-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

/** Structural descriptor of a tapped element — no innerText, no aria-label (could hold a name). */
function describe(el: Element | null): string {
  let node: Element | null = el;
  // Walk up to the nearest actionable ancestor so we log "the call button", not a stray <span>.
  for (let i = 0; node && i < 4; i++) {
    if (
      node.hasAttribute("data-ev") ||
      node.tagName === "BUTTON" ||
      node.tagName === "A" ||
      node.getAttribute("role") === "button"
    )
      break;
    node = node.parentElement;
  }
  if (!node) return "unknown";
  const ev = node.getAttribute("data-ev");
  if (ev) return ev.slice(0, 60);
  const parts = [node.tagName.toLowerCase()];
  const testid = node.getAttribute("data-testid");
  if (testid) parts.push(`@${testid}`);
  else if (node.id) parts.push(`#${node.id}`);
  const role = node.getAttribute("role");
  if (role) parts.push(`[${role}]`);
  const cls = (node.getAttribute("class") || "").split(/\s+/).filter(Boolean)[0];
  if (cls) parts.push(`.${cls}`);
  return parts.join("").slice(0, 120);
}

/** For an anchor, the destination category only: the scheme (tel/sms/mailto) or the host. */
function externalTarget(a: HTMLAnchorElement): string | null {
  const href = a.getAttribute("href") || "";
  const m = href.match(/^(tel|sms|mailto):/i);
  if (m) return m[1].toLowerCase(); // NOT the number/address
  try {
    const u = new URL(href, window.location.href);
    if (u.origin !== window.location.origin && /^https?:/.test(u.protocol)) return u.host;
  } catch {
    /* ignore */
  }
  return null;
}

export function Telemetry({ enabled, noticeVersion }: { enabled: boolean; noticeVersion: number }) {
  const pathname = usePathname();
  const [decision, setDecision] = useState<"in" | "out" | "undecided" | "loading">("loading");
  const [label, setLabel] = useState("");

  const repId = useRef<string>("");
  const sessionId = useRef<string>("");
  const buffer = useRef<Ev[]>([]);
  const lastInteraction = useRef<number>(0);
  const screenT0 = useRef<number>(0);
  const firstTap = useRef<boolean>(false);
  const maxScroll = useRef<number>(0);
  const sessionStart = useRef<number>(0);
  const prevPath = useRef<string>("");

  const onLogin = pathname?.startsWith("/login");
  const active = enabled && decision === "in" && !onLogin;

  // Decide what to show, once, on mount.
  useEffect(() => {
    if (!enabled) {
      setDecision("out");
      return;
    }
    repId.current = localStorage.getItem(LS_REP) || "";
    const d = localStorage.getItem(LS_DECISION);
    const n = Number(localStorage.getItem(LS_NOTICE) || "0");
    if ((d === "in" || d === "out") && n === noticeVersion) setDecision(d);
    else setDecision("undecided"); // never decided, or the disclosure changed → ask again
  }, [enabled, noticeVersion]);

  const flush = useCallback((useBeacon: boolean) => {
    if (!buffer.current.length || !repId.current) return;
    const payload = JSON.stringify({
      repId: repId.current,
      sessionId: sessionId.current,
      events: buffer.current.splice(0, buffer.current.length),
    });
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon("/api/telemetry", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/telemetry", { method: "POST", body: payload, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
    }
  }, []);

  const push = useCallback((type: string, detail?: Record<string, string | number>) => {
    buffer.current.push({ type, screen: prevPath.current || pathname || "/", detail, ts: Date.now() });
    if (buffer.current.length >= 40) flush(false);
  }, [flush, pathname]);

  // Attach listeners only while active.
  useEffect(() => {
    if (!active) return;
    if (!repId.current) repId.current = localStorage.getItem(LS_REP) || uuid();
    localStorage.setItem(LS_REP, repId.current);
    sessionId.current = uuid();
    const now = Date.now();
    sessionStart.current = now;
    lastInteraction.current = now;

    const onPointer = (e: Event) => {
      const t = Date.now();
      const hesitation = t - lastInteraction.current;
      lastInteraction.current = t;
      if (!firstTap.current) {
        firstTap.current = true;
        push("first_tap", { ms: t - screenT0.current });
      }
      const target = e.target as Element | null;
      push("tap", { element: describe(target), hesitation_ms: hesitation });
      const a = target?.closest?.("a") as HTMLAnchorElement | null;
      if (a) {
        const dest = externalTarget(a);
        if (dest) push("external_nav", { target: dest });
      }
    };
    const onChange = (e: Event) => {
      const el = e.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA")) return;
      const field = (el.getAttribute("name") || el.id || el.getAttribute("role") || "field").slice(0, 60);
      push("type", { field, chars: (el.value || "").length }); // count only, never the value
    };
    const onScroll = () => {
      const h = document.documentElement;
      const pct = Math.min(100, Math.round(((h.scrollTop + window.innerHeight) / (h.scrollHeight || 1)) * 100));
      if (pct > maxScroll.current) maxScroll.current = pct;
      lastInteraction.current = Date.now();
    };
    const onVisibility = () => {
      push("visibility", { state: document.visibilityState });
      if (document.visibilityState === "hidden") {
        if (maxScroll.current > 0) push("scroll_depth", { pct: maxScroll.current });
        flush(true);
      }
    };
    const onHide = () => {
      if (maxScroll.current > 0) push("scroll_depth", { pct: maxScroll.current });
      push("session_end", { duration_ms: Date.now() - sessionStart.current });
      flush(true);
    };

    document.addEventListener("pointerdown", onPointer, { capture: true });
    document.addEventListener("change", onChange, { capture: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    const interval = window.setInterval(() => flush(false), 15000);

    return () => {
      document.removeEventListener("pointerdown", onPointer, { capture: true } as EventListenerOptions);
      document.removeEventListener("change", onChange, { capture: true } as EventListenerOptions);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      window.clearInterval(interval);
      flush(true);
    };
  }, [active, flush, push]);

  // Screen changes: log app_open + nav, and reset per-screen counters.
  useEffect(() => {
    if (!active || !pathname) return;
    if (maxScroll.current > 0 && prevPath.current && prevPath.current !== pathname) {
      push("scroll_depth", { pct: maxScroll.current });
    }
    const from = prevPath.current;
    push("app_open");
    if (from && from !== pathname) push("nav", { from, to: pathname });
    prevPath.current = pathname;
    screenT0.current = Date.now();
    firstTap.current = false;
    maxScroll.current = 0;
  }, [active, pathname, push]);

  const accept = async () => {
    repId.current = localStorage.getItem(LS_REP) || uuid();
    localStorage.setItem(LS_REP, repId.current);
    localStorage.setItem(LS_DECISION, "in");
    localStorage.setItem(LS_NOTICE, String(noticeVersion));
    setDecision("in");
    try {
      await fetch("/api/telemetry/optin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repId: repId.current, decision: true, label }),
      });
    } catch {
      /* ignore */
    }
  };
  const decline = async () => {
    repId.current = localStorage.getItem(LS_REP) || uuid();
    localStorage.setItem(LS_REP, repId.current);
    localStorage.setItem(LS_DECISION, "out");
    localStorage.setItem(LS_NOTICE, String(noticeVersion));
    setDecision("out");
    try {
      await fetch("/api/telemetry/optin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repId: repId.current, decision: false }),
      });
    } catch {
      /* ignore */
    }
  };

  if (!enabled || onLogin || decision !== "undecided") return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-3">
      <div className="w-full max-w-lg rounded-xl border bg-card p-4 shadow-lg">
        <div className="text-sm font-semibold">Help us make Dan better?</div>
        <p className="mt-1 text-xs text-muted-foreground">
          If you turn this on, Dan records <span className="font-medium">how you use the app</span> during
          your session so we can fix what slows you down. We log which screens you open, which buttons you
          tap and how long you hesitate, how far you scroll, when you switch to another app, and how many
          characters you type in a field.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          We do <span className="font-medium">not</span> log what you type, any message or account details
          beyond an id, or phone numbers you dial. Kept 30 days, then deleted. You can say no and Dan works
          exactly the same.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Your initials (optional)"
            className="w-32 rounded-md border bg-background px-2 py-1.5 text-xs outline-none focus:border-foreground"
          />
          <div className="ml-auto flex gap-2">
            <button onClick={decline} className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">
              No thanks
            </button>
            <button onClick={accept} className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground hover:bg-brand/90">
              Turn on for my session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
