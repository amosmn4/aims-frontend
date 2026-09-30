import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import {
  companyRole,
  isDeliverableLate,
  isTaskOverdue,
  loggedProgress,
  useCreateTask,
  useDeleteProject,
  useDeliverables,
  useMilestones,
  useTasks,
  useUpdateProject,
  useUpdateTask,
  MEMBER_ACCESS_LABELS,
  PROJECT_STATUS_LABELS,
  type Project,
  type ProjectStatus,
  type TaskStatus,
} from "@/features/projects/use-projects";
import { useProjectActivities } from "@/features/pipeline/use-pipeline";
import { useReports, type ReportRow } from "@/features/reports/use-reports";
import { REPORT_STATUS_LABEL, REPORT_STATUS_TONE } from "@/features/reports/report-format";
import { PROJECT_STATUS_TONE } from "@/features/hr/hr-project-table";
import { RecruitmentFunnelPanel } from "@/features/hr/recruitment-funnel-panel";
import { RecruitmentPlacementsPanel } from "@/features/hr/recruitment-placements-panel";
import { RECRUITMENT_SERVICE_LINE } from "@/features/hr/use-recruitment";
import { ClientContractPanel } from "@/features/projects/client-contract-panel";
import { DeliverablesPanel } from "@/features/projects/deliverables-panel";
import { MilestonesPanel } from "@/features/projects/milestones-panel";
import { TaskDetailDialog } from "@/features/projects/task-detail-dialog";
import { useStaffOptions } from "@/features/projects/staff-picker";
import { AttachmentsPanel } from "@/features/documents/attachments-panel";
import { TasksTab } from "@/components/project-workspace/tasks-tab";
import { SdlcPanel } from "@/components/project-workspace/overview-tab";
import { confirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { ProjectTeamDialog } from "./project-team-dialog";
import { ProjectDiscussions } from "./project-discussions";
import { ProjectReports } from "./project-reports";
import { Initials } from "./initials";

export const PROJECT_TABS = [
  "overview",
  "tasks",
  "deliverables",
  "discussions",
  "reports",
  "documents",
] as const;
export type ProjectTab = (typeof PROJECT_TABS)[number];

const TAB_LABELS: Record<ProjectTab, string> = {
  overview: "Overview",
  tasks: "Tasks",
  deliverables: "Deliverables",
  discussions: "Discussions",
  reports: "Reports",
  documents: "Files",
};

/**
 * One layout for every project, company or department: the team in the header and six tabs
 * built around documenting the work and reporting on it.
 */
export function ProjectWorkspace({
  project,
  view,
  onViewChange,
  canEditDepartmentProject = false,
  back,
  departmentActions,
}: {
  project: Project;
  view: ProjectTab;
  onViewChange: (view: ProjectTab) => void;
  /** Department projects: department write access or an edit share. */
  canEditDepartmentProject?: boolean;
  back: ReactNode;
  /** Department projects: share, edit and delete, which live with the route. */
  departmentActions?: ReactNode;
}) {
  const { profile, isAdminOrCeo } = useAuth();
  const { options, nameOf } = useStaffOptions();
  const tasksQ = useTasks({ projectId: project.id });
  const deliverablesQ = useDeliverables(project.id);
  const milestonesQ = useMilestones(project.id);
  const activitiesQ = useProjectActivities(project.id);
  const reportsQ = useReports({ kind: "project", subjectId: project.id });
  const updateTask = useUpdateTask();
  const [teamOpen, setTeamOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const isCompany = project.scope === "company";
  const role = isCompany ? companyRole(project, profile?.id, isAdminOrCeo) : null;
  const canAdd = isCompany
    ? role === "admin" || role === "lead" || role === "member"
    : canEditDepartmentProject;
  const canManageTeam = isCompany ? role === "admin" || role === "lead" : canEditDepartmentProject;
  const canReply = isCompany ? role !== null : canAdd;
  const canWriteReports = isCompany ? role === "lead" || role === "member" : canAdd;
  const leadName = project.lead_name ?? nameOf(project.lead_id) ?? "the project's lead";
  const askWho = isCompany ? leadName : `${project.department_name} staff`;

  const tasks = tasksQ.data ?? [];
  const deliverables = deliverablesQ.data ?? [];
  const milestones = milestonesQ.data ?? [];
  const posts = (activitiesQ.data ?? []).filter((a) => !a.parent_id);
  const reports = reportsQ.data ?? [];
  const pct = loggedProgress(deliverables, tasks, milestones);
  const lateTasks = tasks.filter((t) => isTaskOverdue(t));
  const lateDeliverables = deliverables.filter((d) => isDeliverableLate(d));
  const late = lateTasks.length + lateDeliverables.length;
  const teamIds = [
    ...new Set([project.lead_id, ...project.members.map((m) => m.user_id)].filter(Boolean)),
  ] as string[];
  const assignable = isCompany
    ? teamIds.filter((id) => project.members.find((m) => m.user_id === id)?.access !== "viewer")
    : options.map((o) => o.id);
  const profileMap = new Map(options.map((p) => [p.id, p.name]));
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  const counts: Partial<Record<ProjectTab, number>> = {
    tasks: tasks.filter((t) => t.status !== "completed").length,
    deliverables: deliverables.length,
    discussions: posts.length,
    reports: reports.length,
  };

  const lockNote = !canAdd && (
    <p className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
      {isCompany
        ? `You can view this project. Ask ${leadName} to make you a member to add work.`
        : `You can view this project. Only ${project.department_name} staff, or people it is shared with for editing, can add work.`}
    </p>
  );

  const moveTask = (taskId: string, status: TaskStatus) =>
    updateTask.mutate(
      { id: taskId, status },
      { onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed") },
    );

  return (
    <div className="pipeline-scope space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {back}
        <div className="flex shrink-0 flex-wrap gap-1">
          {isCompany && canManageTeam && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit project
            </Button>
          )}
          {!isCompany && departmentActions}
        </div>
      </div>

      <div className="ws-panel !mt-0 space-y-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{project.name}</h1>
          {project.description && (
            <p className="mt-1 max-w-3xl whitespace-pre-line text-sm text-muted-foreground">
              {project.description}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-medium",
              PROJECT_STATUS_TONE[project.status],
            )}
          >
            {PROJECT_STATUS_LABELS[project.status]}
          </span>
          <span>{isCompany ? "Company project" : project.department_name}</span>
          {project.service_line_name && <span>{project.service_line_name}</span>}
          {project.client_name && <span>Client: {project.client_name}</span>}
          {(project.start_date || project.end_date) && (
            <span>
              {formatDate(project.start_date, "No start date")} –{" "}
              {formatDate(project.end_date, "no end date")}
            </span>
          )}
          {isCompany && <span>Lead: {leadName}</span>}
          <span className="tabular-nums">{pct}% done</span>
          {late > 0 && <span className="font-semibold text-destructive">{late} late</span>}
          {role && role !== "admin" && (
            <span className="rounded-full border px-2 py-0.5">
              You: {MEMBER_ACCESS_LABELS[role]}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {teamIds.length > 0 && (
            <div className="flex">
              {teamIds.slice(0, 8).map((id, i) => (
                <Initials
                  key={id}
                  name={nameOf(id) ?? "?"}
                  className={cn("border-2 border-card", i > 0 && "-ml-2")}
                />
              ))}
            </div>
          )}
          <span className="text-xs text-muted-foreground">
            {teamIds.length === 0
              ? "No team added yet"
              : `${teamIds.length} ${teamIds.length === 1 ? "person" : "people"} on the team`}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setTeamOpen(true)}>
            <Users className="mr-1 h-3.5 w-3.5" />
            {canManageTeam ? "Manage team" : "See team"}
          </Button>
        </div>
      </div>

      <div className="ws-tabbar" role="tablist" aria-label="Project sections">
        {PROJECT_TABS.map((t) => {
          const n = counts[t];
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={view === t}
              onClick={() => onViewChange(t)}
              className={`ws-tabbtn ${view === t ? "active" : ""}`}
            >
              {TAB_LABELS[t]}
              {!!n && (
                <span className="ml-1.5 rounded-full bg-secondary px-1.5 text-[11px] tabular-nums text-muted-foreground">
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {view === "overview" && (
        <div className="space-y-3">
          <ProjectOverview
            pct={pct}
            tasksDone={tasks.filter((t) => t.status === "completed").length}
            taskCount={tasks.length}
            delivered={deliverables.filter((d) => d.status === "delivered").length}
            deliverableCount={deliverables.length}
            late={[
              ...lateTasks.map((t) => ({
                id: t.id,
                title: t.title,
                kind: "Task" as const,
                who: nameOf(t.assignee_id),
                due: t.due_date,
              })),
              ...lateDeliverables.map((d) => ({
                id: d.id,
                title: d.title,
                kind: "Deliverable" as const,
                who: null,
                due: d.due_date,
              })),
            ]}
            decisions={posts.filter((p) => p.is_decision)}
            latestReport={reports.find((r) => r.status !== "draft") ?? null}
            onOpen={onViewChange}
          />
          <MilestonesPanel projectId={project.id} milestones={milestones} canManage={canAdd} />
          {!isCompany && <ClientContractPanel project={project} canManage={canAdd} />}
          {project.service_line_code === RECRUITMENT_SERVICE_LINE && (
            <>
              <div className="ws-panel !mt-0">
                <h3>Recruitment numbers</h3>
                <RecruitmentFunnelPanel projectId={project.id} canManage={canAdd} />
              </div>
              <div className="ws-panel !mt-0">
                <RecruitmentPlacementsPanel projectId={project.id} canManage={canAdd} />
              </div>
            </>
          )}
          {project.department_code === "it" && project.methodology === "system_development" && (
            <SdlcPanel project={project} canManage={canAdd} />
          )}
        </div>
      )}

      {view === "tasks" && (
        <div className="space-y-3">
          {lockNote}
          {canAdd && (
            <QuickAddTask
              projectId={project.id}
              people={assignable}
              nameOf={nameOf}
              meId={profile?.id}
            />
          )}
          {tasksQ.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <TasksTab
              tasks={tasks}
              profileMap={profileMap}
              canMoveTask={(t) => canAdd || t.assignee_id === profile?.id}
              onTaskClick={(t) => setSelectedTaskId(t.id)}
              onStatusChange={moveTask}
            />
          )}
        </div>
      )}

      {view === "deliverables" && (
        <div className="space-y-3">
          {lockNote}
          <DeliverablesPanel projectId={project.id} canManage={canAdd} />
        </div>
      )}

      {view === "discussions" && (
        <div className="ws-panel !mt-0">
          <ProjectDiscussions
            projectId={project.id}
            canPost={canAdd}
            canReply={canReply}
            askWho={askWho}
          />
        </div>
      )}

      {view === "reports" && <ProjectReports project={project} canWrite={canWriteReports} />}

      {view === "documents" && (
        <div className="space-y-3">
          {lockNote}
          <div className="ws-panel !mt-0">
            <AttachmentsPanel
              resourceType="project"
              resourceId={project.id}
              canManage={canAdd}
              title="Files"
            />
          </div>
        </div>
      )}

      <TaskDetailDialog
        task={selectedTask}
        onClose={() => setSelectedTaskId(null)}
        canManageDocuments={canAdd}
        projectTasks={tasks}
      />
      <ProjectTeamDialog
        project={project}
        open={teamOpen}
        canManage={canManageTeam}
        onClose={() => setTeamOpen(false)}
      />
      {editing && <EditCompanyProjectDialog project={project} onClose={() => setEditing(false)} />}
    </div>
  );
}

type LateItem = {
  id: string;
  title: string;
  kind: "Task" | "Deliverable";
  who: string | null;
  due: string | null;
};

function ProjectOverview({
  pct,
  tasksDone,
  taskCount,
  delivered,
  deliverableCount,
  late,
  decisions,
  latestReport,
  onOpen,
}: {
  pct: number;
  tasksDone: number;
  taskCount: number;
  delivered: number;
  deliverableCount: number;
  late: LateItem[];
  decisions: {
    id: string;
    summary: string;
    created_by_name: string | null;
    decided_at: string | null;
  }[];
  latestReport: ReportRow | null;
  onOpen: (tab: ProjectTab) => void;
}) {
  const stats = [
    { label: "Done overall", value: `${pct}%` },
    { label: "Deliverables delivered", value: `${delivered}/${deliverableCount}` },
    { label: "Tasks done", value: `${tasksDone}/${taskCount}` },
    { label: "Late", value: String(late.length), bad: late.length > 0 },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="ws-panel !mt-0">
            <div className={cn("text-2xl font-semibold tabular-nums", s.bad && "text-destructive")}>
              {s.value}
            </div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="ws-panel !mt-0">
          <h3>Needs attention</h3>
          {late.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nothing is late.</p>
          ) : (
            <ul className="mt-2 divide-y rounded-md border">
              {late.map((i) => (
                <li key={`${i.kind}-${i.id}`}>
                  <button
                    type="button"
                    onClick={() => onOpen(i.kind === "Task" ? "tasks" : "deliverables")}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-secondary/50"
                  >
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      Late
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{i.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {i.kind}
                        {i.who ? ` · ${i.who}` : ""}
                        {i.due ? ` · was due ${formatDate(i.due)}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ws-panel !mt-0">
          <div className="flex items-center justify-between gap-2">
            <h3>Decisions</h3>
            <Button size="sm" variant="ghost" onClick={() => onOpen("discussions")}>
              All discussions
            </Button>
          </div>
          {decisions.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No decisions recorded yet. Mark one in Discussions.
            </p>
          ) : (
            <ul className="mt-2 divide-y rounded-md border">
              {decisions.map((d) => (
                <li key={d.id} className="px-3 py-2 text-sm">
                  <span className="block whitespace-pre-line">{d.summary}</span>
                  <span className="block text-xs text-muted-foreground">
                    {d.created_by_name ?? "AIMS"}
                    {d.decided_at ? ` · decided ${formatDate(d.decided_at)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="ws-panel !mt-0">
        <div className="flex items-center justify-between gap-2">
          <h3>Latest report</h3>
          <Button size="sm" variant="ghost" onClick={() => onOpen("reports")}>
            All reports
          </Button>
        </div>
        {latestReport ? (
          <Link
            to="/reports/$reportId"
            params={{ reportId: latestReport.id }}
            className="mt-2 flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-sm hover:bg-secondary/50"
          >
            <span className="min-w-0 flex-1 truncate font-medium">{latestReport.title}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                REPORT_STATUS_TONE[latestReport.status],
              )}
            >
              {REPORT_STATUS_LABEL[latestReport.status]}
            </span>
          </Link>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No report has been shared yet.</p>
        )}
      </div>
    </div>
  );
}

function QuickAddTask({
  projectId,
  people,
  nameOf,
  meId,
}: {
  projectId: string;
  people: string[];
  nameOf: (id: string | null | undefined) => string | null;
  meId?: string;
}) {
  const createTask = useCreateTask();
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState(meId && people.includes(meId) ? meId : "");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string>();

  return (
    <form
      noValidate
      className="ws-panel !mt-0 space-y-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) {
          setError("Say what needs doing first.");
          return;
        }
        setError(undefined);
        createTask.mutate(
          {
            projectId,
            title: title.trim(),
            priority: "medium",
            assigneeId: assigneeId || undefined,
            dueDate: dueDate || undefined,
          },
          {
            onSuccess: () => {
              const who = assigneeId && assigneeId !== meId ? nameOf(assigneeId) : null;
              toast.success(who ? `Task added and assigned to ${who}` : "Task added");
              setTitle("");
              setDueDate("");
            },
            onError: (err) =>
              toast.error(err instanceof Error ? err.message : "Couldn't add the task"),
          },
        );
      }}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(12rem,1fr)_12rem_10rem_auto]">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task… e.g. Send the draft contract"
          aria-label="New task"
          aria-invalid={!!error}
        />
        <select
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          aria-label="Assign to"
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">Not assigned</option>
          {people.map((id) => (
            <option key={id} value={id}>
              {nameOf(id) ?? "Someone"}
            </option>
          ))}
        </select>
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          aria-label="Due date"
        />
        <Button type="submit" disabled={createTask.isPending}>
          {createTask.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          <span className="ml-1">Add task</span>
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

function EditCompanyProjectDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const navigate = useNavigate();
  const update = useUpdateProject();
  const del = useDeleteProject();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [startDate, setStartDate] = useState(project.start_date ?? "");
  const [endDate, setEndDate] = useState(project.end_date ?? "");
  const [error, setError] = useState<string>();
  const dirty =
    name !== project.name ||
    description !== (project.description ?? "") ||
    status !== project.status ||
    startDate !== (project.start_date ?? "") ||
    endDate !== (project.end_date ?? "");
  const { guardClose } = useUnsavedChanges(dirty);

  const save = () => {
    if (!name.trim()) {
      setError("The project needs a name.");
      return;
    }
    update.mutate(
      {
        id: project.id,
        name: name.trim(),
        description: description.trim() || null,
        status,
        startDate: startDate || null,
        endDate: endDate || null,
      },
      {
        onSuccess: () => {
          toast.success("Project updated");
          onClose();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save"),
      },
    );
  };

  const remove = async () => {
    const ok = await confirmDialog({
      title: `Delete "${project.name}"?`,
      description:
        "Its tasks, deliverables, discussions and files go with it, and the team loses access. This can't be undone.",
      confirmLabel: "Delete project",
      destructive: true,
    });
    if (!ok) return;
    del.mutate(project.id, {
      onSuccess: () => {
        toast.success("Project deleted");
        onClose();
        navigate({ to: "/projects/company" });
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't delete it"),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onClose)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
          </DialogHeader>
          <FormField id="ecp-name" label="Project name" required error={error}>
            <Input id="ecp-name" value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField id="ecp-desc" label="What it is for">
            <Textarea
              id="ecp-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField id="ecp-status" label="Status">
              <select
                id="ecp-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                {Object.entries(PROJECT_STATUS_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="ecp-start" label="Starts">
              <Input
                id="ecp-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </FormField>
            <FormField id="ecp-end" label="Ends">
              <Input
                id="ecp-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </FormField>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={remove}
              disabled={del.isPending}
            >
              <Trash2 className="mr-1 h-4 w-4" /> Delete project
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => guardClose(onClose)}>
                Cancel
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
