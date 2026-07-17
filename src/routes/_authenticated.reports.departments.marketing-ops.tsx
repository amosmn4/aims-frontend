import { createFileRoute } from "@tanstack/react-router";
import { RequireRole } from "@/components/require-role";

export const Route = createFileRoute("/_authenticated/reports/departments/marketing-ops")({
  component: () => (
    <RequireRole
      roles={["marketing_ops"]}
      message="The Marketing & Operations report is restricted to the Marketing & Ops team, CEO and System Administrator."
    >
      <div className="rounded-lg border bg-card p-6">
        <div className="text-sm font-semibold">Marketing & Operations report</div>
        <p className="text-xs text-muted-foreground mt-1">
          Reports from the Marketing & Ops module will appear here once the module goes live.
        </p>
      </div>
    </RequireRole>
  ),
});
