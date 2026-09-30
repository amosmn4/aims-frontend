import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const TABS = [
  { to: "/reports", label: "Overview", exact: true },
  { to: "/reports/mine", label: "My report", match: "/reports/mine" },
  { to: "/reports/departments", label: "Departments", match: "/reports/departments" },
  { to: "/reports/projects", label: "Projects", match: "/reports/projects" },
  { to: "/reports/team", label: "My team", match: "/reports/team", headsOnly: true },
];

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — AIMS" }, { name: "robots", content: "noindex" }] }),
  component: ReportsLayout,
});

function ReportsLayout() {
  const location = useLocation();
  const { isCeo, isAdminOrCeo, hasRole } = useAuth();
  const tabs = TABS.filter((t) => !t.headsOnly || isAdminOrCeo || hasRole("department_head"));
  return (
    <div>
      <PageHeader
        title={isCeo ? "Reports & Analytics" : "Reports"}
        description={
          isCeo
            ? "Reports from every department and project, ready for your review."
            : "Department and project reports."
        }
      />
      <nav aria-label="Reports pages" className="border-b mb-4 flex gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const active = t.exact
            ? location.pathname === t.to
            : location.pathname.startsWith(t.match ?? t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              aria-current={active ? "page" : undefined}
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
      </nav>
      <Outlet />
    </div>
  );
}
