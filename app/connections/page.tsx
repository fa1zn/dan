import { KeyRound, Check } from "lucide-react";
import { connectionStatus, getCallProvider, CALL_PROVIDERS, getConnection } from "@/lib/connections";
import { ConnectionsClient } from "@/components/connections-client";
import { HubspotConnect } from "@/components/hubspot-connect";
import { setCallProviderAction } from "./actions";
import { cn } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default function ConnectionsPage() {
  const providers = connectionStatus();
  const active = getCallProvider();
  const connectedOf = (id: string) => providers.find((p) => p.id === id)?.connected ?? false;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <KeyRound className="h-6 w-6 text-brand" /> Connections
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your own provider accounts to run the sales motion. Keys are encrypted at rest and used only to place
          your calls, texts, and gifts. Nothing sends until you arm the motion.
        </p>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Call provider</h2>
          <p className="text-xs text-muted-foreground">Choose which voice provider Dan places the call through.</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {CALL_PROVIDERS.map((p) => {
            const isActive = active === p.id;
            return (
              <form key={p.id} action={setCallProviderAction}>
                <input type="hidden" name="provider" value={p.id} />
                <button
                  type="submit"
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    isActive ? "border-brand bg-brand/5 ring-1 ring-brand" : "hover:bg-accent"
                  )}
                >
                  <span className="font-medium">{p.name}</span>
                  {isActive ? (
                    <Check className="h-4 w-4 text-brand" />
                  ) : connectedOf(p.id) ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  ) : null}
                </button>
              </form>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Your CRM</h2>
          <p className="text-xs text-muted-foreground">
            Bring your HubSpot pipeline in. Dan matches your accounts to our rooftops and shows your deal stage and owner
            right on the record — so your book and ours are one view.
          </p>
        </div>
        <HubspotConnect connected={!!getConnection("HUBSPOT_TOKEN")} />
      </section>

      <ConnectionsClient providers={providers} activeCallProvider={active} />
    </div>
  );
}
