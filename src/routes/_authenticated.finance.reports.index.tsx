import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Plus, FileText } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  useFinanceReports,
  useCreateFinanceReport,
  useAuthorProfiles,
} from "@/features/finance/use-finance-reports";
import {
  REPORT_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
  buildSnapshot,
  defaultPeriodFor,
  defaultTitleFor,
  type FinanceReportType,
} from "@/features/finance/finance-report-snapshot";
import {
  useInvoices,
  usePayments,
  useServiceLines,
  useClients,
} from "@/features/finance/use-finance-data";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/finance/reports/")({
  head: () => ({ meta: [{ title: "Finance Reports — AIMS" }] }),
  component: FinanceReportsIndex,
});

function FinanceReportsIndex() {
  const { roles } = useAuth();
  const canAuthor = roles.some((r) => ["finance", "ceo", "system_admin"].includes(r));
  const reportsQ = useFinanceReports();
  const authorIds = useMemo(
    () =>
      (reportsQ.data ?? []).flatMap(
        (r) => [r.created_by, r.submitted_by, r.reviewed_by].filter(Boolean) as string[],
      ),
    [reportsQ.data],
  );
  const profilesQ = useAuthorProfiles(authorIds);
  const [openNew, setOpenNew] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Reports to CEO</div>
          <div className="text-xs text-muted-foreground">
            Auto-snapshot metrics + Finance narrative. CEO can view, comment, approve, or request
            changes.
          </div>
        </div>
        {canAuthor && (
          <Button size="sm" onClick={() => setOpenNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> New report
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        {reportsQ.isLoading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (reportsQ.data ?? []).length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No reports yet. Finance can create the first report for the CEO to review.
          </div>
        ) : (
          <div className="divide-y">
            {(reportsQ.data ?? []).map((r) => {
              const author = profilesQ.data?.get(r.created_by);
              const reviewer = r.reviewed_by ? profilesQ.data?.get(r.reviewed_by) : null;
              return (
                <Link
                  key={r.id}
                  to="/finance/reports/$id"
                  params={{ id: r.id }}
                  className="flex items-center gap-3 p-3 hover:bg-secondary/60 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{r.title}</span>
                      <span
                        className={`text-[0.625rem] px-1.5 py-0.5 rounded ${STATUS_STYLES[r.status]}`}
                      >
                        {STATUS_LABELS[r.status]}
                      </span>
                    </div>
                    <div className="text-[0.6875rem] text-muted-foreground mt-0.5">
                      {REPORT_TYPE_LABELS[r.report_type]} · Period {r.period_start} → {r.period_end}
                      {author && <> · By {author.full_name ?? author.email}</>}
                      {reviewer && <> · Reviewed by {reviewer.full_name ?? reviewer.email}</>}
                    </div>
                  </div>
                  <div className="text-[0.6875rem] text-muted-foreground shrink-0">
                    {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {openNew && <NewReportDialog onClose={() => setOpenNew(false)} />}
    </div>
  );
}

function NewReportDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const invoicesQ = useInvoices();
  const paymentsQ = usePayments();
  const slQ = useServiceLines();
  const clientsQ = useClients();
  const create = useCreateFinanceReport();

  const [type, setType] = useState<FinanceReportType>("monthly_financial");
  const initial = defaultPeriodFor("monthly_financial");
  const [startStr, setStartStr] = useState(initial.start.toISOString().slice(0, 10));
  const [endStr, setEndStr] = useState(initial.end.toISOString().slice(0, 10));
  const [title, setTitle] = useState(
    defaultTitleFor("monthly_financial", initial.start, initial.end),
  );
  const [narrative, setNarrative] = useState("");

  const dataReady = !!(invoicesQ.data && paymentsQ.data && slQ.data && clientsQ.data);

  const onTypeChange = (t: FinanceReportType) => {
    setType(t);
    const p = defaultPeriodFor(t);
    setStartStr(p.start.toISOString().slice(0, 10));
    setEndStr(p.end.toISOString().slice(0, 10));
    setTitle(defaultTitleFor(t, p.start, p.end));
  };

  const save = async (submit: boolean) => {
    if (!dataReady) return;
    const start = new Date(startStr);
    const end = new Date(endStr);
    end.setHours(23, 59, 59, 999);
    const snapshot = buildSnapshot({
      type,
      periodStart: start,
      periodEnd: end,
      invoices: invoicesQ.data!,
      payments: paymentsQ.data!,
      serviceLines: slQ.data!,
      clients: clientsQ.data!,
    });
    try {
      const row = await create.mutateAsync({
        report_type: type,
        period_start: startStr,
        period_end: endStr,
        title,
        narrative,
        snapshot,
        submit,
      });
      toast.success(submit ? "Report submitted to CEO" : "Draft saved");
      onClose();
      navigate({ to: "/finance/reports/$id", params: { id: row.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save report");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New finance report</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Report type</Label>
            <Select value={type} onValueChange={(v) => onTypeChange(v as FinanceReportType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(REPORT_TYPE_LABELS) as [FinanceReportType, string][]).map(
                  ([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Period start</Label>
              <Input type="date" value={startStr} onChange={(e) => setStartStr(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Period end</Label>
              <Input type="date" value={endStr} onChange={(e) => setEndStr(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Narrative / commentary (optional at draft)</Label>
            <Textarea
              rows={5}
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              placeholder="Key highlights, variances vs. plan, risks, actions taken…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => save(false)}
            disabled={!dataReady || create.isPending}
          >
            Save as draft
          </Button>
          <Button onClick={() => save(true)} disabled={!dataReady || create.isPending}>
            Submit to CEO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
