import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Search } from "lucide-react";
import {
  useCanManageWater,
  useDeleteWaterReading,
  useWaterHouseholdFlags,
  useWaterReadings,
  WATER_BALANCE_FLAG_HINTS,
  type WaterMeterReadingRow,
} from "@/features/water/use-water";
import { ReadingFormDialog, type ReadingFormValue } from "@/features/water/reading-form-dialog";
import { BalanceFlagBadge } from "@/features/water/household-balance-log";
import { ListEmpty, ListNoMatches } from "@/features/water/water-ui";
import { confirmDeleteReading, deleteErrorToast } from "@/features/water/water-delete";
import { RowActions } from "@/components/row-actions";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/pagination-bar";
import { DateRangeFilter, type DateRange } from "@/components/date-range-filter";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/water/balances")({
  head: () => ({ meta: [{ title: "Water Project — Household balances — AIMS" }] }),
  component: HouseholdBalancesPage,
});

const FLAG_WINDOWS = [1, 3, 6] as const;
const units = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

function HouseholdBalancesPage() {
  const canManage = useCanManageWater();
  const [editing, setEditing] = useState<ReadingFormValue | "new" | null>(null);

  const addButton = (
    <Button size="sm" onClick={() => setEditing("new")}>
      <Plus className="h-4 w-4 mr-1" /> Record balance
    </Button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Household balances"
        description="The credit left on each prepaid meter. With the units bought in between, it shows what each household really used."
        actions={canManage ? addButton : undefined}
      />
      {!canManage && <ViewOnlyBanner area="the Water Project" />}

      <NeedsChecking />
      <BalanceReadings canManage={canManage} addButton={addButton} onEdit={setEditing} />

      <ReadingFormDialog value={editing} kind="household" onClose={() => setEditing(null)} />
    </div>
  );
}

function NeedsChecking() {
  const [months, setMonths] = useState<number>(3);
  const flagsQ = useWaterHouseholdFlags(months);
  const rows = flagsQ.data ?? [];

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-0">
        <div>
          <div className="text-sm font-semibold">Households to check</div>
          <p className="text-xs text-muted-foreground">
            A flag is a reason to look, not proof. Check the reading and the purchase uploads before
            visiting.
          </p>
        </div>
        <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
          <SelectTrigger className="h-9 w-40" aria-label="Period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FLAG_WINDOWS.map((m) => (
              <SelectItem key={m} value={String(m)}>
                Last {m === 1 ? "month" : `${m} months`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {flagsQ.isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : flagsQ.isError ? (
        <LoadError
          what="households to check"
          error={flagsQ.error}
          onRetry={() => flagsQ.refetch()}
          className="m-4"
        />
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          No household needs checking in this period.
        </div>
      ) : (
        <div className="overflow-x-auto mt-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meter</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Check</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Used</TableHead>
                <TableHead className="text-right">Per day</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.meter_id}>
                  <TableCell className="text-xs">
                    <Link
                      to="/water/meters/$meterId"
                      params={{ meterId: r.meter_id }}
                      className="font-mono text-primary hover:underline"
                    >
                      {r.meter_number}
                    </Link>
                    {!r.meter_is_active && (
                      <div className="text-xs text-muted-foreground">Out of use</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{r.customer_name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.zone_name ?? "—"}</TableCell>
                  <TableCell className="max-w-72">
                    <BalanceFlagBadge flag={r.flag} />
                    <div className="mt-1 text-xs text-muted-foreground">
                      {WATER_BALANCE_FLAG_HINTS[r.flag]}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {formatDate(r.period.from)} – {formatDate(r.period.to)}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {units(r.period.used)}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {r.period.per_day != null ? units(r.period.per_day) : "—"}
                    {r.period.baseline_per_day != null && (
                      <div className="text-muted-foreground">
                        usual {units(r.period.baseline_per_day)}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function BalanceReadings({
  canManage,
  addButton,
  onEdit,
}: {
  canManage: boolean;
  addButton: React.ReactNode;
  onEdit: (value: ReadingFormValue) => void;
}) {
  const { page, pageSize, setPage, setPageSize } = usePagination(25);
  const [q, setQ] = useState("");
  const [range, setRange] = useState<DateRange>({});
  const [rangeKey, setRangeKey] = useState(0);
  const filters = {
    meterType: "household" as const,
    q: q.trim() || undefined,
    from: range.from,
    to: range.to,
  };
  const readingsQ = useWaterReadings(filters, { page, pageSize });
  const deleteReading = useDeleteWaterReading();
  const result = readingsQ.data;
  const readings = result ? (Array.isArray(result) ? result : result.data) : [];
  const total = result && !Array.isArray(result) ? result.total : readings.length;
  const hasFilters = !!(filters.q || range.from || range.to);

  const clearFilters = () => {
    setQ("");
    setRange({});
    setRangeKey((k) => k + 1);
    setPage(1);
  };

  const handleDelete = async (r: WaterMeterReadingRow) => {
    if (!(await confirmDeleteReading(r))) return;
    deleteReading.mutate(r.id, {
      onSuccess: () => toast.success("Balance deleted"),
      onError: deleteErrorToast,
    });
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex flex-wrap items-end gap-3 p-4 pb-0">
        <div className="mr-auto text-sm font-semibold">All balance readings</div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search meter number…"
            aria-label="Search balances by meter"
            className="pl-7"
          />
        </div>
        <div className="max-w-full overflow-x-auto">
          <DateRangeFilter
            key={rangeKey}
            value={range}
            onChange={(r) => {
              setRange(r);
              setPage(1);
            }}
          />
        </div>
      </div>
      {readingsQ.isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : readingsQ.isError ? (
        <LoadError
          what="balance readings"
          error={readingsQ.error}
          onRetry={() => readingsQ.refetch()}
          className="m-4"
        />
      ) : readings.length === 0 ? (
        hasFilters ? (
          <ListNoMatches onClear={clearFilters} />
        ) : (
          <ListEmpty message="No balances read yet" action={canManage ? addButton : undefined} />
        )
      ) : (
        <>
          <div className="overflow-x-auto mt-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Read on</TableHead>
                  <TableHead>Meter</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Notes</TableHead>
                  {canManage && (
                    <TableHead className="w-20">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {readings.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDateTime(r.reading_date)}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Link
                        to="/water/meters/$meterId"
                        params={{ meterId: r.meter_id }}
                        className="font-mono text-primary hover:underline"
                      >
                        {r.meter_number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{r.zone_name ?? "—"}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {units(r.value)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.notes ?? "—"}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <RowActions
                          label={`balance for meter ${r.meter_number} on ${formatDateTime(r.reading_date)}`}
                          onEdit={() => onEdit({ ...r, meter_type: "household" })}
                          onDelete={() => handleDelete(r)}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}
    </div>
  );
}
