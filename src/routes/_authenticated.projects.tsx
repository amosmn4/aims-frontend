import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { cn } from "@/lib/utils";

const TABS = [
  {
    to: "/projects",
    label: "All Projects",
    title: "All Projects",
    description:
      "Every project across every department, from won tenders and new client engagements through delivery.",
  },
  {
    to: "/projects/mine",
    label: "My Tasks",
    title: "My Tasks",
    description: "Every task assigned to you, across every project you're on.",
  },
  {
    to: "/projects/department",
    label: "Department Board",
    title: "Department Board",
    description:
      "A single department's task board — pick a department to see everything assigned to it.",
  },
];
const TAB_PATHS = TABS.map((t) => t.to);

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [{ title: "Projects & Tasks — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: ProjectsLayout,
});

function ProjectsLayout() {
  const location = useLocation();
  // Exact membership against the 3 known tab paths — not a regex guessing what "looks like a
  // project id". The old regex (`/^\/projects\/[^/]+$/`) also matched "/projects/mine" and
  // "/projects/department" themselves, which silently hid the tab bar/header on both of those
  // pages instead of only on a real `/projects/$projectId`.
  const isDetail = !TAB_PATHS.includes(location.pathname);
  // Each tab gets its own title/description instead of one static "Projects & Tasks" caption for
  // all three — so the page you're looking at is identifiable at a glance, not just via the
  // underlined tab.
  const activeTab = TABS.find((t) => location.pathname === t.to) ?? TABS[0];

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
      {!isDetail && <PageHeader title={activeTab.title} description={activeTab.description} />}
      {!isDetail && (
        <div className="border-b mb-4 flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const active = location.pathname === t.to;
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
