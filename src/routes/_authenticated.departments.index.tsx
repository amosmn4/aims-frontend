import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
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
  UserCog,
  RotateCw,
  ListChecks,
  CircleHelp,
} from "lucide-react";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { useAuth, homeRouteFor, departmentScopeFor } from "@/lib/auth";
import { DEPARTMENT_CODES } from "@/lib/department-nav";

export const Route = createFileRoute("/_authenticated/departments/")({
  component: DepartmentsOverview,
});

const KNOWN: Record<
  string,
  { icon: typeof Users; to: string; accent: string; description: string }
> = {
  operations: {
    icon: ClipboardList,
    to: "/operations",
    accent: "bg-secondary text-secondary-foreground",
    description: "Logs client requests and sends them to the right department.",
  },
  finance: {
    icon: Wallet,
    to: "/finance",
    accent: "bg-primary/10 text-primary",
    description: "Invoices, debtors, revenue and margin.",
  },
  hr: {
    icon: Users,
    to: "/hr",
    accent: "bg-success/10 text-success",
    description: "Recruitment, payroll and training projects for clients.",
  },
  it: {
    icon: Cpu,
    to: "/it",
    accent: "bg-warning/10 text-warning",
    description: "Systems, the HRMS product and IT support.",
  },
  marketing: {
    icon: Megaphone,
    to: "/marketing",
    accent: "bg-accent/10 text-accent",
    description: "Leads, campaigns, website and brand.",
  },
  tender: {
    icon: FileText,
    to: "/tender",
    accent: "bg-destructive/10 text-destructive",
    description: "Tenders and client requests.",
  },
};

function DepartmentsOverview() {
  const deptsQ = useDepartments();
  const { isAdminOrCeo, canReadDepartment, roles, workspaces, setWorkspace } = useAuth();
  const navigate = useNavigate();
  const home = homeRouteFor(roles);
  const sendHome = !!departmentScopeFor(roles) || home === "/water";
  const hasAnyDepartment = isAdminOrCeo || DEPARTMENT_CODES.some((c) => canReadDepartment(c));

  useEffect(() => {
    if (sendHome) navigate({ to: home, replace: true });
  }, [sendHome, home, navigate]);

  if (sendHome) return null;
  if (!hasAnyDepartment) return <AccessBeingSetUp />;

  const depts = [...(deptsQ.data ?? [])].sort((a, b) => {
    const open = (code: string) => (KNOWN[code] && canReadDepartment(code) ? 0 : 1);
    return open((a.code ?? "").toLowerCase()) - open((b.code ?? "").toLowerCase());
  });

  return (
    <div>
      <PageHeader
        title="Departments"
        description={
          isAdminOrCeo
            ? "Open a department to see its work."
            : "Open a department to see its work. The ones you can open are listed first."
        }
      />
      {deptsQ.isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : deptsQ.isError ? (
        <LoadError what="departments" error={deptsQ.error} onRetry={() => deptsQ.refetch()} />
      ) : depts.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
          No departments have been set up yet. Ask the CEO to add them.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {depts.map((d) => {
            const key = (d.code ?? "").toLowerCase();
            const meta = KNOWN[key];
            const Icon = meta?.icon ?? Briefcase;
            const canOpen = canReadDepartment(key);
            return (
              <div key={d.id} className="rounded-lg border bg-card p-4 flex flex-col gap-3">
                <div
                  className={`h-10 w-10 rounded-md flex items-center justify-center ${
                    meta?.accent ?? "bg-secondary text-secondary-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">{d.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {meta?.description ?? "Department workspace."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-auto pt-2 border-t">
                  {canOpen ? (
                    <>
                      {meta && (
                        <Link
                          to={meta.to}
                          onClick={() => {
                            if (workspaces.includes(key as (typeof workspaces)[number]))
                              setWorkspace(key as (typeof workspaces)[number]);
                          }}
                          className="text-xs font-medium inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          Open {d.name} <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </Link>
                      )}
                      <div className="flex-1" />
                      <Link
                        to="/departments/$deptId"
                        params={{ deptId: d.id }}
                        className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <Briefcase className="h-3 w-3" aria-hidden="true" /> {d.name} clients &
                        contracts
                      </Link>
                    </>
                  ) : (
                    <span className="text-xs inline-flex items-center gap-1 text-muted-foreground">
                      <Lock className="h-3 w-3" aria-hidden="true" /> You don't have access. Ask the
                      CEO if you need it.
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AccessBeingSetUp() {
  const { refresh, profile } = useAuth();
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);

  const checkAgain = async () => {
    setChecking(true);
    try {
      await refresh();
      setChecked(true);
    } catch {
      toast.error("Couldn't check your access. Check your connection and try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 rounded-lg border bg-card p-8 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <UserCog className="h-6 w-6 text-primary" aria-hidden="true" />
      </div>
      <h1 className="text-lg font-semibold">Your access is being set up</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {profile?.fullName ? `Welcome, ${profile.fullName.split(" ")[0]}. ` : "Welcome. "}
        You're signed in, but you haven't been given a department yet, so there's nothing to open
        here.
      </p>
      <p className="mt-3 text-sm font-medium">Ask the CEO to give you a department and role.</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Once that's done, select Check again and AIMS will take you to your work.
      </p>
      {checked && !checking && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          Checked just now. No department has been given to you yet.
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={() => void checkAgain()} disabled={checking}>
          {checking ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <RotateCw className="h-4 w-4 mr-1" />
          )}
          Check again
        </Button>
        <Button variant="outline" asChild>
          <Link to="/projects/mine">
            <ListChecks className="h-4 w-4 mr-1" /> My tasks
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/guide">
            <CircleHelp className="h-4 w-4 mr-1" /> Help
          </Link>
        </Button>
      </div>
    </div>
  );
}
