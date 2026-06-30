import Link from "next/link";
import { Building2, Plug, KeyRound, Inbox, Rocket } from "lucide-react";
import { NavLink, ThemeToggle, MobileNav } from "./chrome";
import { repEnv } from "@/lib/connections";
import { autopilotActive } from "@/lib/meta";

function StatusBar() {
  const env = repEnv();
  const live = env.SEQUENCE_APPLY === "1";
  const testTo = env.SEQ_TEST_TO;
  const autopilot = autopilotActive();
  const manualCalls = live && !testTo && env.SEQ_AUTONOMOUS_CALLS !== "1";
  return (
    <div className="hidden items-center gap-3 text-xs md:flex">
      {manualCalls && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
          calls: click-to-call
        </span>
      )}
      <span
        className={
          live
            ? "inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 font-medium text-brand"
            : "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-muted-foreground"
        }
      >
        <span className={live ? "h-1.5 w-1.5 rounded-full bg-brand" : "h-1.5 w-1.5 rounded-full bg-muted-foreground"} />
        {live ? "Live" : "Dry run"}
      </span>
      {testTo && (
        <span className="text-muted-foreground">
          test → <span className="font-medium text-foreground">{testTo}</span>
        </span>
      )}
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span className={autopilot ? "h-1.5 w-1.5 rounded-full bg-emerald-500" : "h-1.5 w-1.5 rounded-full bg-muted-foreground"} />
        Autopilot {autopilot ? "on" : "off"}
      </span>
    </div>
  );
}

/** Persistent app chrome: branded sidebar + top bar. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
        <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-brand-foreground font-bold tracking-tight">
            D
          </span>
          <span className="leading-tight">
            <span className="block font-serif text-base font-medium tracking-tight">Dan</span>
            <span className="block text-xs text-muted-foreground">Pam&rsquo;s sales guy</span>
          </span>
        </Link>
        <nav className="flex flex-col gap-1 px-3 py-2">
          <NavLink href="/today" icon={<Inbox className="h-4 w-4" />}>
            Today
          </NavLink>
          <NavLink href="/sequences" icon={<Rocket className="h-4 w-4" />}>
            Prospect
          </NavLink>
          <NavLink href="/accounts" icon={<Building2 className="h-4 w-4" />}>
            Book
          </NavLink>

          <div className="mt-5 px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
            Setup
          </div>
          <NavLink href="/connections" icon={<KeyRound className="h-4 w-4" />}>
            Connections
          </NavLink>
          <NavLink href="/integrations" icon={<Plug className="h-4 w-4" />}>
            Integrations
          </NavLink>
        </nav>
        <div className="mt-auto px-5 py-4 text-xs text-muted-foreground">
          Book of business
          <br />
          North American franchise rooftops
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-card/60 px-5 backdrop-blur">
          <div className="text-sm text-muted-foreground md:hidden">Dan</div>
          <div className="hidden text-sm text-muted-foreground lg:block">
            System of record · US + Canada franchise dealerships
          </div>
          <div className="flex items-center gap-4">
            <StatusBar />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-5 pb-24 md:p-8 md:pb-8">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
