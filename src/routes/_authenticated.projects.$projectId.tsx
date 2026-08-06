import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useProject,
  useTasks,
  useCreateTask,
  useUpdateTask,
  useMilestones,
  useDeleteProject,
  TASK_PRIORITY_LABELS,
  type Task,
  type TaskStatus,
  type TaskPriority,
} from "@/features/projects/use-projects";
import { useCostItems } from "@/features/project-workspace/use-project-workspace";
import { useProjectActivities, useLogProjectActivity } from "@/features/pipeline/use-pipeline";
import { useDepartments, useProfilesLite } from "@/features/clients/use-clients-contracts";
import { useAuth, type AppRole } from "@/lib/auth";
import { TaskDetailDialog } from "@/features/projects/task-detail-dialog";
import { AttachmentsPanel } from "@/features/documents/attachments-panel";
import { ActivityPane } from "@/components/pipeline/activity-pane";
import { WorkspaceHeader } from "@/components/project-workspace/workspace-header";
import { EntityBreadcrumb, type BreadcrumbSegment } from "@/components/entity-breadcrumb";
import { OverviewTab } from "@/components/project-workspace/overview-tab";
import { TasksTab } from "@/components/project-workspace/tasks-tab";
import { GanttTab } from "@/components/project-workspace/gantt-tab";
import { TeamTab } from "@/components/project-workspace/team-tab";
import { FinancialsTab } from "@/components/project-workspace/financials-tab";
import { CalendarTab } from "@/components/project-workspace/calendar-tab";
import { RaidTab } from "@/components/project-workspace/raid-tab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ["gantt", "Gantt & Timeline"],
  ["team", "Team & Resources"],
  ["financials", "Financials"],
  ["calendar", "Calendar"],
  ["comms", "Communications"],
  ["raid", "Risks & Issues"],
  ["documents", "Documents"],
] as const;

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
});

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  validateSearch: searchSchema,
  component: ProjectDetail,
});

