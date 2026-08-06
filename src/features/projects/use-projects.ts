import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "cancelled";
export type ProjectHealth = "green" | "amber" | "red";
export type TaskStatus = "not_started" | "in_progress" | "review" | "blocked" | "completed";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type SdlcStage =
  "requirements" | "design" | "development" | "testing" | "deployment" | "maintenance";

export const SYSTEM_DEVELOPMENT_METHODOLOGY = "system_development";

export const SDLC_STAGES: SdlcStage[] = [
  "requirements",
  "design",
  "development",
  "testing",
  "deployment",
  "maintenance",
];

export const SDLC_STAGE_LABELS: Record<SdlcStage, string> = {
  requirements: "Requirements",
  design: "Design",
  development: "Development",
  testing: "Testing",
  deployment: "Deployment",
  maintenance: "Maintenance",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PROJECT_HEALTH_LABELS: Record<ProjectHealth, string> = {
  green: "On Track",
  amber: "At Risk",
  red: "Off Track",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  review: "In Review",
  blocked: "Blocked",
  completed: "Completed",
};

export const TASK_STATUS_COLUMNS: TaskStatus[] = [
  "not_started",
  "in_progress",
  "review",
  "blocked",
  "completed",
];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const TASK_PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "bg-secondary text-secondary-foreground",
  medium: "bg-primary/10 text-primary",
  high: "bg-warning/15 text-warning",
  urgent: "bg-destructive/15 text-destructive",
};

export type Project = {
  id: string;
  name: string;
  description: string | null;
  client_id: string | null;
  client_name: string | null;
  contract_id: string | null;
  contract_number: string | null;
  tender_id: string | null;
  tender_title: string | null;
  client_request_id: string | null;
  client_request_title: string | null;
  department_id: string;
  department_name: string;
  status: ProjectStatus;
  methodology: string | null;
  sdlc_stage: SdlcStage | null;
  health: ProjectHealth;
  budget: number | null;
  start_date: string | null;
  end_date: string | null;
  task_count: number | null;
  created_at: string;
};

export type TaskDependencyRef = { id: string; title: string; status: TaskStatus };

export type Task = {
  id: string;
  project_id: string;
  project_name: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  phase: string | null;
  estimated_hours: number | null;
  actual_hours: number;
  start_date: string | null;
  due_date: string | null;
  position: number;
  depends_on: TaskDependencyRef[];
  created_at: string;
};

export type Milestone = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  due_date: string;
  is_complete: boolean;
  created_at: string;
};

export type TaskComment = {
  id: string;
  task_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type ProjectFinancials =
  | { hasContract: false }
  | {
      hasContract: true;
      contractId: string;
      budgets: {
        id: string;
        periodStart: string;
        periodEnd: string;
        budgetedAmount: number;
        currency: string;
      }[];
      invoices: {
        id: string;
        invoiceNumber: string;
        issueDate: string;
        dueDate: string;
        status: string;
        total: number;
        directCost: number;
        paid: number;
        outstanding: number;
      }[];
      totals: {
        totalBudgeted: number;
        totalInvoiced: number;
        totalDirectCost: number;
        totalPaid: number;
        totalOutstanding: number;
        margin: number;
      };
    };

type BackendProject = {
  id: string;
  name: string;
  description: string | null;
  clientId: string | null;
  client?: { name: string } | null;
  contractId: string | null;
  contract?: { id: string; contractNumber: string } | null;
  tenderId?: string | null;
  tender?: { id: string; referenceNumber: string | null; title: string } | null;
  clientRequestId?: string | null;
  clientRequest?: { id: string; referenceNumber: string | null; title: string } | null;
  departmentId: string;
  department?: { name: string } | null;
  status: ProjectStatus;
  methodology: string | null;
  sdlcStage: SdlcStage | null;
  health: ProjectHealth;
  budget: string | number | null;
  startDate: string | null;
  endDate: string | null;
  _count?: { tasks: number };
  createdAt: string;
};

type BackendTaskDependencyRef = { id: string; title: string; status: TaskStatus };

type BackendTask = {
  id: string;
  projectId: string;
  project?: { name: string } | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  phase: string | null;
  estimatedHours: string | number | null;
  actualHours: string | number | null;
  startDate: string | null;
  dueDate: string | null;
  position: number;
  dependsOn?: { dependsOn: BackendTaskDependencyRef }[];
  createdAt: string;
};

type BackendMilestone = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  dueDate: string;
  isComplete: boolean;
  createdAt: string;
};

type BackendTaskComment = {
  id: string;
  taskId: string;
  authorId: string;
  author?: { fullName: string | null; email: string } | null;
  body: string;
  createdAt: string;
  updatedAt: string;
};

function mapProject(p: BackendProject): Project {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    client_id: p.clientId,
    client_name: p.client?.name ?? null,
    contract_id: p.contractId,
    contract_number: p.contract?.contractNumber ?? null,
    tender_id: p.tender?.id ?? null,
    tender_title: p.tender ? (p.tender.referenceNumber ?? p.tender.title) : null,
    client_request_id: p.clientRequest?.id ?? null,
    client_request_title: p.clientRequest
      ? (p.clientRequest.referenceNumber ?? p.clientRequest.title)
      : null,
    department_id: p.departmentId,
    department_name: p.department?.name ?? "—",
    status: p.status,
    methodology: p.methodology,
    sdlc_stage: p.sdlcStage,
    health: p.health,
    budget: p.budget == null ? null : Number(p.budget),
    start_date: p.startDate ? p.startDate.slice(0, 10) : null,
    end_date: p.endDate ? p.endDate.slice(0, 10) : null,
    task_count: p._count?.tasks ?? null,
    created_at: p.createdAt,
  };
}

