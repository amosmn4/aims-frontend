import { createFileRoute } from "@tanstack/react-router";
import { RequireRole } from "@/components/require-role";

export const Route = createFileRoute("/_authenticated/reports/departments/hr")({
  component: () => (
    <RequireRole
      roles={["hr"]}
      message="The HR report is restricted to the HR team, CEO and System Administrator."
    >
      <ReportStub name="Human Resources" />
    </RequireRole>
  ),
});

function ReportStub({ name }: { name: string }) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="text-sm font-semibold">{name} report</div>
      <p className="text-xs text-muted-foreground mt-1">
        Reports from the {name} module will appear here once the module goes live.
      </p>
    </div>
  );
}