function buildProjectBreadcrumb(
  project: ReturnType<typeof useProject>["data"],
): BreadcrumbSegment[] {
  if (!project) return [];
  const segments: BreadcrumbSegment[] = [];
  if (project.tender_id) {
    segments.push({ label: "Tender Records", to: "/tender" });
    segments.push({ label: project.tender_title ?? "Tender", to: `/tender/${project.tender_id}` });
  } else if (project.client_request_id) {
    segments.push({ label: "Client Requests", to: "/requests" });
    segments.push({
      label: project.client_request_title ?? "Request",
      to: `/requests/${project.client_request_id}`,
    });
  } else {
    segments.push({ label: "Projects", to: "/projects" });
  }
  segments.push({ label: project.name });
  return segments;
}

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const { view } = Route.useSearch();
  const navigate = Route.useNavigate();

  const projectQ = useProject(projectId);
  const tasksQ = useTasks({ projectId });
  const milestonesQ = useMilestones(projectId);
  const costItemsQ = useCostItems(projectId);
  const activitiesQ = useProjectActivities(projectId);
  const logActivity = useLogProjectActivity(projectId);
  const updateTask = useUpdateTask();
  const deleteProject = useDeleteProject();
  const { hasRole, isAdminOrCeo } = useAuth();
  const departmentsQ = useDepartments();
  const profilesQ = useProfilesLite();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const tasks = tasksQ.data ?? [];
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;
  const profileMap = new Map((profilesQ.data ?? []).map((p) => [p.id, p.full_name ?? p.email]));

  const setView = (v: (typeof TABS)[number][0]) => navigate({ search: { view: v }, replace: true });

  if (projectQ.isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  const project = projectQ.data;
  if (!project) return <div className="text-sm text-muted-foreground">Project not found.</div>;

  const departmentCode = departmentsQ.data?.find((d) => d.id === project.department_id)?.code;
  // Same rule the backend enforces on delete: admin/CEO, or a member of the project's own
  // department — not just any authenticated user.
  const canManageDocuments =
    isAdminOrCeo || (!!departmentCode && hasRole(departmentCode as AppRole));

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    updateTask.mutate(
      { id: taskId, status },
      { onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed") },
    );
  };

  const handleDeleteProject = () => {
    if (
      !confirm(
        `Delete "${project.name}"? This removes all its tasks, milestones and documents too.`,
      )
    )
      return;
    deleteProject.mutate(project.id, {
      onSuccess: () => {
        toast.success("Project deleted");
        navigate({ to: "/projects" });
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
    });
  };

  const actualCost = (costItemsQ.data ?? []).reduce((a, c) => a + c.actual_amount, 0);

  return (
    <div className="pipeline-scope space-y-3">
      <div className="flex items-start justify-between gap-2">
        <EntityBreadcrumb segments={buildProjectBreadcrumb(project)} />
        {canManageDocuments && (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive shrink-0"
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
        )}
      </div>

      <WorkspaceHeader project={project} tasks={tasks} actualCost={actualCost} />

      <div className="ws-tabbar">
        {TABS.map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`ws-tabbtn ${view === v ? "active" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div>
        {view === "overview" && (
          <OverviewTab
            project={project}
            tasks={tasks}
            milestones={milestonesQ.data ?? []}
            actualCost={actualCost}
          />
        )}
        {view === "tasks" &&
          (tasksQ.isLoading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--pipeline-ink)" }} />
            </div>
          ) : (
            <TasksTab
              tasks={tasks}
              profileMap={profileMap}
              onTaskClick={(t) => setSelectedTaskId(t.id)}
              onStatusChange={handleStatusChange}
              newTaskAction={<NewTaskDialog projectId={projectId} />}
            />
          ))}
        {view === "gantt" && (
          <GanttTab project={project} tasks={tasks} milestones={milestonesQ.data ?? []} />
        )}
        {view === "team" && <TeamTab projectId={projectId} />}
        {view === "financials" && <FinancialsTab project={project} projectId={projectId} />}
        {view === "calendar" && <CalendarTab tasks={tasks} milestones={milestonesQ.data ?? []} />}
        {view === "comms" && (
          <div className="ws-panel">
            <h3>Communications Log</h3>
            <ActivityPane
              activities={activitiesQ.data ?? []}
              isLoading={activitiesQ.isLoading}
              isAdding={logActivity.isPending}
              onAdd={(type, summary) =>
                logActivity.mutate(
                  { type, summary },
                  {
                    onError: (err) =>
                      toast.error(err instanceof Error ? err.message : "Failed to log"),
                  },
                )
              }
            />
          </div>
        )}
        {view === "raid" && <RaidTab projectId={projectId} />}
        {view === "documents" && (
          <div className="ws-panel">
            <AttachmentsPanel
              resourceType="project"
              resourceId={projectId}
              canManage={canManageDocuments}
            />
          </div>
        )}
      </div>

      <TaskDetailDialog
        task={selectedTask}
        onClose={() => setSelectedTaskId(null)}
        canManageDocuments={canManageDocuments}
        projectTasks={tasks}
      />
    </div>
  );
}

function NewTaskDialog({ projectId }: { projectId: string }) {
  const profilesQ = useProfilesLite();
  const createTask = useCreateTask();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [phase, setPhase] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  const submit = () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    createTask.mutate(
      {
        projectId,
        title: title.trim(),
        phase: phase.trim() || undefined,
        priority,
        assigneeId: assigneeId || undefined,
        estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Task created");
          setOpen(false);
          setTitle("");
          setPhase("");
          setPriority("medium");
          setAssigneeId("");
          setEstimatedHours("");
          setStartDate("");
          setDueDate("");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" style={{ background: "var(--pipeline-ink)" }}>
          <Plus className="h-4 w-4 mr-1" /> New task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Phase</Label>
              <Input
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                placeholder="e.g. Discovery"
              />
            </div>
            <div>
              <Label>Est. hours</Label>
              <Input
                type="number"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
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
            </div>
            <div>
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Assignee</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                {(profilesQ.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name ?? p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={createTask.isPending}
            style={{ background: "var(--pipeline-ink)" }}
          >
            {createTask.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
