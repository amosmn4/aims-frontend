import { useQuery } from "@tanstack/react-query";
import { api, isDemo } from "./api";
import { useAccount } from "./account";

export type WeeklyPhase = "plan" | "report";
export type WeeklyItem = {
  due?: string | undefined;
  priority?: "Urgent" | "High" | "Medium" | "Low" | undefined;
  source?: "project" | "planned" | "ad_hoc" | "contingency" | undefined;
  business?: string | undefined;
  subtasks?: { id: string; title: string; done: boolean }[] | undefined;
  id: string;
  taskId?: string | undefined;
  title: string;
  detail: string;
  status: "planned" | "completed" | "in_progress" | "pending" | "blocked" | "cancelled";
};
export type WeeklySubmission = {
  title?: string;
  leave?: { start: string; end: string; note?: string | null }[];
  summary: string;
  note?: string;
  attachments?: string[];
  items: WeeklyItem[];
  blockers: string;
  nextWeek: string;
  noWorkReason: string;
};
export type WeeklyEntry = {
  id: string;
  staffId: string;
  weekStart: string;
  phase: WeeklyPhase;
  version: number;
  submission: WeeklySubmission;
  submittedAt: string | null;
  recalledAt?: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  returnedAt: string | null;
  returnComment: string | null;
  updatedAt: string;
  late: boolean;
  editable?: boolean;
  counts: Record<string, number>;
};
export type WeeklyHistory = { items: WeeklyEntry[]; total: number; page: number; limit: number };

