import {
  Home,
  ListChecks,
  Building2,
  FolderKanban,
  Inbox,
  Briefcase,
  BarChart3,
} from "lucide-react";
import type { NavChild, NavItem } from "@/components/app-shell";
import type { DepartmentCode } from "@/lib/auth";

export const DEPARTMENT_NAMES: Record<DepartmentCode, string> = {
  finance: "Finance",
  hr: "HR",
  it: "IT",
  marketing: "Marketing",
  tender: "Tender",
  operations: "Operations",
};

export const DEPARTMENT_CODES = Object.keys(DEPARTMENT_NAMES) as DepartmentCode[];

// Each department's own pages, shown first in its "<Department> work" menu.
export const DOMAIN_ITEMS: Record<DepartmentCode, NavChild[]> = {
  finance: [
    { to: "/finance/invoices", label: "Invoices & billing" },
    { to: "/finance/expenses", label: "Expenses" },
    { to: "/finance/debtors", label: "Debtors" },
    { to: "/finance/revenue", label: "Revenue & margin" },
    { to: "/finance/budgets", label: "Budgets" },
    { to: "/finance/payroll-compliance", label: "Payroll compliance" },
    { to: "/finance/upload", label: "Upload from Excel" },
  ],
  hr: [{ to: "/hr/recruitment", label: "Recruitment" }],
  it: [
    { to: "/it/systems-sites", label: "Systems & sites" },
    { to: "/it/tickets", label: "Tickets" },
    { to: "/it/hrms-clients", label: "HRMS clients" },
    { to: "/it/inventory", label: "Inventory" },
  ],
  marketing: [
    { to: "/marketing/leads", label: "Leads" },
    { to: "/marketing/campaigns", label: "Campaigns" },
    { to: "/marketing/website-analytics", label: "Website analytics" },
    { to: "/marketing/blog", label: "Blog" },
  ],
  tender: [{ to: "/tender/bid-pipeline", label: "Tenders" }],
  operations: [],
};

export const CLIENT_REQUESTS_PATH: Record<DepartmentCode, string> = {
  finance: "/finance/pipeline",
  hr: "/hr/pipeline",
  it: "/it/pipeline",
  marketing: "/marketing/pipeline",
  tender: "/tender/requests",
  operations: "/operations/requests",
};

/** Same seven items, same order, for every department. */
export function buildDepartmentNav(code: DepartmentCode, hasWaterAccess = false): NavItem[] {
  const base = `/${code}`;
  const own = DOMAIN_ITEMS[code];
  const projects = code === "hr" ? "/hr/projects" : "/projects";
  const requests = CLIENT_REQUESTS_PATH[code];
  const workChildren: NavChild[] = [
    ...own,
    { to: `${base}/tasks`, label: "Tasks", divider: own.length > 0 },
    { to: `${base}/calendar`, label: "Calendar" },
    { to: `${base}/shared-projects`, label: "Shared with me" },
    { to: `${base}/documents`, label: "Documents" },
    ...(hasWaterAccess ? [{ to: "/water", label: "Water Project", divider: true }] : []),
  ];

  return [
    { to: base, label: "Home", icon: Home, exact: true },
    { to: "/projects/mine", label: "My tasks", icon: ListChecks, match: ["/projects/mine"] },
    {
      to: workChildren[0].to,
      label: `${DEPARTMENT_NAMES[code]} work`,
      icon: Building2,
      // The department prefix catches its other pages; longer matches below win.
      match: [base, "/calendar", "/documents", ...(hasWaterAccess ? ["/water"] : [])],
      children: workChildren,
    },
    {
      to: projects,
      label: "Projects",
      icon: FolderKanban,
      match: [
        projects,
        "/projects",
        "/pipeline/projects",
        ...(code === "tender" ? [] : ["/tender"]),
      ],
    },
    {
      to: requests,
      label: "Client requests",
      icon: Inbox,
      match: [requests, "/requests", "/pipeline/engagements", "/engagements"],
    },
    {
      to: `${base}/workspace`,
      label: "Clients & contracts",
      icon: Briefcase,
      match: [`${base}/workspace`, "/clients", "/departments"],
    },
    {
      to: `${base}/reports`,
      label: "Reports",
      icon: BarChart3,
      match: [`${base}/reports`, "/department-reports", "/reports"],
    },
  ];
}

/** Water Project staff with no other department. */
export function buildWaterNav(): NavItem[] {
  return [
    { to: "/water", label: "Home", icon: Home, match: ["/water"] },
    { to: "/projects/mine", label: "My tasks", icon: ListChecks, match: ["/projects/mine"] },
  ];
}

/** Signed-in people who have not been given a department yet. */
export function buildSetupNav(): NavItem[] {
  return [
    { to: "/departments", label: "Home", icon: Home, match: ["/departments"] },
    { to: "/projects/mine", label: "My tasks", icon: ListChecks, match: ["/projects/mine"] },
  ];
}
