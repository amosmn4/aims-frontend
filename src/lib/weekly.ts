import { useQuery } from "@tanstack/react-query";
import { api, isDemo } from "./api";
import { useAccount } from "./account";

export type WeeklyPhase = "plan" | "report";
export type WeeklyItem = {
  id: string;
  taskId?: string;
  title: string;
  detail: string;
  status: "planned" | "completed" | "in_progress" | "pending" | "blocked" | "cancelled";
};
export type WeeklySubmission = {
  summary: string;
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
  reviewedAt: string | null;
  reviewComment: string | null;
  returnedAt: string | null;
  returnComment: string | null;
  updatedAt: string;
  late: boolean;
  counts: Record<string, number>;
};
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
  person: { id: string; name: string; dept: string | null };
  weekStart: string;
  weekEnd: string;
  now: string;
  configured: boolean;
  reportOpensAt: string;
  deadlines: Record<WeeklyPhase, string>;
  plan: WeeklyEntry | null;
  report: WeeklyEntry | null;
  tasks: { id: string; title: string; project: string; due: string; status: string }[];
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
