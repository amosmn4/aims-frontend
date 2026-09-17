import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { RequireRole } from "@/components/require-role";
import { cn } from "@/lib/utils";

// Each Water Project page is a real route, shown as in-page tabs under one nav link.
const TABS = [
  { to: "/water", label: "Overview" },
  { to: "/water/zones", label: "Zones" },
  { to: "/water/meters", label: "Meters Registry" },
  { to: "/water/customers", label: "Customers" },
  { to: "/water/readings", label: "Bulk & Main Readings" },
  { to: "/water/upload", label: "Upload usage file" },
  { to: "/water/reports", label: "Reports" },
  { to: "/water/ai", label: "AI Insights" },
] as const;

// Access is the "water" role, plus the CEO.
export const Route = createFileRoute("/_authenticated/water")({
  head: () => ({
    meta: [{ title: "Water Project — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: WaterLayout,
});

function WaterLayout() {
  const location = useLocation();

  return (
    <RequireRole
      roles={["water"]}
      message="The Water Project is restricted to the CEO and users granted the Water Project role."
    >
      <div className="space-y-4">
        <div className="border-b overflow-x-auto">
          <nav className="flex gap-1 min-w-max">
            {TABS.map((tab) => {
              const active =
                tab.to === "/water"
                  ? location.pathname === "/water"
                  : location.pathname === tab.to || location.pathname.startsWith(`${tab.to}/`);
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={cn(
                    "px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30",
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <Outlet />
      </div>
    </RequireRole>
  );
}
