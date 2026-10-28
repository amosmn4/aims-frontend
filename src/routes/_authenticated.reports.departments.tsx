import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useReportLinks } from "@/features/reports/report-links";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reports/departments")({
  component: DepartmentReportsLayout,
});

function DepartmentReportsLayout() {
  const location = useLocation();
  const { departments } = useReportLinks();
  const isBase = location.pathname.replace(/\/$/, "") === "/reports/departments";

  return (
    <div>
      {departments.length > 0 && (
        <nav
          aria-label="Department reports"
          className="mb-3 flex w-fit max-w-full flex-wrap gap-1 rounded-md bg-secondary p-1"
        >
          {departments.map((d) => {
            const active = location.pathname.startsWith(d.to);
            return (
              <Link
                key={d.key}
                to={d.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded px-3 py-1.5 text-xs font-medium",
                  active
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {d.label}
              </Link>
            );
          })}
        </nav>
      )}
      {isBase ? (
        <section className="rounded-lg border bg-card p-4" aria-labelledby="choose-dept-heading">
          <h2 id="choose-dept-heading" className="text-sm font-semibold">
            Choose a department
          </h2>
          {departments.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              You can't view any department's report yet. Ask the CEO if you need one for your work.
            </p>
          ) : (
            <ul className="mt-3 divide-y">
              {departments.map((d) => {
                const Icon = d.icon;
                return (
                  <li key={d.key}>
                    <Link
                      to={d.to}
                      className="flex items-center gap-3 rounded px-1 py-2.5 hover:bg-secondary/50"
                    >
                      <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                      <span className="flex-1">
                        <span className="block text-sm font-medium">{d.label}</span>
                        <span className="block text-xs text-muted-foreground">{d.hint}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <Outlet />
      )}
    </div>
  );
}
