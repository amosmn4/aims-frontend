import { Home, ListChecks, Building2, FolderKanban, BarChart3 } from "lucide-react";
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

/** The Reports menu: the department's report, your own, projects, the team's, the charts. */
function reportsChildren(code: DepartmentCode): NavChild[] {
  return [
    { to: `/reports/departments/${code}`, label: "Department team report" },
    { to: "/reports/projects", label: "Project reports" },
  ];
}

// Company projects someone is on sit under Projects, one click away; more than this adds "All".
const MAX_COMPANY_PROJECTS_IN_MENU = 5;

/** Projects: the department's own, then company projects, then each one this person is on. */
function projectsChildren(
  code: DepartmentCode,
  departmentPath: string,
  companyProjects: { id: string; name: string }[],
): NavChild[] {
  return [
    { to: departmentPath, label: `${DEPARTMENT_NAMES[code]} projects`, exact: true },
    { to: "/projects/company", label: "Company projects", exact: true },
    { to: `/${code}/shared-projects`, label: "Shared projects", exact: true },
    ...companyProjects.slice(0, MAX_COMPANY_PROJECTS_IN_MENU).map((p, i) => ({
      to: `/projects/${p.id}`,
      label: p.name,
      divider: i === 0,
    })),
  ];
}

/** The same work and reporting navigation for every department. */
export function buildDepartmentNav(
  code: DepartmentCode,
  hasWaterAccess = false,
  isDepartmentHead = false,
  companyProjects: { id: string; name: string }[] = [],
): NavItem[] {
  const base = `/${code}`;
  const own = DOMAIN_ITEMS[code];
  const projects = code === "hr" ? "/hr/projects" : "/projects";
  const requests = CLIENT_REQUESTS_PATH[code];
  const workChildren: NavChild[] = [
    ...own,
    { to: "/projects/mine", label: "My tasks", divider: own.length > 0 },
    { to: `${base}/calendar`, label: "Calendar" },
    { to: `${base}/documents`, label: "Documents" },
    { to: requests, label: "Client requests", divider: true },
    { to: `${base}/workspace`, label: "Clients & contracts" },
    {
      to: `/${code}/reports`,
      label: code === "finance" ? "Financial snapshots" : "Figures & analysis",
      roles: code === "finance" ? ["finance"] : undefined,
      divider: true,
    },
    { to: "/reports/mine", label: "Personal reports (optional)" },
    ...(isDepartmentHead ? [{ to: "/reports/team", label: "Personal report reviews" }] : []),
    ...(hasWaterAccess ? [{ to: "/water", label: "Water Project", divider: true }] : []),
  ];

  return [
    { to: base, label: "Home", icon: Home, exact: true },
    {
      to: projects,
      label: "Projects",
      icon: FolderKanban,
      match: [
        projects,
        "/projects",
        "/pipeline/projects",
        `${base}/shared-projects`,
        ...(code === "tender" ? [] : ["/tender"]),
      ],
      children: projectsChildren(code, projects, companyProjects),
    },
    {
      to: `/reports/departments/${code}`,
      label: "Reports",
      icon: BarChart3,
      match: [`${base}/reports`, "/department-reports", "/reports"],
      children: reportsChildren(code),
    },
    {
      to: workChildren[0].to,
      label: "Tools",
      icon: Building2,
      // The department prefix catches its other pages; longer matches below win.
      match: [
        base,
        "/projects/mine",
        `/${code}/reports`,
        "/reports/mine",
        "/reports/team",
        "/calendar",
        "/documents",
        requests,
        "/requests",
        "/pipeline/engagements",
        "/engagements",
        "/clients",
        "/departments",
        ...(hasWaterAccess ? ["/water"] : []),
      ],
      children: workChildren,
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
    {
      to: "/projects/company",
      label: "Projects",
      icon: FolderKanban,
      match: ["/projects"],
      children: [{ to: "/projects/company", label: "Company projects", exact: true }],
    },
    { to: "/reports/projects", label: "Reports", icon: BarChart3, match: ["/reports"] },
    {
      to: "/projects/mine",
      label: "Tools",
      icon: Building2,
      match: ["/projects/mine"],
      children: [
        { to: "/projects/mine", label: "My tasks" },
        { to: "/guide", label: "Guide" },
        { to: "/reports/mine", label: "Personal reports (optional)" },
      ],
    },
  ];
}
