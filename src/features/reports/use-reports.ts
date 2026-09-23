import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

/* ---------------- What a report is made of ---------------- */

export type ReportKind = "department" | "project" | "individual";
export type ReportTemplate =
  "department_monthly" | "project_progress" | "project_completion" | "individual_period";
export type ReportStatus = "draft" | "submitted" | "changes_requested" | "approved";
export type ReportPeriodType = "monthly" | "quarterly" | "annual" | "other";
export type ReviewerKind = "ceo" | "department_head";
export type FigureFormat = "count" | "money" | "percent" | "days" | "hours" | "text";
export type FigureSource = "aims" | "typed" | "ai";
export type SectionType = "figures" | "narrative" | "list" | "risks" | "decisions";
export type ReportMessageKind =
  "comment" | "submitted" | "resubmitted" | "changes_requested" | "approved";

export interface ReportFigure {
  /** Stable across periods, so the same figure can be compared month to month. */
  key: string;
  label: string;
  value: number | string | null;
  format: FigureFormat;
  unit?: string | null;
  source: FigureSource;
  /** What AIMS worked out, kept when a person edits the value. */
  systemValue?: number | string | null;
  previousValue?: number | string | null;
  /** Why the person changed it. */
  note?: string | null;
}

export interface ReportListItem {
  text: string;
  source: FigureSource;
  /** Opens the record it was pulled from. */
  link?: string | null;
  when?: string | null;
}

export interface ReportSection {
  id: string;
  type: SectionType;
  title: string;
  hint?: string | null;
  body?: string | null;
  source?: FigureSource;
  items?: ReportListItem[];
  figureKeys?: string[];
  required?: boolean;
}

export interface UserRef {
  id: string;
  fullName: string | null;
  email: string;
}

export interface DepartmentRef {
  id: string;
  name: string;
  code: string;
}

export interface ReportMessage {
  id: string;
  kind: ReportMessageKind;
  body: string;
  parentId: string | null;
  createdAt: string;
  author: UserRef;
}

export interface ReportRow {
  id: string;
  kind: ReportKind;
  template: ReportTemplate;
  subjectId: string;
  subjectUserId: string | null;
  departmentId: string | null;
  title: string;
  periodType: ReportPeriodType;
  periodStart: string;
  periodEnd: string;
  status: ReportStatus;
  reviewerKind: ReviewerKind;
  lastReviewNote: string | null;
  submissionCount: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  figures: ReportFigure[];
  /** Present on list rows too, so a row can name what it needs decided. */
  sections?: ReportSection[];
  department: DepartmentRef | null;
  subjectUser: UserRef | null;
  creator: UserRef;
  lastMessage: ReportMessage | null;
}

export interface ReportDetail extends Omit<ReportRow, "lastMessage"> {
  summary: string | null;
  sections: ReportSection[];
  messages: ReportMessage[];
  reviewer: UserRef | null;
  submittedBy: string | null;
  reviewedBy: string | null;
  canEdit: boolean;
  canReview: boolean;
  /** Required sections not yet filled in. */
  missing: string[];
  subjectName: string;
}

export interface ReportDue {
  period: { start: string; end: string; label: string };
  own: { id: string; status: ReportStatus } | null;
  waitingOnMe: number;
}

export interface ReportAiStatus {
  configured: boolean;
  providers: { openai: boolean; gemini: boolean };
}

export interface ReportPreview {
  figures: ReportFigure[];
  lists: Record<string, ReportListItem[]>;
}

/* ---------------- Asking the AI for help ---------------- */

export type AssistJob = "draft_narrative" | "explain_change" | "check" | "brief";

export interface AssistIssue {
  where: string;
  problem: string;
  fix: string;
}

export interface AssistResult {
  job: AssistJob;
  text?: string;
  sectionId?: string;
  figureKey?: string;
  issues?: AssistIssue[];
  provider?: string;
  reports?: number;
}

/* ---------------- Inputs ---------------- */

