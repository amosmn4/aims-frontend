import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FolderKanban, LayoutList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/projects")({
  head: () => ({ meta: [{ title: "Project reports — AIMS" }] }),
  component: ProjectReports,
});

function ProjectReports() {
  return (
    <section className="rounded-lg border bg-card p-6" aria-labelledby="project-reports-heading">
      <h2 id="project-reports-heading" className="text-sm font-semibold">
        Project reports
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Project reports aren't set up yet. Use each department's report, or the Projects list.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/reports/departments"
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:border-primary hover:text-primary"
        >
          <LayoutList className="h-4 w-4" aria-hidden="true" /> Department reports
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:border-primary hover:text-primary"
        >
          <FolderKanban className="h-4 w-4" aria-hidden="true" /> Projects
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
