import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ArrowLeft, Droplets, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  useWaterMeterDetail,
  useWaterReadingsWithDelta,
  useDeleteWaterMeter,
  useDeleteWaterReading,
  useCanManageWater,
  vendingHealth,
  VENDING_HEALTH_LABELS,
  VENDING_HEALTH_BADGE_STYLES,
  WATER_METER_TYPE_LABELS,
  WATER_VENDING_SYSTEM_LABELS,
  type WaterMeterDetail,
} from "@/features/water/use-water";
import { MeterFormDialog, type MeterFormValue } from "@/features/water/meter-form-dialog";
import { ReadingFormDialog, type ReadingFormValue } from "@/features/water/reading-form-dialog";
import { ListEmpty, TermInfo, WithTerm, formatPeriodKey } from "@/features/water/water-ui";
import { RowActions } from "@/components/row-actions";
import {
  confirmDeleteMeter,
  confirmDeleteReading,
  deleteErrorToast,
} from "@/features/water/water-delete";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/water/meters/$meterId")({
  head: () => ({ meta: [{ title: "Meter — Water Project — AIMS" }] }),
  component: MeterDetailPage,
});

const MONTH_OPTIONS = [3, 6, 12, 24];

function toFormValue(d: WaterMeterDetail): MeterFormValue {
  return {
    id: d.id,
    meter_number: d.meter_number,
    meter_type: d.meter_type,
    name: d.name,
    location: d.location,
    customer_id: d.customer?.id ?? null,
    customer_name: d.customer?.name ?? null,
    plot_no: d.plot_no,
    installed_at: d.installed_at,
    zone_id: d.zone?.id ?? null,
    is_active: d.is_active,
    vending_system: d.vending_system,
    replaces_meter_id: d.replaces_meter_id,
  };
}

function BackLink() {
  return (
    <Link
      to="/water/meters"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back to Meters Registry
    </Link>
  );
}

