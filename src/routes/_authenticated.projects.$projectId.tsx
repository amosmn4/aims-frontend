import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { ChevronDown, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import {
  useProject,
  useProjects,
  useCreateTask,
  useDeleteProject,
  TASK_PRIORITY_LABELS,
  type TaskPriority,
} from "@/features/projects/use-projects";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { EditProjectDialog } from "@/features/projects/edit-project-dialog";
import { useProjectAccess } from "@/features/projects/use-project-sharing";
import { ShareDialog } from "@/features/permissions/share-dialog";
import { ProjectBackLink, useProjectBack } from "@/features/projects/project-back-link";
import { StaffSelect } from "@/features/projects/staff-picker";
import {
  PROJECT_TABS,
  ProjectWorkspace,
  type ProjectTab,
} from "@/features/projects/workspace/project-workspace";
import { LoadError } from "@/components/load-error";
import { FormField, RequiredNote } from "@/components/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// Older links may name tabs that no longer exist; they open the Overview.
const searchSchema = z.object({
  view: z.string().optional().catch(undefined),
  from: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  validateSearch: searchSchema,
  component: ProjectDetail,
});

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const { view: requestedView, from } = Route.useSearch();
  const navigate = Route.useNavigate();

  const projectQ = useProject(projectId);
  const deleteProject = useDeleteProject();
  const departmentsQ = useDepartments();
  const [editing, setEditing] = useState(false);

  const project = projectQ.data;
  const departmentCode =
    project?.department_code ??
    departmentsQ.data?.find((d) => d.id === project?.department_id)?.code;
  const back = useProjectBack(departmentCode, from);
  const access = useProjectAccess(
    project?.scope === "department" ? projectId : undefined,
    departmentCode,
  );

  if (projectQ.isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!project) {
    return (
      <div className="space-y-3">
        <ProjectBackLink back={back} />
        <LoadError what="this project" error={projectQ.error} onRetry={() => projectQ.refetch()} />
      </div>
    );
  }

  const view: ProjectTab = (PROJECT_TABS as readonly string[]).includes(requestedView ?? "")
    ? (requestedView as ProjectTab)
    : "overview";
  const isCompany = project.scope === "company";

  const handleDeleteProject = async () => {
    const ok = await confirmDialog({
      title: `Delete "${project.name}"?`,
      description:
        "This removes all its tasks, deliverables, discussions and files too. This can't be undone.",
      confirmLabel: "Delete project",
      destructive: true,
    });
    if (!ok) return;
    deleteProject.mutate(project.id, {
      onSuccess: () => {
        toast.success("Project deleted");
        navigate({ href: back.href });
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
    });
  };

  const departmentActions = access.canEdit && (
    <>
      <ShareDialog resource="projects" resourceId={projectId} recordLabel="project" />
      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit project
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground hover:text-destructive"
        disabled={deleteProject.isPending}
        onClick={handleDeleteProject}
      >
        {deleteProject.isPending ? (
          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5 mr-1" />
        )}
        Delete project
      </Button>
    </>
  );

  return (
    <>
      <ProjectWorkspace
        project={project}
        view={view}
        onViewChange={(v) =>
          navigate({
            search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, view: v }),
            replace: true,
          })
        }
        canEditDepartmentProject={access.canEdit}
        back={isCompany ? <CompanyBackLink /> : <ProjectBackLink back={back} />}
        departmentActions={departmentActions}
      />
      {editing && <EditProjectDialog project={project} onClose={() => setEditing(false)} />}
    </>
  );
}

function CompanyBackLink() {
  return (
    <ProjectBackLink
      back={{
        to: "/projects/company",
        href: "/projects/company",
        search: {},
        label: "company projects",
      }}
    />
  );
}

type NewTaskErrors = Partial<Record<"projectId" | "title" | "dueDate", string>>;

// Takes a fixed `projectId` (a project's Tasks tab) or a `departmentId` (department task board).
export function NewTaskDialog({
  projectId: fixedProjectId,
  departmentId,
}: {
  projectId?: string;
  departmentId?: string;
}) {
  const departmentProjectsQ = useProjects({
    departmentId,
    enabled: !!departmentId && !fixedProjectId,
  });
  const createTask = useCreateTask();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(fixedProjectId ?? "");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [errors, setErrors] = useState<NewTaskErrors>({});

  const dirty =
    open &&
    (!!title.trim() ||
      (!fixedProjectId && !!projectId) ||
      !!assigneeId ||
      !!startDate ||
      !!dueDate ||
      priority !== "medium");
  const { guardClose } = useUnsavedChanges(dirty);

  const close = () => {
    setOpen(false);
    setProjectId(fixedProjectId ?? "");
    setTitle("");
    setPriority("medium");
    setAssigneeId("");
    setStartDate("");
    setDueDate("");
    setShowMore(false);
    setErrors({});
  };

  const submit = () => {
    const found: NewTaskErrors = {};
    if (!projectId) found.projectId = "Choose the project this task belongs to.";
    if (!title.trim()) found.title = "Say what needs doing, e.g. “Send offer letters”.";
    if (startDate && dueDate && dueDate < startDate)
      found.dueDate = "The due date can't be before the start date.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    createTask.mutate(
      {
        projectId,
        title: title.trim(),
        priority,
        assigneeId: assigneeId || undefined,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Task created");
          close();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create"),
      },
    );
  };

  const projects = departmentProjectsQ.data ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : guardClose(close))}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> New task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <RequiredNote />
          </DialogHeader>
          <div className="space-y-3">
            {!fixedProjectId && (
              <FormField id="new-task-project" label="Project" required error={errors.projectId}>
                {departmentProjectsQ.isError ? (
                  <LoadError
                    what="projects"
                    error={departmentProjectsQ.error}
                    onRetry={() => departmentProjectsQ.refetch()}
                  />
                ) : (
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger id="new-task-project" aria-invalid={!!errors.projectId}>
                      <SelectValue
                        placeholder={
                          departmentProjectsQ.isLoading
                            ? "Loading projects…"
                            : projects.length === 0
                              ? "No projects yet — create a project first"
                              : "Choose a project"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            )}
            <FormField id="new-task-title" label="Title" required error={errors.title}>
              <Input
                id="new-task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                aria-invalid={!!errors.title}
              />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField id="new-task-assignee" label="Assign to">
                <StaffSelect id="new-task-assignee" value={assigneeId} onChange={setAssigneeId} />
              </FormField>
              <FormField id="new-task-due" label="Due date" error={errors.dueDate}>
                <Input
                  id="new-task-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  aria-invalid={!!errors.dueDate}
                />
              </FormField>
            </div>
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              aria-expanded={showMore}
            >
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", showMore && "rotate-180")}
              />
              More details (priority, start date)
            </button>
            {showMore && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField id="new-task-priority" label="Priority">
                  <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                    <SelectTrigger id="new-task-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TASK_PRIORITY_LABELS).map(([v, label]) => (
                        <SelectItem key={v} value={v}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField id="new-task-start" label="Start date">
                  <Input
                    id="new-task-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </FormField>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => guardClose(close)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTask.isPending}>
              {createTask.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
