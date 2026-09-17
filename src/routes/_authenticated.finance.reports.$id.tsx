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
  Pencil,
} from "lucide-react";
import { EditReportDialog } from "@/features/finance/edit-report-dialog";
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
import { useCompanyCurrency } from "@/features/finance/money";
import { FormField } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { formatDate } from "@/lib/format-date";
import { AttachmentsPanel } from "@/features/documents/attachments-panel";
import { ReportConversation } from "@/features/reports/report-conversation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_authenticated/finance/reports/$id")({
  head: () => ({ meta: [{ title: "Finance report — AIMS" }] }),
  component: ReportDetail,
});

const COLORS = ["#085599", "#F5821F", "#22c55e", "#eab308", "#ef4444", "#8b5cf6", "#06b6d4"];

function formatKpi(k: KpiEntry, currency: string) {
  if (k.format === "currency") return formatCurrency(k.value, currency);
  if (k.format === "percent") return `${k.value.toFixed(1)}%`;
  return k.value.toLocaleString();
}

function ReportDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, roles, isAdminOrCeo: isCeoOrAdmin } = useAuth();
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

  const companyCurrency = useCompanyCurrency();
  const [reviewNote, setReviewNote] = useState("");
  const [reviewError, setReviewError] = useState<string>();
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState(false);

  const doExport = async () => {
    if (!reportQ.data) return;
    setExporting(true);
    try {
      await exportFinanceReportPdf({
        report: reportQ.data,
        comments: commentsQ.data ?? [],
        authors: profilesQ.data ?? new Map(),
        chartElementIds: ["chart-monthly-pl", "chart-ar-ageing", "chart-service-line"],
        currency: companyCurrency,
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
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading report" />
      </div>
    );
  }
  const r = reportQ.data;
  if (!r) {
    return (
      <div className="space-y-3">
        <LoadError what="this report" error={reportQ.error} onRetry={() => reportQ.refetch()} />
        <Link to="/finance/reports" className="text-sm text-primary underline">
          Back to finance reports
        </Link>
      </div>
    );
  }

  const isAuthor = user?.id === r.created_by;
  // Authors can edit, delete and (re)submit until the CEO has the report, and again after changes are requested.
  const canEditDraft = isAuthor && (r.status === "draft" || r.status === "changes_requested");
  const canReview = isCeoOrAdmin && r.status === "submitted";

  const snap = r.snapshot;
  const currency = snap.currency ?? companyCurrency;
  const money = (v: number) => formatCurrency(v, currency);

  const submit = async () => {
    const ok = await confirmDialog({
      title: "Send this report to the CEO?",
      description: "You can't edit it again unless the CEO asks for changes.",
      confirmLabel: "Submit to CEO",
    });
    if (!ok) return;
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
      setReviewError("Say what Finance needs to change");
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
  const remove = async () => {
    const ok = await confirmDialog({
      title: "Delete this report?",
      description: `"${r.title}" will be removed for good.`,
      confirmLabel: "Delete report",
      destructive: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(r.id);
      toast.success("Report deleted");
      navigate({ to: "/finance/reports" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the report");
    }
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
          <ArrowLeft className="h-3 w-3" /> Back to finance reports
        </Link>
      </div>

      {editing && <EditReportDialog report={r} onClose={() => setEditing(false)} />}

      {/* Header */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold">{r.title}</h1>
              <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_STYLES[r.status]}`}>
                {STATUS_LABELS[r.status]}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {REPORT_TYPE_LABELS[r.report_type] ?? r.report_type} · {formatDate(r.period_start)} –{" "}
              {formatDate(r.period_end)}
              {author && (
                <>
                  {" "}
                  · By <span className="text-foreground">{author.full_name ?? author.email}</span>
                </>
              )}
              {r.submitted_at && <> · Submitted {formatDate(r.submitted_at)}</>}
              {reviewer && r.reviewed_at && (
                <>
                  {" "}
                  · Reviewed by{" "}
                  <span className="text-foreground">
                    {reviewer.full_name ?? reviewer.email}
                  </span> on {formatDate(r.reviewed_at)}
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
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
                  <Trash2 className="h-4 w-4 mr-1" /> Delete report
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit report
                </Button>
                {r.status === "changes_requested" ? (
                  <Button size="sm" onClick={() => setEditing(true)}>
                    <Send className="h-4 w-4 mr-1" /> Update &amp; resubmit
                  </Button>
                ) : (
                  <Button size="sm" onClick={submit} disabled={updateStatus.isPending}>
                    <Send className="h-4 w-4 mr-1" /> Submit to CEO
                  </Button>
                )}
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
      <p className="text-xs text-muted-foreground">
        Amounts in {currency}.
        {!!snap.other_currency_invoices &&
          ` ${snap.other_currency_invoices} invoice${snap.other_currency_invoices === 1 ? "" : "s"} in other currencies ${snap.other_currency_invoices === 1 ? "isn't" : "aren't"} included.`}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {(snap.kpis ?? []).map((k) => (
          <div key={k.label} className="rounded-lg border bg-card p-3">
            <div className="text-xs text-muted-foreground">
              {k.label === "Outstanding AR" ? "Still owed to us" : k.label}
            </div>
            <div className="mt-1 text-base font-semibold tabular-nums">
              {formatKpi(k, currency)}
            </div>
          </div>
        ))}
      </div>

      {/* Monthly P&L */}
      {snap.monthly && snap.monthly.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-semibold mb-2">Profit and loss by month</div>
          <div id="chart-monthly-pl" className="h-56">
            <ResponsiveContainer>
              <BarChart data={snap.monthly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
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
            <div className="text-sm font-semibold mb-2">Money owed to us, by days late</div>
            <div id="chart-ar-ageing" className="h-56">
              <ResponsiveContainer>
                <BarChart data={snap.aging}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v: number) => money(v)} />
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
                  <Tooltip formatter={(v: number) => money(v)} />
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
                  <th className="py-2 font-medium text-right">Still owed</th>
                  <th className="py-2 font-medium text-right">Most days late</th>
                </tr>
              </thead>
              <tbody>
                {snap.top_debtors.map((d) => (
                  <tr key={d.client} className="border-b last:border-0">
                    <td className="py-2">{d.client}</td>
                    <td className="py-2 text-right tabular-nums">{money(d.outstanding)}</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {d.oldest_days} {d.oldest_days === 1 ? "day" : "days"}
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
                      <td className="py-2 text-right tabular-nums">{money(l.total)}</td>
                      <td className="py-2 text-right tabular-nums">{money(l.cost)}</td>
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
          <div className="text-sm font-semibold">Your decision</div>
          <p className="mb-2 text-xs text-muted-foreground">
            Approve the report, or send it back to Finance with a note.
          </p>
          <FormField
            id="review-note"
            label="Note to Finance"
            hint="Needed when you ask for changes"
            error={reviewError}
          >
            <Textarea
              id="review-note"
              rows={3}
              value={reviewNote}
              aria-invalid={!!reviewError}
              onChange={(e) => {
                setReviewNote(e.target.value);
                setReviewError(undefined);
              }}
            />
          </FormField>
          <div className="mt-2 flex gap-2 flex-wrap">
            <Button size="sm" onClick={approve} disabled={updateStatus.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Approve report
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

      <ReportConversation
        messages={(commentsQ.data ?? []).map((c) => ({
          id: c.id,
          kind: c.kind,
          body: c.body,
          parentId: c.parent_id,
          createdAt: c.created_at,
          authorName: c.author_name,
        }))}
        canPost={r.status !== "draft"}
        sending={addComment.isPending}
        placeholder={isCeoOrAdmin ? "Message Finance…" : "Message the CEO…"}
        onSend={(body, parentId) =>
          addComment
            .mutateAsync({ report_id: r.id, body, parent_id: parentId })
            .then(() => toast.success("Message sent"))
            .catch((e) => toast.error(e instanceof Error ? e.message : "Couldn't send the message"))
        }
      />

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