export interface ReportListFilters {
  kind?: ReportKind;
  subjectId?: string;
  departmentId?: string;
  status?: ReportStatus;
  mine?: boolean;
  forReview?: boolean;
}

export interface StartReportInput {
  kind: ReportKind;
  template?: ReportTemplate;
  /** The department or project. Left out for your own report. */
  subjectId?: string;
  periodType?: ReportPeriodType;
  periodStart?: string;
  periodEnd?: string;
  title?: string;
}

export interface UpdateReportInput {
  title?: string;
  periodType?: ReportPeriodType;
  periodStart?: string;
  periodEnd?: string;
  summary?: string;
  figures?: ReportFigure[];
  sections?: ReportSection[];
  submit?: boolean;
  note?: string;
}

/* ---------------- Queries ---------------- */

const KEY = ["reports"];

const search = (params: Record<string, string | boolean | undefined>) => {
  const qs = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined || value === false || value === "") continue;
    qs.set(name, String(value));
  }
  return qs.toString();
};

export function useReports(filters: ReportListFilters = {}, enabled = true) {
  const query = search({ ...filters });
  return useQuery({
    queryKey: [...KEY, "list", query],
    enabled,
    queryFn: () => apiJson<ReportRow[]>(`/reports${query ? `?${query}` : ""}`),
  });
}

export function useReport(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, "detail", id],
    enabled: !!id,
    queryFn: () => apiJson<ReportDetail>(`/reports/${id}`),
  });
}

/** What this person owes for the current period, and what waits on them. */
export function useReportsDue(enabled = true) {
  return useQuery({
    queryKey: [...KEY, "due"],
    enabled,
    queryFn: () => apiJson<ReportDue>("/reports/due"),
  });
}

export function useReportAiStatus(enabled = true) {
  return useQuery({
    queryKey: [...KEY, "ai-status"],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: () => apiJson<ReportAiStatus>("/reports/ai-status"),
  });
}

/** What AIMS would fill in, without creating anything. */
export function useReportPreview(
  params: {
    kind: ReportKind;
    subjectId?: string;
    periodStart: string;
    periodEnd: string;
    template?: ReportTemplate;
  },
  enabled = true,
) {
  const query = search({ ...params });
  return useQuery({
    queryKey: [...KEY, "preview", query],
    enabled,
    queryFn: () => apiJson<ReportPreview>(`/reports/preview?${query}`),
  });
}

/* ---------------- Mutations ---------------- */

function useInvalidateReports() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: ["department-reports"] });
    qc.invalidateQueries({ queryKey: ["reports-inbox"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["my-work"] });
  };
}

/** Opens a report for a period and pulls the figures in. */
export function useStartReport() {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: (input: StartReportInput) =>
      apiJson<ReportRow>("/reports", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: invalidate,
  });
}

export function useUpdateReport() {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateReportInput & { id: string }) =>
      apiJson<ReportRow>(`/reports/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: invalidate,
  });
}

/** Pulls the figures again, keeping anything the person changed. */
export function useRefreshReportFigures() {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: (id: string) =>
      apiJson<ReportRow>(`/reports/${id}/refresh-figures`, { method: "POST" }),
    onSuccess: invalidate,
  });
}

export function useDeleteReport() {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: (id: string) => apiJson<{ id: string }>(`/reports/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useReviewReport() {
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
      apiJson<ReportRow>(`/reports/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ decision, note }),
      }),
    onSuccess: invalidate,
  });
}

export function useSendReportMessage() {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: ({ id, body, parentId }: { id: string; body: string; parentId?: string }) =>
      apiJson<ReportMessage>(`/reports/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body, parentId }),
      }),
    onSuccess: invalidate,
  });
}

/** Costs money, so it only ever runs from a button. */
export function useReportAssist() {
  return useMutation({
    mutationFn: ({ id, job, target }: { id: string; job: AssistJob; target?: string }) =>
      apiJson<AssistResult>(`/reports/${id}/assist`, {
        method: "POST",
        body: JSON.stringify({ job, target }),
      }),
  });
}
