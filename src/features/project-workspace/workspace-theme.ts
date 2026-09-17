// Color tokens for the Project Workspace tabs, lifted from amsol_project_workspace.html's own
// inline STATUS_COLORS / PRIORITY_COLORS / HEALTH / typeColor / sevColor JS objects — reusing
// the same hex constants already established for the Pipeline module (pipeline-theme.ts) since
// both prototypes share one palette.
import {
  PIPELINE_SLATE_LIGHT,
  PIPELINE_GOLD,
  PIPELINE_GOLD_SOFT,
  PIPELINE_TEAL,
  PIPELINE_TEAL_SOFT,
  PIPELINE_CORAL,
  PIPELINE_CORAL_SOFT,
  PIPELINE_BLUE,
  PIPELINE_BLUE_SOFT,
  PIPELINE_PURPLE,
  PIPELINE_PURPLE_SOFT,
} from "@/features/pipeline/pipeline-theme";
import type { TaskStatus, TaskPriority, ProjectHealth } from "@/features/projects/use-projects";
import type {
  ProjectRaidType,
  ProjectRaidSeverity,
} from "@/features/project-workspace/use-project-workspace";

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  not_started: PIPELINE_SLATE_LIGHT,
  in_progress: PIPELINE_GOLD,
  review: PIPELINE_BLUE,
  blocked: PIPELINE_CORAL,
  completed: PIPELINE_TEAL,
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, { bg: string; text: string }> = {
  low: { bg: PIPELINE_PURPLE_SOFT, text: PIPELINE_PURPLE },
  medium: { bg: PIPELINE_GOLD_SOFT, text: "#8C5F1D" },
  high: { bg: PIPELINE_CORAL_SOFT, text: PIPELINE_CORAL },
  urgent: { bg: PIPELINE_CORAL, text: "#ffffff" },
};

export const HEALTH_STYLES: Record<ProjectHealth, { color: string; label: string }> = {
  green: { color: PIPELINE_TEAL, label: "On track" },
  amber: { color: PIPELINE_GOLD, label: "At risk" },
  red: { color: PIPELINE_CORAL, label: "Late / off track" },
};

export const RAID_TYPE_LABELS: Record<ProjectRaidType, string> = {
  risk: "Risk",
  issue: "Issue",
  dependency: "Dependency",
  assumption: "Assumption",
};

export const RAID_TYPE_COLORS: Record<ProjectRaidType, { bg: string; c: string }> = {
  risk: { bg: PIPELINE_CORAL_SOFT, c: PIPELINE_CORAL },
  issue: { bg: PIPELINE_GOLD_SOFT, c: PIPELINE_GOLD },
  dependency: { bg: PIPELINE_BLUE_SOFT, c: PIPELINE_BLUE },
  assumption: { bg: PIPELINE_PURPLE_SOFT, c: PIPELINE_PURPLE },
};

export const RAID_SEVERITY_COLORS: Record<ProjectRaidSeverity, { bg: string; c: string }> = {
  high: { bg: PIPELINE_CORAL_SOFT, c: PIPELINE_CORAL },
  medium: { bg: PIPELINE_GOLD_SOFT, c: PIPELINE_GOLD },
  low: { bg: PIPELINE_TEAL_SOFT, c: PIPELINE_TEAL },
};

export const MILESTONE_STATUS_STYLES: Record<
  "done" | "atrisk" | "upcoming",
  { bg: string; c: string; label: string }
> = {
  done: { bg: PIPELINE_TEAL_SOFT, c: PIPELINE_TEAL, label: "Complete" },
  atrisk: { bg: PIPELINE_GOLD_SOFT, c: PIPELINE_GOLD, label: "At Risk" },
  upcoming: { bg: "#F1F2EC", c: PIPELINE_SLATE_LIGHT, label: "Upcoming" },
};

export const CAL_EVENT_STYLES: Record<
  "deadline" | "milestone" | "meeting",
  { bg: string; c: string }
> = {
  deadline: { bg: PIPELINE_CORAL_SOFT, c: PIPELINE_CORAL },
  milestone: { bg: PIPELINE_GOLD_SOFT, c: PIPELINE_GOLD },
  meeting: { bg: PIPELINE_BLUE_SOFT, c: PIPELINE_BLUE },
};

export function money(n: number, currency = "KES"): string {
  return `${currency} ${Math.round(n).toLocaleString("en-KE")}`;
}

export function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function daysBetween(a: string | Date, b: string | Date): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
