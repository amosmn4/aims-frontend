// Color tokens for the Project Workspace tabs, lifted from amsol_project_workspace.html's own
// inline STATUS_COLORS / PRIORITY_COLORS / HEALTH / typeColor / sevColor JS objects — reusing
// the same hex constants already established for the Pipeline module (pipeline-theme.ts) since
// both prototypes share one palette.
import {
  PIPELINE_SLATE_LIGHT,
  PIPELINE_GOLD,
  PIPELINE_GOLD_SOFT,
  PIPELINE_TEAL,
  PIPELINE_CORAL,
  PIPELINE_CORAL_SOFT,
  PIPELINE_BLUE,
  PIPELINE_PURPLE,
  PIPELINE_PURPLE_SOFT,
} from "@/features/pipeline/pipeline-theme";
import type { TaskStatus, TaskPriority } from "@/features/projects/use-projects";

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
