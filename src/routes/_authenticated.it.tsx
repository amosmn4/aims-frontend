import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { RequireRole } from "@/components/require-role";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/it", label: "Overview", exact: true },
  { to: "/it/pipeline", label: "Pipeline" },
  { to: "/it/workspace", label: "Clients, Contracts & Projects" },
  { to: "/it/systems-sites", label: "Systems & Sites" },
  { to: "/it/tickets", label: "Tickets" },
  { to: "/it/hrms-clients", label: "HRMS Clients" },
  { to: "/it/tasks", label: "Tasks" },
  { to: "/it/calendar", label: "Calendar" },
  { to: "/it/reports", label: "Reports to CEO" },
];

export const Route = createFileRoute("/_authenticated/it")({
  head: () => ({
    meta: [{ title: "Information Technology — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: ItLayout,
});

function ItLayout() {
  const location = useLocation();
  return (
    <RequireRole
      roles={["it"]}
      message="The IT workspace is restricted to the IT team, CEO and System Administrator."
    >
      <div>
        <PageHeader
          title="Information Technology"
          description="Website & systems work runs through Projects — this is what IT maintains."
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
