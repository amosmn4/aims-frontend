import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { ChevronDown, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import {
  useProject,
  useProjects,
  useTasks,
  useCreateTask,
  useUpdateTask,
  useMilestones,
  useDeleteProject,
  tracksDeliveryMetrics,
  TASK_PRIORITY_LABELS,
  type TaskStatus,
  type TaskPriority,
} from "@/features/projects/use-projects";
import { useCostItems } from "@/features/project-workspace/use-project-workspace";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { useAuth } from "@/lib/auth";
import { TaskDetailDialog } from "@/features/projects/task-detail-dialog";
import { AttachmentsPanel } from "@/features/documents/attachments-panel";
import { ActivityThread } from "@/features/activity/activity-thread";
import { WorkspaceHeader } from "@/components/project-workspace/workspace-header";
import { OverviewTab } from "@/components/project-workspace/overview-tab";
import { TasksTab } from "@/components/project-workspace/tasks-tab";
import { GanttTab } from "@/components/project-workspace/gantt-tab";
import { TeamTab } from "@/components/project-workspace/team-tab";
import { FinancialsTab } from "@/components/project-workspace/financials-tab";
import { CalendarTab } from "@/components/project-workspace/calendar-tab";
import { RaidTab } from "@/components/project-workspace/raid-tab";
import { HrProjectOverview } from "@/features/hr/hr-project-overview";
import { EditProjectDialog } from "@/features/projects/edit-project-dialog";
import { ProjectBackLink, useProjectBack } from "@/features/projects/project-back-link";
import { StaffSelect, useStaffOptions } from "@/features/projects/staff-picker";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { FormField, RequiredNote } from "@/components/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const TABS = [
  ["overview", "Overview"],
  ["tasks", "Tasks"],
  ["gantt", "Timeline"],
  ["team", "Team"],
  ["financials", "Financials"],
  ["calendar", "Calendar"],
  ["comms", "Activity"],
  ["raid", "Risks and issues"],
  ["documents", "Documents"],
] as const;

type TabKey = (typeof TABS)[number][0];

// HR sees the everyday tabs up front; specialist views sit under "More".
const HR_PRIMARY_TABS: [TabKey, string][] = [
  ["overview", "Overview"],
  ["tasks", "Tasks"],
  ["documents", "Documents"],
  ["comms", "Activity"],
  ["financials", "Costs & invoices"],
  ["team", "Team"],
];
const HR_MORE_TABS: [TabKey, string][] = [
  ["gantt", "Timeline"],
  ["calendar", "Calendar"],
  ["raid", "Risks and issues"],
];

