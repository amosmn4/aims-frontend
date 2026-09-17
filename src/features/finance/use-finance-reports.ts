import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import type {
  FinanceReportSnapshot,
  FinanceReportStatus,
  FinanceReportType,
} from "./finance-report-snapshot";

export interface FinanceReportRow {
  id: string;
  report_type: FinanceReportType;
  period_start: string;
  period_end: string;
  title: string;
  narrative: string | null;
  snapshot: FinanceReportSnapshot;
  status: FinanceReportStatus;
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FinanceReportCommentRow {
  id: string;
  report_id: string;
  author_id: string;
  author_name: string;
  kind: "comment" | "submitted" | "resubmitted" | "changes_requested" | "approved";
  parent_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

type BackendFinanceReport = {
  id: string;
  reportType: FinanceReportType;
  periodStart: string;
  periodEnd: string;
  title: string;
  narrative: string | null;
  snapshot: FinanceReportSnapshot;
  status: FinanceReportStatus;
  submittedBy: string | null;
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

function mapReport(r: BackendFinanceReport): FinanceReportRow {
  return {
    id: r.id,
    report_type: r.reportType,
    period_start: r.periodStart.slice(0, 10),
    period_end: r.periodEnd.slice(0, 10),
    title: r.title,
    narrative: r.narrative,
    snapshot: r.snapshot,
    status: r.status,
    submitted_by: r.submittedBy,
    submitted_at: r.submittedAt,
    reviewed_by: r.reviewedBy,
    reviewed_at: r.reviewedAt,
    review_note: r.reviewNote,
    created_by: r.createdBy,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

type BackendComment = {
  id: string;
  reportId: string;
  authorId: string;
  author?: { fullName: string | null; email: string } | null;
  kind?: FinanceReportCommentRow["kind"];
  parentId?: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
};

function mapComment(c: BackendComment): FinanceReportCommentRow {
  return {
    id: c.id,
    report_id: c.reportId,
    author_id: c.authorId,
    author_name: c.author?.fullName || c.author?.email || "AIMS",
    kind: c.kind ?? "comment",
    parent_id: c.parentId ?? null,
    body: c.body,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

export function useFinanceReports() {
  return useQuery({
    queryKey: ["finance-reports"],
    queryFn: async () => (await apiJson<BackendFinanceReport[]>("/finance-reports")).map(mapReport),
  });
}

export function useFinanceReport(id: string | undefined) {
  return useQuery({
    queryKey: ["finance-reports", id],
    enabled: !!id,
    queryFn: async () => mapReport(await apiJson<BackendFinanceReport>(`/finance-reports/${id}`)),
  });
}

export function useFinanceReportComments(reportId: string | undefined) {
  return useQuery({
    queryKey: ["finance-reports", reportId, "comments"],
    enabled: !!reportId,
    queryFn: async () =>
      (await apiJson<BackendComment[]>(`/finance-reports/${reportId}/comments`)).map(mapComment),
  });
}

export function useAuthorProfiles(userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  return useQuery({
    queryKey: ["users", "lite", "by-ids", ids.sort().join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const users =
        await apiJson<{ id: string; email: string; fullName: string | null }[]>("/users/lite");
      const m = new Map<string, { id: string; full_name: string | null; email: string }>();
      for (const u of users) {
        if (ids.includes(u.id)) m.set(u.id, { id: u.id, full_name: u.fullName, email: u.email });
      }
      return m;
    },
  });
}

export function useCreateFinanceReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      report_type: FinanceReportType;
      period_start: string;
      period_end: string;
      title: string;
      narrative: string;
      snapshot: FinanceReportSnapshot;
      submit?: boolean;
    }) =>
      mapReport(
        await apiJson<BackendFinanceReport>("/finance-reports", {
          method: "POST",
          body: JSON.stringify({
            reportType: input.report_type,
            periodStart: input.period_start,
            periodEnd: input.period_end,
            title: input.title,
            narrative: input.narrative || undefined,
            snapshot: input.snapshot,
            submit: input.submit,
          }),
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance-reports"] }),
  });
}

export function useUpdateReportStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      review_note,
    }: {
      id: string;
      status: FinanceReportStatus;
      review_note?: string | null;
    }) =>
      apiJson(`/finance-reports/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, reviewNote: review_note || undefined }),
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["finance-reports"] });
      qc.invalidateQueries({ queryKey: ["finance-reports", vars.id] });
    },
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      report_id,
      body,
      parent_id,
    }: {
      report_id: string;
      body: string;
      parent_id?: string;
    }) =>
      apiJson(`/finance-reports/${report_id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body, parentId: parent_id }),
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["finance-reports", vars.report_id, "comments"] });
    },
  });
}

export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiJson(`/finance-reports/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance-reports"] }),
  });
}

/** Edit a draft or changes-requested report; `submit` sends it (back) to the CEO. */
export function useUpdateFinanceReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      title: string;
      narrative: string;
      snapshot?: FinanceReportSnapshot;
      submit?: boolean;
    }) =>
      apiJson(`/finance-reports/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: input.title,
          narrative: input.narrative,
          snapshot: input.snapshot,
          submit: input.submit,
        }),
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["finance-reports"] });
      qc.invalidateQueries({ queryKey: ["finance-reports", vars.id] });
    },
  });
}
