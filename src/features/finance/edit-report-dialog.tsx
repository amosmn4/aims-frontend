import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { formatDate } from "@/lib/format-date";
import {
  useUpdateFinanceReport,
  type FinanceReportRow,
} from "@/features/finance/use-finance-reports";
import { buildSnapshot } from "@/features/finance/finance-report-snapshot";
import {
  useClients,
  useInvoices,
  usePayments,
  useServiceLines,
} from "@/features/finance/use-finance-data";
import { useCompanyCurrency } from "@/features/finance/money";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Edit a draft or a report the CEO sent back, then save or resubmit. */
export function EditReportDialog({
  report,
  onClose,
}: {
  report: FinanceReportRow;
  onClose: () => void;
}) {
  const initialRefresh = report.status === "changes_requested";
  const [title, setTitle] = useState(report.title);
  const [narrative, setNarrative] = useState(report.narrative ?? "");
  const [refresh, setRefresh] = useState(initialRefresh);
  const [titleError, setTitleError] = useState<string>();
  const invoicesQ = useInvoices();
  const paymentsQ = usePayments();
  const linesQ = useServiceLines();
  const clientsQ = useClients();
  const companyCurrency = useCompanyCurrency();
  const update = useUpdateFinanceReport();
  const dataReady = !!(invoicesQ.data && paymentsQ.data && linesQ.data && clientsQ.data);
  const dataFailed = [invoicesQ, paymentsQ, linesQ, clientsQ].find((q) => q.isError);
  const resubmitting = report.status === "changes_requested";
  const dirty =
    title !== report.title || narrative !== (report.narrative ?? "") || refresh !== initialRefresh;
  const { guardClose } = useUnsavedChanges(dirty);

  const save = async (submit: boolean) => {
    if (!title.trim()) {
      setTitleError("Give the report a title");
      return;
    }
    if (refresh && !dataReady) return;
    const end = new Date(report.period_end);
    end.setHours(23, 59, 59, 999);
    const snapshot = refresh
      ? buildSnapshot({
          type: report.report_type,
          periodStart: new Date(report.period_start),
          periodEnd: end,
          currency: report.snapshot.currency ?? companyCurrency,
          invoices: invoicesQ.data!,
          payments: paymentsQ.data!,
          serviceLines: linesQ.data!,
          clients: clientsQ.data!,
        })
      : undefined;
    try {
      await update.mutateAsync({ id: report.id, title: title.trim(), narrative, snapshot, submit });
      toast.success(
        submit ? (resubmitting ? "Resubmitted to CEO" : "Submitted to CEO") : "Changes saved",
      );
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save report");
    }
  };

  const waiting = refresh && !dataReady;

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onClose)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{resubmitting ? "Update and resubmit report" : "Edit report"}</DialogTitle>
          {resubmitting && report.review_note && (
            <DialogDescription>CEO asked: “{report.review_note}”</DialogDescription>
          )}
        </DialogHeader>
        <RequiredNote />
        <div className="space-y-3">
          <FormField id="report-title" label="Title" required error={titleError}>
            <Input
              id="report-title"
              value={title}
              aria-invalid={!!titleError}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleError(undefined);
              }}
            />
          </FormField>
          <FormField id="report-narrative" label="Finance commentary">
            <Textarea
              id="report-narrative"
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              rows={6}
            />
          </FormField>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={refresh}
              onCheckedChange={(v) => setRefresh(v === true)}
              className="mt-0.5"
            />
            <span>
              Refresh the figures with the latest invoices and payments
              <span className="block text-xs text-muted-foreground">
                Same report period ({formatDate(report.period_start)} –{" "}
                {formatDate(report.period_end)}).
              </span>
            </span>
          </label>
          {refresh && dataFailed && (
            <LoadError
              what="the latest figures"
              error={dataFailed.error}
              onRetry={() => {
                void invoicesQ.refetch();
                void paymentsQ.refetch();
                void linesQ.refetch();
                void clientsQ.refetch();
              }}
            />
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => guardClose(onClose)} disabled={update.isPending}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => save(false)}
            disabled={update.isPending || waiting}
          >
            Save changes
          </Button>
          <Button onClick={() => save(true)} disabled={update.isPending || waiting}>
            {update.isPending || (waiting && !dataFailed) ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1 h-4 w-4" />
            )}
            {resubmitting ? "Resubmit to CEO" : "Submit to CEO"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
