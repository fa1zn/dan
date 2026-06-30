import { IntegrationCard } from "@/components/integration-card";
import { INTEGRATIONS, statusOf } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export default function IntegrationsPage() {
  const items = INTEGRATIONS.map((i) => ({ integration: i, status: statusOf(i, process.env) }));
  const connected = items.filter((i) => i.status === "connected").length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Dan works great as-is — {connected} connected today, nothing else needed. Hook up your CRM or extra data
          whenever you want. Everything keeps working without them.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map(({ integration, status }) => (
          <IntegrationCard key={integration.id} integration={integration} status={status} />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">Your connections stay private to you.</p>
    </div>
  );
}
