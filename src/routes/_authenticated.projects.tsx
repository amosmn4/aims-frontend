import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { ArrowLeft, Droplets, FolderArchive, Laptop2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth, homeRouteFor, departmentScopeFor } from "@/lib/auth";

const PAGES = [
  {
    to: "/projects",
    label: "All projects",
    title: "Projects",
    description:
      "Every project you can see, from won tenders and client requests through delivery.",
  },
  {
    to: "/projects/mine",
    label: "My tasks",
    title: "My tasks",
    description:
      "Every task assigned to you, across all your projects. Select a task to update it.",
  },
  {
    to: "/projects/department",
    label: "Department tasks",
    title: "Department tasks",
    description: "Pick a department to see every task assigned to it.",
  },
];
const PAGE_PATHS = PAGES.map((p) => p.to);

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [{ title: "Projects — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: ProjectsLayout,
});

function ProjectsLayout() {
  const location = useLocation();
  const { roles, isCeo } = useAuth();
  const isDetail = !PAGE_PATHS.includes(location.pathname);
  const page = PAGES.find((p) => location.pathname === p.to) ?? PAGES[0];
  const onMyTasks = page.to === "/projects/mine";
  // People in one department already have these pages in their own menu.
  const showTabs = !isDetail && !onMyTasks && !departmentScopeFor(roles);

  if (isCeo && !onMyTasks) {
    return (
      <div>
        {location.pathname === "/projects" && (
          <PageHeader
            title="Projects"
            description="Every project across the business, grouped by department."
            actions={
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/water">
                    <Droplets className="h-4 w-4 mr-1" /> Water Project
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/it/inventory">
                    <Laptop2 className="h-4 w-4 mr-1" /> Inventory
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/documents">
                    <FolderArchive className="h-4 w-4 mr-1" /> Documents
                  </Link>
                </Button>
              </div>
            }
          />
        )}
        <Outlet />
      </div>
    );
  }

  if (isDetail) return <Outlet />;

  return (
    <div>
      <Link
        to={homeRouteFor(roles)}
        className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" aria-hidden="true" /> Back to home
      </Link>
      <PageHeader title={page.title} description={page.description} />
      {showTabs && (
        <nav aria-label="Projects pages" className="border-b mb-4 flex gap-1 overflow-x-auto">
          {PAGES.map((p) => {
            const active = location.pathname === p.to;
            return (
              <Link
                key={p.to}
                to={p.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </Link>
            );
          })}
        </nav>
      )}
      <Outlet />
    </div>
  );
}
