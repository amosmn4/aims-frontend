import {
  LayoutDashboard,
  Compass,
  Briefcase,
  FolderKanban,
  FolderArchive,
  CalendarClock,
  BarChart3,
  Workflow,
} from "lucide-react";
import type { NavItem } from "@/components/app-shell";
import type { DepartmentCode } from "@/lib/auth";

// Everything a department-scoped user needs, arranged the same way for all six departments:
// Dashboard (their Overview) · How It Works · [department name] (their own domain's sub-pages,
// the former in-page tab bar) · Reports · Projects & Tasks · Calendar · Clients & Contracts ·
// Documents. Every target route already exists and is already scoped to that department — this
// is purely a navigation reshuffle, no new pages beyond the "domain" sub-pages that used to be
// tabs.
const DOMAIN_ITEMS: Record<DepartmentCode, { to: string; label: string }[]> = {
  finance: [
    { to: "/finance/pipeline", label: "Pipeline" },
    { to: "/finance/invoices", label: "Invoices & Billing" },
    { to: "/finance/debtors", label: "Debtors" },
    { to: "/finance/revenue", label: "Revenue & Margin" },
    { to: "/finance/budgets", label: "Budgets" },
    { to: "/finance/payroll-compliance", label: "Payroll Compliance" },
    { to: "/finance/upload", label: "Excel Upload" },
  ],
  hr: [
    { to: "/hr/pipeline", label: "Pipeline" },
    { to: "/hr/recruitment", label: "Recruitment" },
    { to: "/hr/projects", label: "Work & Projects" },
  ],
  it: [
    { to: "/it/pipeline", label: "Pipeline" },
    { to: "/it/systems-sites", label: "Systems & Sites" },
    { to: "/it/tickets", label: "Tickets" },
    { to: "/it/hrms-clients", label: "HRMS Clients" },
    { to: "/it/inventory", label: "Inventory" },
  ],
  marketing: [
    { to: "/marketing/pipeline", label: "Pipeline" },
    { to: "/marketing/leads", label: "Leads" },
    { to: "/marketing/campaigns", label: "Campaigns" },
    { to: "/marketing/website-analytics", label: "Website Analytics" },
    { to: "/marketing/blog", label: "Blog" },
  ],
  tender: [
    { to: "/tender/bid-pipeline", label: "Bid Pipeline" },
    { to: "/tender/requests", label: "Client Requests" },
  ],
  operations: [{ to: "/operations/requests", label: "Client Requests" }],
};

const DEPARTMENT_LABEL: Record<DepartmentCode, string> = {
  finance: "Finance",
  hr: "Human Resources",
  it: "Information Technology",
  marketing: "Marketing",
  tender: "Tender",
  operations: "Operations",
};

export function buildDepartmentNav(code: DepartmentCode): NavItem[] {
  const base = `/${code}`;
  return [
    { to: base, label: "Dashboard", icon: LayoutDashboard, match: [base] },
    { to: "/guide", label: "How It Works", icon: Compass, match: ["/guide"] },
    {
      to: DOMAIN_ITEMS[code][0]?.to ?? base,
      label: DEPARTMENT_LABEL[code],
      icon: Workflow,
      match: DOMAIN_ITEMS[code].map((i) => i.to),
      children: DOMAIN_ITEMS[code],
    },
    { to: `${base}/reports`, label: "Reports", icon: BarChart3, match: [`${base}/reports`] },
    {
      to: `${base}/tasks`,
      label: "Projects & Tasks",
      icon: FolderKanban,
      match: [`${base}/tasks`, "/projects/mine", `${base}/shared-projects`],
      children: [
        { to: `${base}/tasks`, label: "Task Board" },
        { to: "/projects/mine", label: "My Tasks" },
        { to: `${base}/shared-projects`, label: "Shared with me" },
      ],
    },
    { to: `${base}/calendar`, label: "Calendar", icon: CalendarClock, match: [`${base}/calendar`] },
    {
      to: `${base}/workspace`,
      label: "Clients & Contracts",
      icon: Briefcase,
      match: [`${base}/workspace`],
    },
    {
      to: `${base}/documents`,
      label: "Documents",
      icon: FolderArchive,
      match: [`${base}/documents`],
    },
  ];
}
