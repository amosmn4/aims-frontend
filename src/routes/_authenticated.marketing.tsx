import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { RequireRole } from "@/components/require-role";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/marketing", label: "Overview", exact: true },
  { to: "/marketing/pipeline", label: "Pipeline" },
  { to: "/marketing/leads", label: "Leads" },
  { to: "/marketing/campaigns", label: "Campaigns" },
  { to: "/marketing/website-analytics", label: "Website Analytics" },
  { to: "/marketing/blog", label: "Blog" },
  { to: "/marketing/workspace", label: "Clients, Contracts & Projects" },
  { to: "/marketing/tasks", label: "Tasks" },
  { to: "/marketing/calendar", label: "Calendar" },
  { to: "/marketing/reports", label: "Reports to CEO" },
];

export const Route = createFileRoute("/_authenticated/marketing")({
  head: () => ({
    meta: [{ title: "Marketing — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: MarketingLayout,
});

function MarketingLayout() {
  const location = useLocation();
  return (
    <RequireRole
      roles={["marketing"]}
      message="The Marketing workspace is restricted to the Marketing team, CEO and System Administrator."
    >
      <div>
        <PageHeader
          title="Marketing"
          description="Leads, follow-ups and website performance for Amsol."
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
