import {
  ClipboardList,
  Cpu,
  Droplets,
  FileText,
  Megaphone,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

export interface ReportLink {
  key: string;
  to: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}

const DEPARTMENT_REPORTS: ReportLink[] = [
  {
    key: "operations",
    to: "/reports/departments/operations",
    label: "Operations",
    hint: "Client requests, conversion, time in each stage",
    icon: ClipboardList,
  },
  {
    key: "finance",
    to: "/reports/departments/finance",
    label: "Finance",
    hint: "Who owes us and whom we owe, days to get paid, profit and loss",
    icon: Wallet,
  },
  {
    key: "hr",
    to: "/reports/departments/hr",
    label: "Human Resources",
    hint: "Projects by service line, recruitment results",
    icon: Users,
  },
  {
    key: "it",
    to: "/reports/departments/it",
    label: "IT",
    hint: "Projects, systems and sites",
    icon: Cpu,
  },
  {
    key: "marketing",
    to: "/reports/departments/marketing",
    label: "Marketing",
    hint: "Leads, website visits, blog reach",
    icon: Megaphone,
  },
  {
    key: "tender",
    to: "/reports/departments/tender",
    label: "Tender",
    hint: "Tenders by stage, win rate",
    icon: FileText,
  },
];

const WATER_REPORT: ReportLink = {
  key: "water",
  to: "/water/reports",
  label: "Water Project",
  hint: "Consumption, revenue, losses by zone, active and inactive meters",
  icon: Droplets,
};

/** Department reports this person can open. */
export function useReportLinks() {
  const { hasRole, canReadDepartment } = useAuth();
  const departments = DEPARTMENT_REPORTS.filter((report) => canReadDepartment(report.key));
  const withWater = hasRole("water") ? [...departments, WATER_REPORT] : departments;
  return { departments, all: withWater };
}
