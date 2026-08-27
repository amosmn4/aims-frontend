import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import {
  useProject,
  useProjects,
  useTasks,
  useCreateTask,
  useUpdateTask,
  useUpdateProject,
  useMilestones,
  useDeleteProject,
  TASK_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type Project,
  type ProjectStatus,
  type ProjectVisibility,
  type ProjectEngagementType,
  type ExtensionAttribution,
} from "@/features/projects/use-projects";
import { ProjectVisibilityPicker } from "@/features/projects/project-visibility-picker";
import { ExtensionPrompt, isExtension } from "@/features/projects/extension-prompt";
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
import { Textarea } from "@/components/ui/textarea";
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
  const [editing, setEditing] = useState(false);

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

  const handleDeleteProject = async () => {
    const ok = await confirmDialog({
      title: `Delete "${project.name}"?`,
      description: "This removes all its tasks, milestones and documents too.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
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
      <Link
        to="/projects"
        className="inline-flex items-center gap-1 text-xs hover:underline"
        style={{ color: "var(--pipeline-slate)" }}
      >
        <ArrowLeft className="h-3 w-3" /> Back to Projects & Tasks
      </Link>
      <div className="flex items-start justify-between gap-2">
        <EntityBreadcrumb segments={buildProjectBreadcrumb(project)} />
        {canManageDocuments && (
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
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

      {editing && <EditProjectDialog project={project} onClose={() => setEditing(false)} />}
    </div>
  );
}

function EditProjectDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [budget, setBudget] = useState(project.budget != null ? String(project.budget) : "");
  const [startDate, setStartDate] = useState(project.start_date?.slice(0, 10) ?? "");
  const [endDate, setEndDate] = useState(project.end_date?.slice(0, 10) ?? "");
  const [visibility, setVisibility] = useState<ProjectVisibility>(project.visibility);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [engagementType, setEngagementType] = useState<ProjectEngagementType>(
    project.engagement_type,
  );
  const [extensionReason, setExtensionReason] = useState("");
  const [extensionAttribution, setExtensionAttribution] = useState<ExtensionAttribution>("client");
  const update = useUpdateProject();
  const extending = isExtension(project.end_date, endDate);

  const submit = () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (extending && !extensionReason.trim()) {
      toast.error("Add a reason for the extension before saving");
      return;
    }
    update.mutate(
      {
        id: project.id,
        name: name.trim(),
        description: description || undefined,
        status,
        budget: budget ? Number(budget) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        visibility,
        engagementType,
        memberIds: visibility === "restricted" && memberIds.length ? memberIds : undefined,
        extensionReason: extending ? extensionReason.trim() : undefined,
        extensionAttribution: extending ? extensionAttribution : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Project updated");
          onClose();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
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
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROJECT_STATUS_LABELS).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Budget</Label>
              <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>End date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          {extending && (
            <ExtensionPrompt
              reason={extensionReason}
              onReasonChange={setExtensionReason}
              attribution={extensionAttribution}
              onAttributionChange={setExtensionAttribution}
            />
          )}
          <div>
            <Label>Engagement type</Label>
            <Select
              value={engagementType}
              onValueChange={(v) => setEngagementType(v as ProjectEngagementType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one_off">One-off delivery</SelectItem>
                <SelectItem value="ongoing">Ongoing / retainer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ProjectVisibilityPicker
            departmentName={project.department_name}
            visibility={visibility}
            onVisibilityChange={setVisibility}
            memberIds={memberIds}
            onMemberIdsChange={setMemberIds}
          />
          {visibility === "restricted" && (
            <p className="text-xs text-muted-foreground">
              People picked here are added to the project's Team tab. To remove someone's access,
              remove them from Team instead.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={update.isPending}>
            {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Accepts either a fixed `projectId` (used inside a single project's own Tasks tab) or a
// `departmentId` (used from a department-wide task board, where the task's project isn't known
// yet — an extra Project select appears first, populated from that department's own projects).
export function NewTaskDialog({
  projectId: fixedProjectId,
  departmentId,
}: {
  projectId?: string;
  departmentId?: string;
}) {
  const profilesQ = useProfilesLite();
  const departmentProjectsQ = useProjects({ departmentId, enabled: !!departmentId });
  const createTask = useCreateTask();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(fixedProjectId ?? "");
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
    if (!projectId) {
      toast.error("Project is required");
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
          setProjectId(fixedProjectId ?? "");
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
          {!fixedProjectId && (
            <div>
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {(departmentProjectsQ.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
