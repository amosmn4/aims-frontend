import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const DEPTS = [
  { key: "finance", label: "Finance" },
  { key: "hr", label: "Human Resources" },
  { key: "it", label: "IT" },
  { key: "marketing", label: "Marketing" },
  { key: "tender", label: "Tender" },
];

export const Route = createFileRoute("/_authenticated/reports/departments")({
  component: DepartmentReportsLayout,
});

function DepartmentReportsLayout() {
  const location = useLocation();
  const isBase = location.pathname === "/reports/departments";
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1 bg-secondary p-1 rounded-md w-fit">
        {DEPTS.map((d) => {
          const to = `/reports/departments/${d.key}`;
          const active = location.pathname.startsWith(to);
          return (
            <Link
              key={d.key}
              to={to}
              className={cn(
                "px-3 py-1.5 rounded text-xs font-medium",
                active
                  ? "bg-card shadow-sm text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {d.label}
            </Link>
          );
        })}
      </div>
      {isBase ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Select a department above to view its reports.
        </div>
      ) : (
        <Outlet />
      )}
    </div>
  );
}