export function weeklyTitle(phase: WeeklyPhase, week: string) {
  const date = new Date(`${week}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7));
  const number = Math.ceil(
    ((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 1, 12)) / 86400000 + 1) / 7,
  );
  return `${phase === "plan" ? "Weekly Work Plan" : "Weekly Progress Report"} \u2013 Week ${number}`;
}

export function planItems(detail: WeeklyDetail): WeeklyItem[] {
  const existing = detail.plan?.submission.items ?? [];
  const additional = detail.tasks.filter(
    (task) =>
      task.weekStart === detail.weekStart &&
      !existing.some((item) => (item.taskId ?? item.id) === task.id),
  );
  return [
    ...existing,
    ...additional.map((task) => ({
      id: task.id,
      taskId: task.id,
      title: task.title,
      detail: "",
      status: "planned" as const,
      due: task.due,
      priority: task.priority,
      business: task.business,
      source: task.source,
      subtasks: task.subtasks,
    })),
  ];
}

export function reportItems(detail: WeeklyDetail): WeeklyItem[] {
  const outcome = (status?: string): WeeklyItem["status"] =>
    status === "Done" ? "completed" : status === "In progress" ? "in_progress" : "pending";
  const planned =
    (detail.plan?.submittedAt ? detail.plan.submission.items : []).map((item) => {
      const task = detail.tasks.find((row) => row.id === (item.taskId ?? item.id));
      return {
        ...item,
        title: task?.title ?? item.title,
        status: outcome(task?.status),
        subtasks: task?.subtasks ?? item.subtasks,
        priority: task?.priority ?? item.priority,
        due: task?.due ?? item.due,
      };
    }) ?? [];
  const additional = detail.tasks
    .filter(
      (task) =>
        (task.weekStart === detail.weekStart ||
          (!task.weekStart && task.due >= detail.weekStart && task.due <= detail.weekEnd)) &&
        !planned.some((item) => (item.taskId ?? item.id) === task.id),
    )
    .map((task) => ({
      id: crypto.randomUUID(),
      taskId: task.id,
      title: task.title,
      detail: "",
      status: outcome(task.status),
      due: task.due,
      priority: task.priority,
      source: task.source,
      business: task.business,
      subtasks: task.subtasks,
    }));
  const saved = detail.report?.submission.items ?? [];
  return [
    ...saved.map((item) => {
      const task = detail.tasks.find((row) => row.id === (item.taskId ?? item.id));
      const plan = planned.find((row) => (row.taskId ?? row.id) === (item.taskId ?? item.id));
      return {
        ...item,
        title: task?.title ?? plan?.title ?? item.title,
        subtasks: task?.subtasks ?? item.subtasks,
      };
    }),
    ...[...planned, ...additional].filter(
      (item) => !saved.some((row) => (row.taskId ?? row.id) === (item.taskId ?? item.id)),
    ),
  ];
}
export type WeeklySettings = {
  startWeek: string;
  planDeadlineDay: number;
  planDeadlineTime: string;
  planEmailDay: number;
  planEmailTime: string;
  planEmailEnabled: boolean;
  reportDeadlineDay: number;
  reportDeadlineTime: string;
  reportDeadlineFollowingWeek: boolean;
  reportEmailDay: number;
  reportEmailTime: string;
  reportEmailEnabled: boolean;
};
export type WeeklyReadiness = {
  smtpConfigured: boolean;
  scheduledEmailsEnabled: boolean;
  originReady: boolean;
};
export type WeeklySettingsResponse = {
  configured: boolean;
  version: number;
  settings: WeeklySettings;
};
export type WeeklyPerson = {
  id: string;
  name: string;
  dept: string | null;
  active: boolean;
  expected: Record<WeeklyPhase, boolean>;
  plan: WeeklyEntry | null;
  report: WeeklyEntry | null;
};
export type WeeklyOverview = {
  weekStart: string;
  weekEnd: string;
  now: string;
  configured: boolean;
  settings: WeeklySettings;
  deadlines: Record<WeeklyPhase, string>;
  staff: WeeklyPerson[];
};
export type WeeklyDetail = {
  leave?: { start: string; end: string; note?: string | null }[];
  person: { id: string; name: string; dept: string | null };
  weekStart: string;
  weekEnd: string;
  now: string;
  configured: boolean;
  reportOpensAt: string;
  deadlines: Record<WeeklyPhase, string>;
  plan: WeeklyEntry | null;
  report: WeeklyEntry | null;
  tasks: {
    id: string;
    title: string;
    project: string;
    due: string;
    status: string;
    weekStart?: string | null;
    priority?: WeeklyItem["priority"];
    source?: WeeklyItem["source"];
    business?: string;
    subtasks?: WeeklyItem["subtasks"];
  }[];
};
export type WeeklyBrief = {
  subject: string;
  html: string;
  text: string;
  data: WeeklyOverview;
};
export type WeeklyDelivery = {
  id: string;
  weekStart: string;
  phase: WeeklyPhase;
  status: string;
  attempts: number;
  sentAt: string | null;
  lastError: string | null;
  createdAt: string;
  recipient: { name: string };
};
export const weeklyLabels = {
  planned: "Planned",
  completed: "Completed",
  in_progress: "In progress",
  pending: "Pending",
  blocked: "Blocked",
  cancelled: "Cancelled",
};
export function reportingWeek(date = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const value = new Date(`${day}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
  return value.toISOString().slice(0, 10);
}
export function weeklyTime(value: string | null) {
  return value
    ? new Date(value).toLocaleString("en-GB", {
        timeZone: "Africa/Nairobi",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not submitted";
}
export function weeklyStatus(entry: WeeklyEntry | null, expected = true) {
  return entry?.reviewedAt
    ? "Reviewed"
    : entry?.submittedAt
      ? entry.late
        ? "Submitted late"
        : "Submitted"
      : entry?.returnedAt
        ? "Returned for correction"
        : entry?.recalledAt
          ? "Recalled"
          : entry
            ? "Draft, not submitted"
            : "Not submitted";
}
export function useWeekly<T>(path: string, enabled = true) {
  const { account } = useAccount();
  return useQuery({
    queryKey: ["weekly", account?.id, path],
    queryFn: () => api<T>(`/weekly/${path}`),
    enabled: !isDemo && !!account && enabled,
    refetchInterval: 60000,
    retry: false,
  });
}
export const emptyWeeklySubmission = (): WeeklySubmission => ({
  summary: "",
  items: [],
  blockers: "",
  nextWeek: "",
  noWorkReason: "",
});

export function leaveDays(rows: { start: string; end: string }[]) {
  return rows.reduce(
    (total, row) =>
      total +
      Math.round(
        (new Date(`${row.end}T12:00:00Z`).getTime() -
          new Date(`${row.start}T12:00:00Z`).getTime()) /
          86400000,
      ) +
      1,
    0,
  );
}