function MeterDetailPage() {
  const { meterId } = Route.useParams();
  const [months, setMonths] = useState(6);
  const detailQ = useWaterMeterDetail(meterId, months);
  const canManage = useCanManageWater();
  const navigate = useNavigate();
  const deleteMeter = useDeleteWaterMeter();
  const [editOpen, setEditOpen] = useState(false);
  const [readingDialog, setReadingDialog] = useState<ReadingFormValue | "new" | null>(null);

  if (detailQ.isLoading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  const d = detailQ.data;
  if (detailQ.isError || !d) {
    return (
      <div className="space-y-4">
        <BackLink />
        <LoadError what="this meter" error={detailQ.error} onRetry={() => detailQ.refetch()} />
      </div>
    );
  }

  const isReadingMeter = d.meter_type !== "household";
  const canRecordReading = canManage && isReadingMeter && d.is_active;
  const health = vendingHealth(d.totals.last_vend_at);
  const avgPerVend =
    !isReadingMeter && d.totals.transaction_count > 0
      ? d.totals.revenue / d.totals.transaction_count
      : 0;
  const monthly = d.monthly.map((m) => ({ ...m, month: formatPeriodKey(m.month) }));

  const handleDelete = async () => {
    const ok = await confirmDeleteMeter({
      meter_number: d.meter_number,
      vend_count: isReadingMeter ? 0 : d.totals.transaction_count,
      reading_count: isReadingMeter ? d.totals.transaction_count : 0,
    });
    if (!ok) return;
    deleteMeter.mutate(d.id, {
      onSuccess: () => {
        toast.success(`Meter ${d.meter_number} deleted`);
        navigate({ to: "/water/meters" });
      },
      onError: deleteErrorToast,
    });
  };

  return (
    <div className="space-y-4">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold flex flex-wrap items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" aria-hidden="true" />
            <span>
              Meter <span className="font-mono">{d.meter_number}</span>
            </span>
            {d.name && <span className="text-muted-foreground font-normal">— {d.name}</span>}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isReadingMeter
              ? "This meter's dial readings, how much water passed through it, and its details."
              : "This meter's purchases, usage trend and details."}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className="inline-flex items-center">
              <Badge variant="secondary">{WATER_METER_TYPE_LABELS[d.meter_type]} meter</Badge>
              <TermInfo term={d.meter_type} />
            </span>
            <span className="inline-flex items-center">
              <Badge
                className={
                  d.vending_system === "mpaya"
                    ? "bg-accent/10 text-accent"
                    : "bg-primary/10 text-primary"
                }
                variant="secondary"
              >
                {WATER_VENDING_SYSTEM_LABELS[d.vending_system]}
              </Badge>
              <TermInfo term="vending" />
            </span>
            <Badge
              className={
                d.is_active
                  ? "bg-success text-success-foreground"
                  : "bg-muted text-muted-foreground"
              }
            >
              {d.is_active ? "Active (in use)" : "Inactive (not in use)"}
            </Badge>
            {!isReadingMeter && (
              <Badge className={VENDING_HEALTH_BADGE_STYLES[health]}>
                {VENDING_HEALTH_LABELS[health]}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {canManage && (
            <>
              {canRecordReading && (
                <Button size="sm" onClick={() => setReadingDialog("new")}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Record reading
                </Button>
              )}
              <Button
                size="sm"
                variant={canRecordReading ? "outline" : "default"}
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit meter
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={deleteMeter.isPending}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete meter
              </Button>
            </>
          )}
          <div className="w-32">
            <Label htmlFor="meter-trend-period" className="text-xs">
              Trend period
            </Label>
            <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
              <SelectTrigger id="meter-trend-period" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} months
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      {!canManage && <ViewOnlyBanner area="the Water Project" />}
      {canManage && isReadingMeter && !d.is_active && (
        <p className="text-xs text-muted-foreground">
          This meter is inactive, so it takes no new readings. Edit the meter and switch it to
          Active if it is back in use.
        </p>
      )}

      <MeterFormDialog
        value={editOpen ? toFormValue(d) : null}
        onClose={() => setEditOpen(false)}
      />
      <ReadingFormDialog
        value={readingDialog}
        meterId={d.id}
        onClose={() => setReadingDialog(null)}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label={
            isReadingMeter ? (
              <WithTerm term="m3">Lifetime volume (m³)</WithTerm>
            ) : (
              <WithTerm term="units">Lifetime units sold</WithTerm>
            )
          }
          value={`${d.totals.units_sold.toLocaleString()} m³`}
        />
        {isReadingMeter ? (
          <StatCard label="Readings logged" value={d.totals.transaction_count.toLocaleString()} />
        ) : (
          <StatCard
            label="Lifetime revenue"
            value={d.totals.revenue.toLocaleString(undefined, {
              style: "currency",
              currency: "KES",
            })}
          />
        )}
        <StatCard
          label={isReadingMeter ? "Readings" : "Purchases"}
          value={d.totals.transaction_count.toLocaleString()}
        />
        <StatCard
          label={isReadingMeter ? "Last reading" : "Last purchase"}
          value={formatDate(d.totals.last_vend_at)}
        />
      </div>

      <div className="rounded-lg border bg-card p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {isReadingMeter ? (
          <div>
            <div className="text-xs text-muted-foreground">Location</div>
            <div className="font-medium">{d.location ?? "—"}</div>
          </div>
        ) : (
          <div>
            <div className="text-xs text-muted-foreground">Customer</div>
            <div className="font-medium">
              {d.customer ? (
                <Link
                  to="/water/customers/$customerId"
                  params={{ customerId: d.customer.id }}
                  className="text-primary hover:underline"
                >
                  {d.customer.name}
                </Link>
              ) : (
                "Unassigned"
              )}
            </div>
          </div>
        )}
        <div>
          <div className="text-xs text-muted-foreground">
            {isReadingMeter ? "Zone covered" : "Zone"}
          </div>
          <div className="font-medium">{d.zone?.name ?? "—"}</div>
        </div>
        {!isReadingMeter && (
          <div>
            <div className="text-xs text-muted-foreground">Plot number</div>
            <div className="font-medium">{d.plot_no ?? "—"}</div>
          </div>
        )}
        <div>
          <div className="text-xs text-muted-foreground">Installed</div>
          <div className="font-medium">{formatDate(d.installed_at)}</div>
        </div>
        {(d.replaces_meter || d.replaced_by_meter) && (
          <div>
            <div className="text-xs text-muted-foreground">Replacement</div>
            <div className="font-medium space-y-0.5">
              {d.replaces_meter && (
                <div>
                  Replaces{" "}
                  <Link
                    to="/water/meters/$meterId"
                    params={{ meterId: d.replaces_meter.id }}
                    className="text-primary hover:underline font-mono"
                  >
                    {d.replaces_meter.meter_number}
                  </Link>
                </div>
              )}
              {d.replaced_by_meter && (
                <div>
                  Replaced by{" "}
                  <Link
                    to="/water/meters/$meterId"
                    params={{ meterId: d.replaced_by_meter.id }}
                    className="text-primary hover:underline font-mono"
                  >
                    {d.replaced_by_meter.meter_number}
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-semibold mb-1">Insights</div>
        <p className="text-xs text-muted-foreground">
          {isReadingMeter
            ? d.totals.transaction_count === 0
              ? "No readings logged yet for this meter."
              : `${d.totals.transaction_count} reading${d.totals.transaction_count === 1 ? "" : "s"} logged, totalling ${d.totals.units_sold.toLocaleString()} m³ over that time. Each figure below is the change since the previous reading, not the raw dial value.`
            : d.totals.transaction_count === 0
              ? "No purchases recorded yet for this meter."
              : `Averaging ${avgPerVend.toLocaleString(undefined, { style: "currency", currency: "KES" })} per purchase across ${d.totals.transaction_count} purchase${d.totals.transaction_count === 1 ? "" : "s"}. ${
                  !d.is_active
                    ? "This meter is inactive (not in use); its past purchases are kept for reporting."
                    : health === "active"
                      ? "Buying tokens regularly — no action needed."
                      : health === "slowing"
                        ? "Purchases have slowed over the last month — worth a check-in."
                        : "No purchases in over 90 days — check whether the meter is faulty or the customer has moved on."
                }`}
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-semibold mb-2">{months}-month trend</div>
        {d.monthly.every((m) => m.units_sold === 0 && m.revenue === 0) ? (
          <div className="text-xs text-muted-foreground py-8 text-center">
            No usage in this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthly} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="units_sold"
                name={isReadingMeter ? "Volume (m³)" : "Units sold (m³)"}
                stroke="#0F7A78"
                strokeWidth={2}
              />
              {!isReadingMeter && (
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue (KES)"
                  stroke="#B9762A"
                  strokeWidth={2}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {isReadingMeter ? (
        <MeterReadingLog
          meterId={d.id}
          canManage={canManage}
          onEdit={setReadingDialog}
          onAdd={canRecordReading ? () => setReadingDialog("new") : undefined}
        />
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="p-4 pb-0 text-sm font-semibold">Recent purchases</div>
          {d.recent_usage.length === 0 ? (
            <div className="text-xs text-muted-foreground py-8 text-center">
              No purchases yet. They appear here after a usage file is uploaded.
            </div>
          ) : (
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Date & time</th>
                    <th className="px-4 py-2 font-medium">Customer</th>
                    <th className="px-4 py-2 font-medium text-right">
                      <WithTerm term="units">Units (m³)</WithTerm>
                    </th>
                    <th className="px-4 py-2 font-medium text-right">Amount (KES)</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recent_usage.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-4 py-2 text-xs whitespace-nowrap">
                        {formatDateTime(r.recorded_at)}
                      </td>
                      <td className="px-4 py-2 text-xs">{r.customer_name}</td>
                      <td className="px-4 py-2 text-xs text-right tabular-nums">{r.units_sold}</td>
                      <td className="px-4 py-2 text-xs text-right tabular-nums">
                        {r.amount_paid.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MeterReadingLog({
  meterId,
  canManage,
  onEdit,
  onAdd,
}: {
  meterId: string;
  canManage: boolean;
  onEdit: (reading: ReadingFormValue) => void;
  onAdd?: () => void;
}) {
  const readingsQ = useWaterReadingsWithDelta({ meterId });
  const deleteReading = useDeleteWaterReading();
  const rows = readingsQ.data ?? [];

  const handleDelete = async (r: (typeof rows)[number]) => {
    if (!(await confirmDeleteReading(r))) return;
    deleteReading.mutate(r.id, {
      onSuccess: () => toast.success("Reading deleted"),
      onError: deleteErrorToast,
    });
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="p-4 pb-0 text-sm font-semibold">Reading log</div>
      {readingsQ.isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : readingsQ.isError ? (
        <LoadError
          what="readings"
          error={readingsQ.error}
          onRetry={() => readingsQ.refetch()}
          className="m-4"
        />
      ) : rows.length === 0 ? (
        <ListEmpty
          message="No readings yet"
          action={
            onAdd ? (
              <Button size="sm" onClick={onAdd}>
                <Plus className="h-4 w-4 mr-1" /> Record reading
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Date & time</th>
                <th className="px-4 py-2 font-medium text-right">Reading (m³)</th>
                <th className="px-4 py-2 font-medium text-right">Used since last (m³)</th>
                <th className="px-4 py-2 font-medium">Notes</th>
                {canManage && (
                  <th className="px-4 py-2 w-20">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-4 py-2 text-xs whitespace-nowrap">
                    {formatDateTime(r.reading_date)}
                  </td>
                  <td className="px-4 py-2 text-xs text-right tabular-nums">
                    {r.value.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-xs text-right tabular-nums">
                    {r.delta === null ? (
                      <span className="text-muted-foreground">First reading</span>
                    ) : (
                      `+${r.delta.toLocaleString()}`
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{r.notes ?? "—"}</td>
                  {canManage && (
                    <td className="px-2 py-1">
                      <RowActions
                        label={`reading of ${r.value.toLocaleString()} on ${formatDateTime(r.reading_date)}`}
                        onEdit={() => onEdit(r)}
                        onDelete={() => handleDelete(r)}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