const searchSchema = z.object({
  view: z
    .union([
      z.literal("overview"),
      z.literal("tasks"),
      z.literal("gantt"),
      z.literal("team"),
      z.literal("financials"),
      z.literal("calendar"),
      z.literal("comms"),
      z.literal("raid"),
      z.literal("documents"),
    ])
    .catch("overview"),
  from: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  validateSearch: searchSchema,
  component: ProjectDetail,
});

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const { view, from } = Route.useSearch();
  const navigate = Route.useNavigate();

  const projectQ = useProject(projectId);
  const tasksQ = useTasks({ projectId });
  const milestonesQ = useMilestones(projectId);
  const costItemsQ = useCostItems(projectId);
  const updateTask = useUpdateTask();
  const deleteProject = useDeleteProject();
  const { canWriteDepartment, profile } = useAuth();
  const departmentsQ = useDepartments();
  const { options: staff } = useStaffOptions();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const project = projectQ.data;
  const departmentCode =
    project?.department_code ??
    departmentsQ.data?.find((d) => d.id === project?.department_id)?.code;
  const back = useProjectBack(departmentCode, from);

  const tasks = tasksQ.data ?? [];
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;
  const profileMap = new Map(staff.map((p) => [p.id, p.name]));

  const setView = (v: TabKey) =>
    navigate({ search: (prev) => ({ ...prev, view: v }), replace: true });

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

  // Mirrors the backend write check (roles plus per-user overrides).
  const canManage = !!departmentCode && canWriteDepartment(departmentCode);
  const isHr = departmentCode === "hr";
  const detailed = tracksDeliveryMetrics(departmentCode);
  const primaryTabs: [TabKey, string][] = isHr
    ? HR_PRIMARY_TABS
    : TABS.map(([v, label]): [TabKey, string] => [v, label]);
  const moreTabs = isHr ? HR_MORE_TABS : [];
  const activeMore = moreTabs.find(([v]) => v === view);

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    updateTask.mutate(
      { id: taskId, status },
      { onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed") },
    );
  };

  const handleDeleteProject = async () => {
    const ok = await confirmDialog({
      title: `Delete "${project.name}"?`,
      description:
        "This removes all its tasks, milestones and documents too. This can't be undone.",
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

  const actualCost = (costItemsQ.data ?? []).reduce((a, c) => a + c.actual_amount, 0);

  return (
    <div className="pipeline-scope space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ProjectBackLink back={back} />
        {canManage && (
          <div className="flex shrink-0 gap-1">
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
          </div>
        )}
      </div>

      {!canManage && (
        <ViewOnlyBanner area="this project" action="change it, apart from tasks assigned to you" />
      )}

      <WorkspaceHeader project={project} tasks={tasks} actualCost={actualCost} />

      <div className="ws-tabbar" role="tablist" aria-label="Project sections">
        {primaryTabs.map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`ws-tabbtn ${view === v ? "active" : ""}`}
          >
            {label}
          </button>
        ))}
        {moreTabs.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn("ws-tabbtn inline-flex items-center gap-1", activeMore && "active")}
              >
                {activeMore ? activeMore[1] : "More"} <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {moreTabs.map(([v, label]) => (
                <DropdownMenuItem key={v} onSelect={() => setView(v)}>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div>
        {view === "overview" && isHr && (
          <HrProjectOverview
            project={project}
            tasks={tasks}
            milestones={milestonesQ.data ?? []}
            canManage={canManage}
            onOpenTask={setSelectedTaskId}
            onViewTasks={() => setView("tasks")}
          />
        )}
        {view === "overview" && !isHr && (
          <OverviewTab
            project={project}
            tasks={tasks}
            milestones={milestonesQ.data ?? []}
            actualCost={actualCost}
            canManage={canManage}
          />
        )}
        {view === "tasks" &&
          (tasksQ.isLoading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--pipeline-ink)" }} />
            </div>
          ) : tasksQ.isError ? (
            <LoadError what="tasks" error={tasksQ.error} onRetry={() => tasksQ.refetch()} />
          ) : (
            <TasksTab
              tasks={tasks}
              profileMap={profileMap}
              detailed={detailed}
              canMoveTask={(t) => canManage || t.assignee_id === profile?.id}
              onTaskClick={(t) => setSelectedTaskId(t.id)}
              onStatusChange={handleStatusChange}
              newTaskAction={canManage ? <NewTaskDialog projectId={projectId} /> : undefined}
            />
          ))}
        {view === "gantt" && (
          <GanttTab
            project={project}
            tasks={tasks}
            milestones={milestonesQ.data ?? []}
            detailed={detailed}
          />
        )}
        {view === "team" && (
          <TeamTab
            projectId={projectId}
            canManage={canManage}
            detailed={detailed}
            departmentName={project.department_name}
            restricted={project.visibility === "restricted"}
          />
        )}
        {view === "financials" && (
          <FinancialsTab
            project={project}
            projectId={projectId}
            canManage={canManage}
            showClientContract={!isHr}
          />
        )}
        {view === "calendar" && <CalendarTab tasks={tasks} milestones={milestonesQ.data ?? []} />}
        {view === "comms" && (
          <div className="ws-panel">
            <ActivityThread
              record={{ kind: "project", id: projectId }}
              canLog={canManage}
              readOnlyReason="Only the people working on this project can add activity."
              flat
            />
          </div>
        )}
        {view === "raid" && <RaidTab projectId={projectId} canManage={canManage} />}
        {view === "documents" && (
          <div className="ws-panel">
            <AttachmentsPanel resourceType="project" resourceId={projectId} canManage={canManage} />
          </div>
        )}
      </div>

      <TaskDetailDialog
        task={selectedTask}
        onClose={() => setSelectedTaskId(null)}
        canManageDocuments={canManage}
        projectTasks={tasks}
      />

      {editing && <EditProjectDialog project={project} onClose={() => setEditing(false)} />}
    </div>
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
