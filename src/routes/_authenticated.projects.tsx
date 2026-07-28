import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/projects", label: "All Projects", exact: true },
  { to: "/projects/mine", label: "My Tasks" },
  { to: "/projects/department", label: "Department Board" },
];

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [{ title: "Projects & Tasks — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: ProjectsLayout,
});

function ProjectsLayout() {
  const location = useLocation();
  const isDetail =
    /^\/projects\/[^/]+$/.test(location.pathname) && location.pathname !== "/projects";

  return (
    <div>
      {!isDetail && (
        <Link
          to="/dashboard"
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Dashboard
        </Link>
      )}
      <PageHeader
        title="Projects & Tasks"
        description="Track projects from won tenders and new client engagements through delivery."
      />
      {!isDetail && (
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
      )}
      <Outlet />
    </div>
  );
}
