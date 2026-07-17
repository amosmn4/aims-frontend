import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/reports/projects")({
  component: () => (
    <div className="rounded-lg border bg-card p-6">
      <div className="text-sm font-semibold">Project reports</div>
      <p className="text-xs text-muted-foreground mt-1">
        Submissions from active projects will appear here as tabs per project once the Projects
        module goes live.
      </p>
    </div>
  ),
});
