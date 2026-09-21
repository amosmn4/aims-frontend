import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export type ReportStatus = "draft" | "submitted" | "changes_requested" | "approved";
export type ReportPeriodType = "monthly" | "quarterly" | "annual" | "other";
export type ReportMessageKind =
  "comment" | "submitted" | "resubmitted" | "changes_requested" | "approved";

export interface ReportFigure {
  label: string;
  value: string;
}

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

export interface DepartmentReportDetail extends Omit<DepartmentReportRow, "lastMessage"> {
  departmentId: string;
  summary: string | null;
  figures: ReportFigure[];
  reviewer: UserRef | null;
  reviewedAt: string | null;
  messages: ReportMessage[];
  canEdit: boolean;
  canReview: boolean;
}

export interface InboxItem {
  kind: "department_report" | "finance_report";
  id: string;
  title: string;
  department: { id: string | null; name: string; code: string };
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
  figures: ReportFigure[];
  summary: string | null;
}

export interface ReportInput {
  departmentId: string;
  title: string;
  periodType: ReportPeriodType;
  periodStart: string;
  periodEnd: string;
  summary?: string;
  figures: ReportFigure[];
  submit?: boolean;
  note?: string;
}

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  draft: "Draft — not sent",
  submitted: "With the CEO",
  changes_requested: "Changes requested",
  approved: "Approved",
};

export const PERIOD_TYPE_LABEL: Record<ReportPeriodType, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
  other: "Other period",
};

export function reportLink(kind: InboxItem["kind"], id: string) {
  return kind === "finance_report" ? `/finance/reports/${id}` : `/reports/${id}`;
}

export function formatPeriod(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const sameMonth = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
  const month = (d: Date) => d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  if (sameMonth && s.getDate() === 1) return month(s);
  const day = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${day(s)} – ${day(e)}`;
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

export function useDepartmentReport(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, "detail", id],
    enabled: !!id,
    queryFn: () => apiJson<DepartmentReportDetail>(`/department-reports/${id}`),
  });
}

export function fetchSuggestedFigures(
  departmentId: string,
  periodStart: string,
  periodEnd: string,
) {
  const qs = new URLSearchParams({ departmentId, periodStart, periodEnd });
  return apiJson<ReportFigure[]>(`/department-reports/suggested-figures?${qs}`);
}

function useInvalidateReports() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: ["reports-inbox"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };
}

export function useCreateDepartmentReport() {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: (input: ReportInput) =>
      apiJson<{ id: string }>("/department-reports", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}

export function useUpdateDepartmentReport() {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<ReportInput> & { id: string }) =>
      apiJson<{ id: string }>(`/department-reports/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteDepartmentReport() {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/department-reports/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useReviewDepartmentReport() {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      note,
    }: {
      id: string;
      decision: "approve" | "request_changes";
      note?: string;
    }) =>
      apiJson(`/department-reports/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ decision, note }),
      }),
    onSuccess: invalidate,
  });
}

export function useAddReportMessage() {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: ({ id, body, parentId }: { id: string; body: string; parentId?: string }) =>
      apiJson(`/department-reports/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body, parentId }),
      }),
    onSuccess: invalidate,
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
