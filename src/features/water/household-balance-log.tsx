import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import {
  useDeleteWaterReading,
  useWaterBalancePeriods,
  WATER_BALANCE_FLAG_HINTS,
  WATER_BALANCE_FLAG_LABELS,
  type WaterBalanceFlag,
} from "@/features/water/use-water";
import type { ReadingFormValue } from "@/features/water/reading-form-dialog";
import { confirmDeleteReading, deleteErrorToast } from "@/features/water/water-delete";
import { RowActions } from "@/components/row-actions";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format-date";
import { cn } from "@/lib/utils";

const BALANCE_FLAG_STYLES: Record<WaterBalanceFlag, string> = {
  balance_too_high: "bg-destructive/15 text-destructive",
  counter_decreased: "bg-destructive/15 text-destructive",
  usage_mismatch: "bg-warning/15 text-warning",
  no_use: "bg-warning/15 text-warning",
  high_use: "bg-warning/15 text-warning",
};

export function BalanceFlagBadge({ flag }: { flag: WaterBalanceFlag }) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        BALANCE_FLAG_STYLES[flag],
      )}
      title={WATER_BALANCE_FLAG_HINTS[flag]}
    >
      {WATER_BALANCE_FLAG_LABELS[flag]}
    </span>
  );
}

const units = (n: number | null) =>
  n === null ? "Not captured" : n.toLocaleString(undefined, { maximumFractionDigits: 2 });

/** Each captured usage counter and prepaid balance, with usage between captures. */
export function HouseholdBalanceLog({
  meterId,
  meterNumber,
  canManage,
  onAdd,
  onEdit,
}: {
  meterId: string;
  meterNumber: string;
  canManage: boolean;
  onAdd?: () => void;
  onEdit: (value: ReadingFormValue) => void;
}) {
  const rowsQ = useWaterBalancePeriods(meterId);
  const deleteReading = useDeleteWaterReading();
  const rows = rowsQ.data ?? [];

  const remove = async (row: (typeof rows)[number]) => {
    const ok = await confirmDeleteReading({
      meter_number: meterNumber,
      value: row.balance,
      reading_date: row.reading_date,
    });
    if (!ok) return;
    deleteReading.mutate(row.id, {
      onSuccess: () => toast.success("Reading deleted"),
      onError: deleteErrorToast,
    });
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4 pb-0">
        <div>
          <div className="text-sm font-semibold">Household readings</div>
          <p className="text-xs text-muted-foreground">
            Usage = change in the lifetime counter. Credit check = opening balance + purchases -
            remaining balance.
          </p>
        </div>
        {onAdd && (
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Record household reading
          </Button>
        )}
      </div>
      {rowsQ.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : rowsQ.isError ? (
        <LoadError
          what="household readings"
          error={rowsQ.error}
          onRetry={() => rowsQ.refetch()}
          className="m-4"
        />
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          No household readings yet. Capture both figures twice to calculate and reconcile usage.
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Read on</th>
                <th className="px-4 py-2 text-right font-medium">Remaining units</th>
                <th className="px-4 py-2 text-right font-medium">Lifetime used</th>
                <th className="px-4 py-2 text-right font-medium">Bought since last</th>
                <th className="px-4 py-2 text-right font-medium">Counter usage</th>
                <th className="px-4 py-2 text-right font-medium">Usage from credit</th>
                <th className="px-4 py-2 text-right font-medium">Difference</th>
                <th className="px-4 py-2 text-right font-medium">Per day</th>
                <th className="px-4 py-2 font-medium">Check</th>
                {canManage && (
                  <th className="w-12">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = r.period;
                return (
                  <tr key={r.id} className="border-b last:border-0 align-top">
                    <td className="px-4 py-2 text-xs whitespace-nowrap">
                      {formatDateTime(r.reading_date)}
                      {r.notes && (
                        <div className="text-muted-foreground whitespace-normal">{r.notes}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-xs tabular-nums">
                      {units(r.balance)}
                    </td>
                    <td className="px-4 py-2 text-right text-xs tabular-nums">
                      {r.cumulative_usage === null ? "Not captured" : units(r.cumulative_usage)}
                    </td>
                    <td className="px-4 py-2 text-right text-xs tabular-nums">
                      {p ? units(p.purchased) : "—"}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2 text-right text-xs tabular-nums",
                        p && p.used < 0 && "font-semibold text-destructive",
                      )}
                    >
                      {p?.measured_used != null ? units(p.measured_used) : "Not available"}
                    </td>
                    <td className="px-4 py-2 text-right text-xs tabular-nums">
                      {p ? units(p.credit_used) : "Starting balance"}
                    </td>
                    <td className="px-4 py-2 text-right text-xs tabular-nums">
                      {p?.difference != null ? units(p.difference) : "Not available"}
                    </td>
                    <td className="px-4 py-2 text-right text-xs tabular-nums">
                      {p?.per_day != null ? units(p.per_day) : "—"}
                      {p?.baseline_per_day != null && (
                        <div className="text-muted-foreground">
                          usual {units(p.baseline_per_day)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {p && p.flags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {p.flags.map((f) => (
                            <BalanceFlagBadge key={f} flag={f} />
                          ))}
                        </div>
                      ) : p ? (
                        <span className="text-xs text-muted-foreground">OK</span>
                      ) : null}
                    </td>
                    {canManage && (
                      <td className="px-2 py-1.5">
                        <RowActions
                          label={`balance of ${units(r.balance)}`}
                          onEdit={() =>
                            onEdit({
                              id: r.id,
                              meter_id: meterId,
                              meter_number: meterNumber,
                              meter_type: "household",
                              reading_date: r.reading_date,
                              value: r.balance,
                              cumulative_usage: r.cumulative_usage,
                              notes: r.notes,
                            })
                          }
                          onDelete={() => remove(r)}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
