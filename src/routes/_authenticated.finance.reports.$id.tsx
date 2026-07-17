import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  MessageSquare,
  Send,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Download,
} from "lucide-react";
import { exportFinanceReportPdf } from "@/features/finance/finance-report-pdf";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useAuth } from "@/lib/auth";
import {
  useFinanceReport,
  useFinanceReportComments,
  useAddComment,
  useUpdateReportStatus,
  useDeleteReport,
  useAuthorProfiles,
} from "@/features/finance/use-finance-reports";
import {
  REPORT_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
  type KpiEntry,
} from "@/features/finance/finance-report-snapshot";
import { formatCurrency } from "@/features/finance/finance";
import { AttachmentsPanel } from "@/features/documents/attachments-panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/finance/reports/$id")({
  head: () => ({ meta: [{ title: "Report — AIMS" }] }),
  component: ReportDetail,
});

const COLORS = ["#085599", "#F5821F", "#22c55e", "#eab308", "#ef4444", "#8b5cf6", "#06b6d4"];

function formatKpi(k: KpiEntry) {
  if (k.format === "currency") return formatCurrency(k.value);
  if (k.format === "percent") return `${k.value.toFixed(1)}%`;
  return k.value.toLocaleString();
}

function ReportDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const isCeoOrAdmin = roles.includes("ceo") || roles.includes("system_admin");
  const reportQ = useFinanceReport(id);
  const commentsQ = useFinanceReportComments(id);
  const authorIds = useMemo(() => {
    const r = reportQ.data;
    const c = commentsQ.data ?? [];
    return [r?.created_by, r?.submitted_by, r?.reviewed_by, ...c.map((x) => x.author_id)].filter(
      Boolean,
    ) as string[];
  }, [reportQ.data, commentsQ.data]);
  const profilesQ = useAuthorProfiles(authorIds);
  const addComment = useAddComment();
  const updateStatus = useUpdateReportStatus();
  const del = useDeleteReport();

  const [commentBody, setCommentBody] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [exporting, setExporting] = useState(false);

  const doExport = async () => {
    if (!reportQ.data) return;
    setExporting(true);
    try {
      await exportFinanceReportPdf({
        report: reportQ.data,
        comments: commentsQ.data ?? [],
        authors: profilesQ.data ?? new Map(),
        chartElementIds: ["chart-monthly-pl", "chart-ar-ageing", "chart-service-line"],
      });
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (reportQ.isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  const r = reportQ.data;
  if (!r) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Report not found.{" "}
        <Link to="/finance/reports" className="text-primary underline">
          Back to reports
        </Link>
      </div>
    );
  }

  const isAuthor = user?.id === r.created_by;
  const canEditDraft = isAuthor && r.status === "draft";
  const canReview =
    isCeoOrAdmin &&
    (r.status === "submitted" || r.status === "changes_requested" || r.status === "approved");

  const snap = r.snapshot;

  const submit = async () => {
    try {
      await updateStatus.mutateAsync({ id: r.id, status: "submitted" });
      toast.success("Submitted to CEO");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };
  const approve = async () => {
    try {
      await updateStatus.mutateAsync({
        id: r.id,
        status: "approved",
        review_note: reviewNote || null,
      });
      toast.success("Report approved");
      setReviewNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };
  const requestChanges = async () => {
    if (!reviewNote.trim()) {
      toast.error("Please add a note explaining what needs to change");
      return;
    }
    try {
      await updateStatus.mutateAsync({
        id: r.id,
        status: "changes_requested",
        review_note: reviewNote,
      });
      toast.success("Changes requested");
      setReviewNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };
  const post = async () => {
    if (!commentBody.trim()) return;
    try {
      await addComment.mutateAsync({ report_id: r.id, body: commentBody.trim() });
      setCommentBody("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to comment");
    }
  };
  const remove = async () => {
    if (!confirm("Delete this draft report?")) return;
    await del.mutateAsync(r.id);
    toast.success("Deleted");
    navigate({ to: "/finance/reports" });
  };

  const author = profilesQ.data?.get(r.created_by);
  const reviewer = r.reviewed_by ? profilesQ.data?.get(r.reviewed_by) : null;

  return (
    <div className="space-y-4">
      <div>
        <Link
          to="/finance/reports"
          className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to reports
        </Link>
      </div>

      {/* Header */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold">{r.title}</h1>
              <span className={`text-[0.625rem] px-1.5 py-0.5 rounded ${STATUS_STYLES[r.status]}`}>
                {STATUS_LABELS[r.status]}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {REPORT_TYPE_LABELS[r.report_type]} · Period {r.period_start} → {r.period_end}
              {author && (
                <>
                  {" "}
                  · By <span className="text-foreground">{author.full_name ?? author.email}</span>
                </>
              )}
              {r.submitted_at && <> · Submitted {new Date(r.submitted_at).toLocaleDateString()}</>}
              {reviewer && r.reviewed_at && (
                <>
                  {" "}
                  · Reviewed by{" "}
                  <span className="text-foreground">
                    {reviewer.full_name ?? reviewer.email}
                  </span> on {new Date(r.reviewed_at).toLocaleDateString()}
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={doExport} disabled={exporting}>
              {exporting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Export PDF
            </Button>
            {canEditDraft && (
              <>
                <Button size="sm" variant="ghost" onClick={remove}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
                <Button size="sm" onClick={submit} disabled={updateStatus.isPending}>
                  <Send className="h-4 w-4 mr-1" /> Submit to CEO
                </Button>
              </>
            )}
          </div>
        </div>

        {r.review_note && (
          <div
            className={`mt-3 rounded p-2 text-xs ${r.status === "approved" ? "bg-success/10 text-success" : "bg-warning/10 text-warning-foreground"}`}
          >
            <div className="font-semibold mb-0.5">
              {r.status === "approved" ? "CEO approval note" : "CEO requested changes"}
            </div>
            <div className="text-foreground/80">{r.review_note}</div>
          </div>
        )}
      </div>

      {/* Narrative */}
      {r.narrative && (
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Finance commentary
          </div>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{r.narrative}</p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {(snap.kpis ?? []).map((k) => (
          <div key={k.label} className="rounded-lg border bg-card p-3">
            <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
              {k.label}
            </div>
            <div className="mt-1 text-base font-semibold tabular-nums">{formatKpi(k)}</div>
          </div>
        ))}
      </div>

      {/* Monthly P&L */}
      {snap.monthly && snap.monthly.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-semibold mb-2">Monthly P&amp;L</div>
          <div id="chart-monthly-pl" className="h-56">
            <ResponsiveContainer>
              <BarChart data={snap.monthly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="revenue" fill="#085599" name="Revenue" />
                <Bar dataKey="cost" fill="#F5821F" name="Cost" />
                <Bar dataKey="profit" fill="#22c55e" name="Profit" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Aging + Service line */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {snap.aging && snap.aging.length > 0 && (
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-semibold mb-2">AR Ageing</div>
            <div id="chart-ar-ageing" className="h-56">
              <ResponsiveContainer>
                <BarChart data={snap.aging}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="amount" fill="#085599" name="Outstanding" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {snap.by_service_line && snap.by_service_line.length > 0 && (
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-semibold mb-2">Revenue by service line</div>
            <div id="chart-service-line" className="h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={snap.by_service_line}
                    dataKey="total"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    label={(e) => e.name}
                  >
                    {snap.by_service_line.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Top debtors table */}
      {snap.top_debtors && snap.top_debtors.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-semibold mb-2">Top debtors</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b text-xs text-muted-foreground">
                  <th className="py-2 font-medium">Client</th>
                  <th className="py-2 font-medium text-right">Outstanding</th>
                  <th className="py-2 font-medium text-right">Oldest overdue</th>
                </tr>
              </thead>
              <tbody>
                {snap.top_debtors.map((d) => (
                  <tr key={d.client} className="border-b last:border-0">
                    <td className="py-2">{d.client}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency(d.outstanding)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {d.oldest_days}d
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Service-line breakdown table */}
      {snap.by_service_line && snap.by_service_line.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-semibold mb-2">Service line breakdown</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b text-xs text-muted-foreground">
                  <th className="py-2 font-medium">Service line</th>
                  <th className="py-2 font-medium">Type</th>
                  <th className="py-2 font-medium text-right">Revenue</th>
                  <th className="py-2 font-medium text-right">Cost</th>
                  <th className="py-2 font-medium text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {snap.by_service_line.map((l) => {
                  const margin = l.total > 0 ? ((l.total - l.cost) / l.total) * 100 : 0;
                  return (
                    <tr key={l.name} className="border-b last:border-0">
                      <td className="py-2">{l.name}</td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {l.recurring ? "Recurring" : "One-off"}
                      </td>
                      <td className="py-2 text-right tabular-nums">{formatCurrency(l.total)}</td>
                      <td className="py-2 text-right tabular-nums">{formatCurrency(l.cost)}</td>
                      <td className="py-2 text-right tabular-nums">{margin.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CEO review actions */}
      {canReview && (
        <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
          <div className="text-sm font-semibold mb-2">CEO review</div>
          <Textarea
            rows={3}
            placeholder="Optional note (required when requesting changes)"
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
          />
          <div className="mt-2 flex gap-2 flex-wrap">
            <Button size="sm" onClick={approve} disabled={updateStatus.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={requestChanges}
              disabled={updateStatus.isPending}
            >
              <AlertTriangle className="h-4 w-4 mr-1" /> Request changes
            </Button>
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-semibold mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Discussion ({commentsQ.data?.length ?? 0})
        </div>
        <div className="space-y-3 mb-4">
          {(commentsQ.data ?? []).length === 0 && (
            <div className="text-xs text-muted-foreground">No comments yet.</div>
          )}
          {(commentsQ.data ?? []).map((c) => {
            const p = profilesQ.data?.get(c.author_id);
            const isCeo = false; // could look up role — keep simple
            const initial = ((p?.full_name ?? p?.email ?? "?").charAt(0) || "?").toUpperCase();
            return (
              <div key={c.id} className="flex gap-2">
                <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold shrink-0">
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs">
                    <span className="font-medium text-foreground">
                      {p?.full_name ?? p?.email ?? "User"}
                    </span>
                    <span className="text-muted-foreground ml-2">
                      {new Date(c.created_at).toLocaleString()}
                    </span>
                    {isCeo && (
                      <span className="ml-2 text-[0.625rem] px-1 rounded bg-accent/20 text-accent">
                        CEO
                      </span>
                    )}
                  </div>
                  <div className="text-sm whitespace-pre-wrap mt-0.5">{c.body}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t pt-3">
          <Textarea
            rows={2}
            placeholder="Write a comment…"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={post} disabled={addComment.isPending || !commentBody.trim()}>
              <Send className="h-4 w-4 mr-1" /> Post
            </Button>
          </div>
        </div>
      </div>

      {/* Attachments */}
      <div className="rounded-lg border bg-card p-4">
        <AttachmentsPanel
          resourceType="finance_report"
          resourceId={r.id}
          canManage={isCeoOrAdmin || roles.includes("finance")}
        />
      </div>
    </div>
  );
}
