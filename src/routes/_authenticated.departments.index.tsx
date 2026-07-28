import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import {
  Wallet,
  Users,
  Cpu,
  Megaphone,
  FileText,
  ArrowRight,
  Loader2,
  Briefcase,
  Lock,
  ClipboardList,
} from "lucide-react";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { useAuth, type AppRole } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/departments/")({
  component: DepartmentsOverview,
});

const KNOWN: Record<
  string,
  { icon: typeof Users; to: string; role: AppRole; accent: string; description: string }
> = {
  operations: {
    icon: ClipboardList,
    to: "/operations",
    role: "operations",
    accent: "bg-secondary text-secondary-foreground",
    description: "Client-request intake, routing & tracking.",
  },
  finance: {
    icon: Wallet,
    to: "/finance",
    role: "finance",
    accent: "bg-primary/10 text-primary",
    description: "Invoicing, debtors, revenue & margin.",
  },
  hr: {
    icon: Users,
    to: "/hr",
    role: "hr",
    accent: "bg-success/10 text-success",
    description: "People, payroll, recruitment, training.",
  },
  it: {
    icon: Cpu,
    to: "/it",
    role: "it",
    accent: "bg-warning/10 text-warning",
    description: "Systems, HRMS product, infrastructure.",
  },
  marketing: {
    icon: Megaphone,
    to: "/marketing",
    role: "marketing",
    accent: "bg-accent/10 text-accent",
    description: "Leads, campaigns, website & brand.",
  },
  tender: {
    icon: FileText,
    to: "/tender",
    role: "tender",
    accent: "bg-destructive/10 text-destructive",
    description: "Bid pipeline plus client-request intake.",
  },
};

function DepartmentsOverview() {
  const deptsQ = useDepartments();
  const { isAdminOrCeo, hasRole } = useAuth();
  return (
    <div>
      <PageHeader
        title="Departments"
        description="Overview of what each Amsol department is doing."
      />
      {deptsQ.isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(deptsQ.data ?? []).map((d) => {
            const key = (d.code ?? "").toLowerCase();
            const meta = KNOWN[key] ?? {
              icon: Briefcase,
              to: null as string | null,
              role: null as AppRole | null,
              accent: "bg-secondary text-secondary-foreground",
              description: "Department workspace.",
            };
            const Icon = meta.icon;
            const canOpen = !meta.role || isAdminOrCeo || hasRole(meta.role);
            return (
              <div key={d.id} className="rounded-lg border bg-card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div
                    className={`h-10 w-10 rounded-md flex items-center justify-center ${meta.accent}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold">{d.name}</div>
                  <div className="text-xs text-muted-foreground">{meta.description}</div>
                </div>
                <div className="flex gap-2 mt-auto pt-2 border-t">
                  {meta.to &&
                    (canOpen ? (
                      <Link
                        to={meta.to}
                        className="text-xs inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Open module <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span
                        className="text-xs inline-flex items-center gap-1 text-muted-foreground"
                        title="You don't have access to this department's workspace"
                      >
                        <Lock className="h-3 w-3" /> Restricted
                      </span>
                    ))}
                  <div className="flex-1" />
                  <Link
                    to="/departments/$deptId"
                    params={{ deptId: d.id }}
                    className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <Briefcase className="h-3 w-3" /> Clients & contracts
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