function mapTask(t: BackendTask): Task {
  return {
    id: t.id,
    project_id: t.projectId,
    project_name: t.project?.name ?? null,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assignee_id: t.assigneeId,
    phase: t.phase,
    estimated_hours: t.estimatedHours == null ? null : Number(t.estimatedHours),
    actual_hours: Number(t.actualHours ?? 0),
    start_date: t.startDate ? t.startDate.slice(0, 10) : null,
    due_date: t.dueDate ? t.dueDate.slice(0, 10) : null,
    position: t.position,
    depends_on: (t.dependsOn ?? []).map((d) => d.dependsOn),
    created_at: t.createdAt,
  };
}

function mapMilestone(m: BackendMilestone): Milestone {
  return {
    id: m.id,
    project_id: m.projectId,
    title: m.title,
    description: m.description,
    due_date: m.dueDate.slice(0, 10),
    is_complete: m.isComplete,
    created_at: m.createdAt,
  };
}

function mapComment(c: BackendTaskComment): TaskComment {
  return {
    id: c.id,
    task_id: c.taskId,
    author_id: c.authorId,
    author_name: c.author?.fullName ?? c.author?.email ?? "—",
    body: c.body,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

function toQuery(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/* ---------- Projects ---------- */

export function useProjects(filters?: {
  departmentId?: string;
  status?: ProjectStatus;
  clientId?: string;
  sharedWithMe?: boolean;
}) {
  const qs = toQuery({
    departmentId: filters?.departmentId,
    status: filters?.status,
    clientId: filters?.clientId,
    sharedWithMe: filters?.sharedWithMe ? "true" : undefined,
  });
  return useQuery({
    queryKey: [
      "projects",
      filters?.departmentId,
      filters?.status,
      filters?.clientId,
      filters?.sharedWithMe,
    ],
    queryFn: async () => (await apiJson<BackendProject[]>(`/projects${qs}`)).map(mapProject),
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ["projects", id],
    enabled: !!id,
    queryFn: async () => mapProject(await apiJson<BackendProject>(`/projects/${id}`)),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      description?: string;
      clientId?: string;
      contractId?: string;
      departmentId: string;
      status?: ProjectStatus;
      methodology?: string;
      health?: ProjectHealth;
      budget?: number;
      startDate?: string;
      endDate?: string;
    }) => apiJson("/projects", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      apiJson(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects", vars.id] });
      qc.invalidateQueries({ queryKey: ["pipeline-projects"] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

/* ---------- Tasks ---------- */

export function useTasks(filters?: {
  projectId?: string;
  departmentId?: string;
  assigneeId?: string;
  status?: TaskStatus;
}) {
  const qs = toQuery({
    projectId: filters?.projectId,
    departmentId: filters?.departmentId,
    assigneeId: filters?.assigneeId,
    status: filters?.status,
  });
  return useQuery({
    queryKey: [
      "tasks",
      filters?.projectId,
      filters?.departmentId,
      filters?.assigneeId,
      filters?.status,
    ],
    queryFn: async () => (await apiJson<BackendTask[]>(`/tasks${qs}`)).map(mapTask),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      projectId: string;
      title: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      assigneeId?: string;
      phase?: string;
      estimatedHours?: number;
      actualHours?: number;
      startDate?: string;
      dueDate?: string;
      position?: number;
    }) => apiJson("/tasks", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      apiJson(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useAddTaskDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, dependsOnId }: { taskId: string; dependsOnId: string }) =>
      apiJson(`/tasks/${taskId}/dependencies/${dependsOnId}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useRemoveTaskDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, dependsOnId }: { taskId: string; dependsOnId: string }) =>
      apiJson(`/tasks/${taskId}/dependencies/${dependsOnId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

/* ---------- Milestones ---------- */

export function useMilestones(projectId: string | undefined) {
  return useQuery({
    queryKey: ["milestones", projectId],
    enabled: !!projectId,
    queryFn: async () =>
      (await apiJson<BackendMilestone[]>(`/projects/${projectId}/milestones`)).map(mapMilestone),
  });
}

export function useCreateMilestone(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; description?: string; dueDate: string }) =>
      apiJson(`/projects/${projectId}/milestones`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones", projectId] }),
  });
}

export function useUpdateMilestone(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      apiJson(`/projects/milestones/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones", projectId] }),
  });
}

export function useDeleteMilestone(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/projects/milestones/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones", projectId] }),
  });
}

/* ---------- Task comments ---------- */

export function useTaskComments(taskId: string | undefined) {
  return useQuery({
    queryKey: ["task-comments", taskId],
    enabled: !!taskId,
    queryFn: async () =>
      (await apiJson<BackendTaskComment[]>(`/tasks/${taskId}/comments`)).map(mapComment),
  });
}

export function useCreateComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiJson(`/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-comments", taskId] }),
  });
}

export function useDeleteComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      apiJson(`/tasks/comments/${commentId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-comments", taskId] }),
  });
}

/* ---------- Project financials ---------- */

export function useProjectFinancials(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-financials", projectId],
    enabled: !!projectId,
    queryFn: () => apiJson<ProjectFinancials>(`/projects/${projectId}/financials`),
  });
}
