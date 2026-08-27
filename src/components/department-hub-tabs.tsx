import { Link, useLocation } from "@tanstack/react-router";
import { useAuth, type DepartmentCode } from "@/lib/auth";
import { DOMAIN_ITEMS } from "@/lib/department-nav";
import { cn } from "@/lib/utils";

// CEO/admin get the hub on every department; HR-role staff get it as a pilot on HR only —
// everyone else keeps today's flat top-nav navigation (buildDepartmentNav) unchanged. Extending
// the pilot to another department later is a one-line addition here.
export function useShowDepartmentHub(code: DepartmentCode): boolean {
  const { isAdminOrCeo, hasRole } = useAuth();
  return isAdminOrCeo || (code === "hr" && hasRole("hr"));
}

// Same visual pattern as the Documents page's own department tab bar (border-b + underline),
// just Link-based instead of button-based since these tabs are real routes, not local filter
// state — the URL always reflects the active tab, so refresh/share/back-forward all keep working.
export function DepartmentHubTabs({ code }: { code: DepartmentCode }) {
  const location = useLocation();
  const base = `/${code}`;

  const tabs = [
    { to: base, label: "Overview" },
    ...DOMAIN_ITEMS[code],
    { to: `${base}/tasks`, label: "Tasks & Projects" },
    { to: `${base}/workspace`, label: "Clients & Contracts" },
    { to: `${base}/documents`, label: "Documents" },
    { to: `${base}/reports`, label: "Reports" },
  ];

  const isActive = (to: string) =>
    to === base
      ? location.pathname === base
      : location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <div className="border-b flex gap-1 overflow-x-auto mb-4">
      {tabs.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          className={cn(
            "px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap",
            isActive(tab.to)
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
