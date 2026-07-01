import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form action="/api/login" method="POST" className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand font-bold text-brand-foreground">D</span>
          <div>
            <div className="text-sm font-semibold">Dan — Pam&rsquo;s sales guy</div>
            <div className="text-xs text-muted-foreground">Internal sales tool · authorized access only</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-brand" /> Contains licensed contact data — do not share or export.
        </div>
        <input
          type="password"
          name="password"
          placeholder="Team password"
          autoFocus
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
        />
        {e ? <p className="text-xs text-destructive">Incorrect password.</p> : null}
        <button type="submit" className="w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90">
          Sign in
        </button>
      </form>
    </div>
  );
}
