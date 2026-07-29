import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { RequireRole } from "@/components/require-role";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/hr", label: "Overview", exact: true },
  { to: "/hr/pipeline", label: "Pipeline" },
  { to: "/hr/recruitment", label: "Recruitment" },
  { to: "/hr/workspace", label: "Clients, Contracts & Projects" },
  { to: "/hr/projects", label: "Work & Projects" },
  { to: "/hr/tasks", label: "Tasks" },
  { to: "/hr/calendar", label: "Calendar" },
  { to: "/hr/reports", label: "Reports to CEO" },
];

export const Route = createFileRoute("/_authenticated/hr")({
  head: () => ({
    meta: [{ title: "Human Resources — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: HrLayout,
});

function HrLayout() {
  const location = useLocation();
  return (
    <RequireRole
      roles={["hr"]}
      message="The HR workspace is restricted to the HR team, CEO and System Administrator."
    >
      <div>
        <PageHeader
          title="Human Resources"
          description="Delivery of AMSOL's own HR service lines — salary surveys, recruitment, training, HRMS licensing and outsourced HR management — for our clients."
        />
        <div className="border-b mb-4 flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const active = t.exact
              ? location.pathname === t.to
              : location.pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
        <Outlet />
      </div>
    </RequireRole>
  );
}
