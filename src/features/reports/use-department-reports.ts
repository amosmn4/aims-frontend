import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import type { ReportFigure as Figure, ReportSection } from "./use-reports";

export type ReportStatus = "draft" | "submitted" | "changes_requested" | "approved" | "shared";
export type ReportPeriodType = "monthly" | "quarterly" | "annual" | "other";
export type ReportMessageKind =
  "comment" | "submitted" | "resubmitted" | "changes_requested" | "approved";

interface UserRef {
  id: string;
  fullName: string | null;
  email: string;
}

export interface ReportMessage {
  id: string;
  kind: ReportMessageKind;
  body: string;
  parentId: string | null;
  createdAt: string;
  author: UserRef;
}

export interface DepartmentReportRow {
  id: string;
  title: string;
  periodType: ReportPeriodType;
  periodStart: string;
  periodEnd: string;
  status: ReportStatus;
  submittedAt: string | null;
  updatedAt: string;
  department: { id: string; name: string; code: string };
  creator: UserRef;
  lastMessage: ReportMessage | null;
}

export interface InboxItem {
  kind: "department_report" | "finance_report";
  id: string;
  title: string;
  department: { id: string | null; name: string; code: string } | null;
  reportKind?: "department" | "project" | "individual";
  decidedBy?: "ceo" | "department_head" | "none";
  periodStart: string;
  periodEnd: string;
  status: ReportStatus;
  resubmitted: boolean;
  submittedAt: string | null;
  updatedAt: string;
  author: UserRef | null;
  lastMessage: {
    body: string;
    kind: ReportMessageKind;
    createdAt: string;
    authorName: string | null;
  } | null;
  figures: Figure[];
  sections?: ReportSection[];
  summary: string | null;
}

const KEY = ["department-reports"];

export function useDepartmentReports(departmentId?: string) {
  return useQuery({
    queryKey: [...KEY, "list", departmentId ?? "all"],
    enabled: departmentId !== "",
    queryFn: () =>
      apiJson<DepartmentReportRow[]>(
        `/department-reports${departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : ""}`,
      ),
  });
}

export function useReportsInbox(enabled = true) {
  return useQuery({
    queryKey: ["reports-inbox"],
    enabled,
    queryFn: () => apiJson<InboxItem[]>("/reports-inbox"),
  });
}

export type ReportEmailKey =
  "report_submitted" | "board_pack" | "pipeline_weekly" | "debtors_fortnightly" | "water_monthly";

export const REPORT_EMAILS: { key: ReportEmailKey; label: string; when: string }[] = [
  {
    key: "report_submitted",
    label: "A department submits a report",
    when: "As soon as it arrives",
  },
  { key: "board_pack", label: "Monthly board pack", when: "1st of each month, 7:00" },
  {
    key: "pipeline_weekly",
    label: "Pipelines summary (client requests, tenders, projects)",
    when: "Every Monday, 7:00",
  },
  { key: "debtors_fortnightly", label: "Debtors ageing", when: "Every other Friday, 7:00" },
  { key: "water_monthly", label: "Water Project summary", when: "1st of each month, 7:00" },
];

export function useReportEmailSubscriptions(enabled = true) {
  return useQuery({
    queryKey: ["report-email-subscriptions"],
    enabled,
    queryFn: () =>
      apiJson<{ reportKey: ReportEmailKey; enabled: boolean }[]>("/report-email-subscriptions"),
  });
}

export function useSetReportEmailSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reportKey: ReportEmailKey; enabled: boolean }) =>
      apiJson("/report-email-subscriptions", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report-email-subscriptions"] }),
  });
}
