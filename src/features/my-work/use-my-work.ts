import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import type { TaskStatus, ProjectHealth } from "@/features/projects/use-projects";
import type { ClientRequestStage } from "@/features/client-requests/use-client-requests";
import type { TicketPriority, TicketStatus } from "@/features/it/use-tickets";

export type MyReportStatus =
  "not_started" | "draft" | "submitted" | "changes_requested" | "approved";

export interface MyWorkTask {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  overdue: boolean;
  project: { id: string; name: string };
}

export interface MyWorkRequest {
  id: string;
  title: string;
  referenceNumber: string | null;
  stage: ClientRequestStage;
  stageChangedAt: string;
  daysInStage: number;
  clientName: string | null;
}

export interface MyWorkProject {
  id: string;
  name: string;
  health: ProjectHealth;
  endDate: string | null;
  late: boolean;
  department: { code: string | null } | null;
}

export interface MyWorkTicket {
  id: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
}

export interface MyWorkReport {
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  /** "YYYY-MM" */
  period: string;
  status: MyReportStatus;
  reportId: string | null;
  financeReportId: string | null;
  /** "YYYY-MM-DD" */
  dueDate: string;
}

export interface MyWork {
  tasks: { open: number; overdue: number; dueSoon: number; items: MyWorkTask[] };
  requests: MyWorkRequest[];
  projects: MyWorkProject[];
  tickets: { assigned: MyWorkTicket[]; raisedOpen: number };
  reports: MyWorkReport[];
  reviews: { waiting: number } | null;
}

export function useMyWork(enabled = true) {
  return useQuery({
    queryKey: ["my-work"],
    enabled,
    staleTime: 60_000,
    queryFn: () => apiJson<MyWork>("/my-work"),
  });
}
