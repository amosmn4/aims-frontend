import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Plus, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth, type AppRole } from "@/lib/auth";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { useClients } from "@/features/finance/use-finance-data";
import {
  useProjects,
  useCreateProject,
  PROJECT_STATUS_LABELS,
  type ProjectStatus,
} from "@/features/projects/use-projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  planning: "bg-secondary text-secondary-foreground",
  active: "bg-primary/10 text-primary",
  on_hold: "bg-warning/15 text-warning",
  completed: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
};

export const Route = createFileRoute("/_authenticated/projects/")({
  component: ProjectsIndex,
});

function ProjectsIndex() {
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const departmentsQ = useDepartments();
  const projectsQ = useProjects({
    departmentId: departmentFilter === "all" ? undefined : departmentFilter,
    status: statusFilter === "all" ? undefined : (statusFilter as ProjectStatus),
  });

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        See the delivery-stage board in{" "}
        <Link to="/pipeline/projects" className="text-primary hover:underline">
          Pipeline →
        </Link>
      </div>
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex flex-wrap gap-3">
          <div className="w-52">
            <Label className="text-xs">Department</Label>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {(departmentsQ.data ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(PROJECT_STATUS_LABELS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <NewProjectDialog />
      </div>

      {projectsQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (projectsQ.data ?? []).length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
          No projects match these filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(projectsQ.data ?? []).map((p) => (
            <Link
              key={p.id}
              to="/projects/$projectId"
              params={{ projectId: p.id }}
              className="rounded-lg border bg-card p-4 flex flex-col gap-2 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-sm">{p.name}</div>
                <Badge className={PROJECT_STATUS_STYLES[p.status]} variant="secondary">
                  {PROJECT_STATUS_LABELS[p.status]}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">{p.department_name}</div>
              {p.client_name && (
                <div className="text-xs text-muted-foreground">Client: {p.client_name}</div>
              )}
              <div className="mt-auto pt-2 border-t flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{p.task_count ?? 0} tasks</span>
                <span className="text-primary inline-flex items-center gap-1">
                  Open <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function NewProjectDialog() {
  const { profile, hasRole, isAdminOrCeo } = useAuth();
  const departmentsQ = useDepartments();
  const clientsQ = useClients();
  const createProject = useCreateProject();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [clientId, setClientId] = useState("");

  // Default to the user's own department when they only have one obvious choice.
  const eligibleDepartments = (departmentsQ.data ?? []).filter(
    (d) => isAdminOrCeo || hasRole(d.code as AppRole),
  );

  const submit = () => {
    if (!name.trim() || !departmentId) {
      toast.error("Name and department are required");
      return;
    }
    createProject.mutate(
      {
        name: name.trim(),
        description: description || undefined,
        departmentId,
        clientId: clientId || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Project created");
          setOpen(false);
          setName("");
          setDescription("");
          setDepartmentId("");
          setClientId("");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" /> New project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleDepartments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Client (optional)</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {(clientsQ.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {!eligibleDepartments.length && (
            <p className="text-xs text-muted-foreground">
              Your account ({profile?.email}) isn't assigned a department role that can create
              projects.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={createProject.isPending}>
            {createProject.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
