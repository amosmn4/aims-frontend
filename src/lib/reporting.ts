import { useQuery } from "@tanstack/react-query";
import { api, isDemo } from "./api";
import type { WeeklyEntry } from "./weekly";
export { plainText } from "./text";

export type ReportingView =
  | "overview"
  | "weekly-plan"
  | "weekly-report"
  | "submissions"
  | "team-plans"
  | "team-reports"
  | "performance";
export type ReportingRow = {
  id: string;
  staffId: string;
  name: string;
  dept: string | null;
  type: "plan" | "report" | "monthly";
  period: string;
  date: string;
  updatedAt?: string;
  status: string;
  title: string;
  summary: string;
  taskCount: number;
  updates: number;
  entry: WeeklyEntry | null;
  historical: boolean;
  scheduledAt: string | null;
  event: string;
};
export type StaffPerformance = {
  id: string;
  name: string;
  dept: string | null;
  plans: number;
  reports: number;
  expectedPlans: number;
  expectedReports: number;
  tasks: number;
  completed: number;
  completion: number;
  activity: string | null;
};
export type ReportingWorkspace = {
  from: string;
  to: string;
  now: string;
  rows: ReportingRow[];
  performance: StaffPerformance[];
  total: number;
  page: number;
  limit: number;
  metrics: {
    tasks: number;
    completed: number;
    staff: number;
    plans: number;
    reports: number;
    awaiting: number;
    expectedPlans: number;
    expectedReports: number;
    overdueReports: number;
  };
  activity: {
    id: string;
    action: string;
    date: string;
    staffId: string;
    name: string;
    week: string;
    phase: "plan" | "report";
  }[];
};
export function reportingDate(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
export function weekEnd(week: string, days = 6) {
  return new Date(new Date(`${week}T12:00:00Z`).getTime() + days * 86400000)
    .toISOString()
    .slice(0, 10);
}

export type SubmissionScheduleRecord = {
  id: string;
  kind: string;
  target: string;
  runAt: string;
  status: string;
  lastError: string | null;
};
export function useSubmissionSchedules() {
  return useQuery({
    queryKey: ["submission-schedules"],
    queryFn: () => api<SubmissionScheduleRecord[]>("/submission-schedules"),
    enabled: !isDemo,
    refetchInterval: 30000,
  });
}
