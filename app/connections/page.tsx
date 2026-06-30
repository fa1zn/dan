import { KeyRound } from "lucide-react";
import { connectionStatus } from "@/lib/connections";
import { ConnectionsClient } from "@/components/connections-client";

export const dynamic = "force-dynamic";

export default function ConnectionsPage() {
  const providers = connectionStatus();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <KeyRound className="h-6 w-6 text-brand" /> Connections
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your own provider accounts to run the sales motion. Keys are encrypted at rest and used only to place
          your calls, texts, and gifts. Nothing sends until you arm the motion.
        </p>
      </div>
      <ConnectionsClient providers={providers} />
    </div>
  );
}
