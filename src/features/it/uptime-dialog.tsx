import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Activity, Loader2, Trash2 } from "lucide-react";
import { confirmDialog } from "@/components/confirm-dialog";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import {
  useSystemUptime,
  useRecordUptime,
  useDeleteUptime,
  formatUptimeMonth,
  formatUptimePercent,
  lastMonthValue,
} from "@/features/it/use-uptime";
import type { ItSystemRow } from "@/features/it/use-it-systems";
import { Button } from "@/components/ui/button";
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

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const currentMonthValue = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Record a system's monthly uptime and see past months. */
export function UptimeDialog({
  system,
  canManage,
  onClose,
}: {
  system: ItSystemRow | null;
  canManage: boolean;
  onClose: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const { guardClose } = useUnsavedChanges(dirty);
  const close = () => {
    setDirty(false);
    onClose();
  };
  return (
    <Dialog open={!!system} onOpenChange={(open) => !open && guardClose(close)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {system && (
          <UptimeBody
            key={system.id}
            system={system}
            canManage={canManage}
            onDirtyChange={setDirty}
            onClose={() => guardClose(close)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type UptimeErrors = Partial<Record<"month" | "uptime", string>>;

function UptimeBody({
  system,
  canManage,
  onDirtyChange,
  onClose,
}: {
  system: ItSystemRow;
  canManage: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onClose: () => void;
}) {
  const historyQ = useSystemUptime(system.id);
  const record = useRecordUptime(system.id);
  const remove = useDeleteUptime(system.id);
  const [initialMonth] = useState(lastMonthValue);
  const [month, setMonth] = useState(initialMonth);
  const [uptime, setUptime] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<UptimeErrors>({});
  const history = historyQ.data ?? [];
  const existing = history.find((r) => r.month.slice(0, 7) === month);

  const dirty = canManage && (!!uptime.trim() || !!notes.trim() || month !== initialMonth);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const submit = () => {
    const found: UptimeErrors = {};
    if (!MONTH_PATTERN.test(month)) found.month = "Choose the month";
    else if (month > currentMonthValue()) found.month = "Choose this month or an earlier one";
    const pct = Number(uptime);
    if (!uptime.trim()) found.uptime = "Enter the uptime percentage";
    else if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      found.uptime = "Enter a number from 0 to 100";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const label = formatUptimeMonth(`${month}-01T00:00:00Z`);
    record.mutate(
      { month, uptimePercent: pct, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(`Uptime recorded for ${label}`);
          setUptime("");
          setNotes("");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save uptime"),
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Uptime — {system.name}</DialogTitle>
        <DialogDescription>
          How much of each month this was up and working, as a percentage.
        </DialogDescription>
      </DialogHeader>

      {canManage && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          noValidate
        >
          <RequiredNote />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField id="uptime-month" label="Month" required error={errors.month}>
              <Input
                id="uptime-month"
                type="month"
                value={month}
                max={currentMonthValue()}
                onChange={(e) => {
                  setMonth(e.target.value);
                  setErrors((er) => ({ ...er, month: undefined }));
                }}
                placeholder="2026-08"
                aria-invalid={!!errors.month}
                aria-describedby={errors.month ? "uptime-month-error" : undefined}
              />
            </FormField>
            <FormField
              id="uptime-percent"
              label="Uptime %"
              required
              error={errors.uptime}
              hint="100 means it never went down"
            >
              <Input
                id="uptime-percent"
                type="number"
                min={0}
                max={100}
                step="any"
                inputMode="decimal"
                value={uptime}
                onChange={(e) => {
                  setUptime(e.target.value);
                  setErrors((er) => ({ ...er, uptime: undefined }));
                }}
                placeholder="e.g. 99.7"
                aria-invalid={!!errors.uptime}
                aria-describedby={errors.uptime ? "uptime-percent-error" : undefined}
              />
            </FormField>
          </div>
          {existing && !errors.month && (
            <p className="text-xs text-muted-foreground">
              {formatUptimeMonth(existing.month)} already shows{" "}
              {formatUptimePercent(existing.uptimePercent)} — saving replaces it.
            </p>
          )}
          <FormField id="uptime-notes" label="Notes (optional)">
            <Textarea
              id="uptime-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. 3 hours down on 14 Aug for a server move"
            />
          </FormField>
          <div className="flex justify-end">
            <Button type="submit" disabled={record.isPending}>
              {record.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Activity className="h-4 w-4 mr-2" />
              )}
              Record uptime
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Past months</h3>
        {historyQ.isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : historyQ.isError ? (
          <LoadError
            what="uptime history"
            error={historyQ.error}
            onRetry={() => historyQ.refetch()}
          />
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No uptime recorded yet.{canManage ? " Use the form above to add the first month." : ""}
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {history.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm">
                    <span className="font-medium tabular-nums">
                      {formatUptimePercent(r.uptimePercent)}
                    </span>
                    <span className="text-muted-foreground"> · {formatUptimeMonth(r.month)}</span>
                  </div>
                  {r.notes && <div className="text-xs text-muted-foreground">{r.notes}</div>}
                </div>
                {canManage && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Delete uptime for ${formatUptimeMonth(r.month)}`}
                    disabled={remove.isPending}
                    onClick={async () => {
                      const ok = await confirmDialog({
                        title: `Delete uptime for ${formatUptimeMonth(r.month)}?`,
                        description: `The ${formatUptimePercent(r.uptimePercent)} recorded for ${system.name} will be removed. This can't be undone.`,
                        confirmLabel: "Delete uptime",
                        destructive: true,
                      });
                      if (!ok) return;
                      remove.mutate(r.id, {
                        onSuccess: () => toast.success("Uptime deleted"),
                        onError: (err) =>
                          toast.error(
                            err instanceof Error ? err.message : "Couldn't delete uptime",
                          ),
                      });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {dirty ? "Cancel" : "Close"}
        </Button>
      </DialogFooter>
    </>
  );
}
