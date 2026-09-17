import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const TABS = [
  { to: "/reports", label: "Overview", exact: true },
  { to: "/reports/departments", label: "Departments", match: "/reports/departments" },
];

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — AIMS" }, { name: "robots", content: "noindex" }] }),
  component: ReportsLayout,
});

function ReportsLayout() {
  const location = useLocation();
  const { isCeo } = useAuth();
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
        {TABS.map((t) => {
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
