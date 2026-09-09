import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { RequireRole } from "@/components/require-role";
import { cn } from "@/lib/utils";

// All Water Project pages are real routes (deep-linkable, bookmarkable), but presented as
// in-page tabs on a single "Water Project" section rather than exposed as a nav dropdown — the
// global nav item is a flat link (see app-shell.tsx). Overview (this layout's index route) is
// the current dashboard; the rest are the pages that already existed.
const TABS = [
  { to: "/water", label: "Overview" },
  { to: "/water/zones", label: "Zones" },
  { to: "/water/meters", label: "Meters Registry" },
  { to: "/water/customers", label: "Customers" },
  { to: "/water/readings", label: "Bulk & Main Readings" },
  { to: "/water/upload", label: "Upload & Analytics" },
  { to: "/water/reports", label: "Reports" },
  { to: "/water/ai", label: "AI Insights" },
] as const;

// Not tied to any of the six core departments — access is the "water" role, assigned per user in
// Admin > Users & Roles, on top of the usual admin/CEO bypass.
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
      message="The Water Project is restricted to System Administrator, CEO, and users granted the Water Project role."
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
