import Link from "next/link";
import { LayoutDashboard, Building2, KanbanSquare, PhoneCall, Plug } from "lucide-react";
import { NavLink, ThemeToggle } from "./chrome";

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
            <span className="block text-sm font-semibold tracking-tight">Dan</span>
            <span className="block text-xs text-muted-foreground">Pam&rsquo;s sales guy</span>
          </span>
        </Link>
        <nav className="flex flex-col gap-1 px-3 py-2">
          <NavLink href="/" icon={<LayoutDashboard className="h-4 w-4" />}>
            Overview
          </NavLink>
          <NavLink href="/worklist" icon={<PhoneCall className="h-4 w-4" />}>
            Call list
          </NavLink>
          <NavLink href="/accounts" icon={<Building2 className="h-4 w-4" />}>
            Accounts
          </NavLink>
          <NavLink href="/pipeline" icon={<KanbanSquare className="h-4 w-4" />}>
            Pipeline
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
          <div className="hidden text-sm text-muted-foreground md:block">
            System of record · US + Canada franchise dealerships
          </div>
          <ThemeToggle />
        </header>
        <main className="flex-1 p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
