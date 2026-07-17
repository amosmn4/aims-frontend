import { createFileRoute, Link } from "@tanstack/react-router";
import { Wallet, Users, Cpu, Megaphone, FileText, FolderKanban, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/")({
  component: ReportsIndex,
});

function ReportsIndex() {
  const items = [
    {
      to: "/reports/departments/finance",
      label: "Finance — Financial Management",
      icon: Wallet,
      hint: "AR/AP aging, DSO/DPO, P&L",
    },
    {
      to: "/reports/departments/hr",
      label: "Human Resources",
      icon: Users,
      hint: "Headcount, attrition, payroll",
    },
    {
      to: "/reports/departments/it",
      label: "Information Technology",
      icon: Cpu,
      hint: "Systems, HRMS uptime",
    },
    {
      to: "/reports/departments/marketing-ops",
      label: "Marketing & Operations",
      icon: Megaphone,
      hint: "Pipeline, campaigns",
    },
    {
      to: "/reports/departments/tender",
      label: "Tender",
      icon: FileText,
      hint: "Win rate, submissions",
    },
    {
      to: "/reports/projects",
      label: "Projects",
      icon: FolderKanban,
      hint: "Submissions from active projects",
    },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((i) => {
        const Icon = i.icon;
        return (
          <Link
            key={i.to}
            to={i.to}
            className="group rounded-lg border bg-card p-4 hover:border-primary transition-colors flex items-start gap-3"
          >
            <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">{i.label}</div>
              <div className="text-xs text-muted-foreground">{i.hint}</div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
          </Link>
        );
      })}
    </div>
  );
}
