import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Pencil, Trash2, UserRound } from "lucide-react";
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
  useWaterCustomerDetail,
  useDeleteWaterCustomer,
  useCanManageWater,
  vendingHealth,
  VENDING_HEALTH_LABELS,
  VENDING_HEALTH_BADGE_STYLES,
  WATER_METER_TYPE_LABELS,
} from "@/features/water/use-water";
import { CustomerFormDialog } from "@/features/water/customer-form-dialog";
import { WithTerm, formatPeriodKey } from "@/features/water/water-ui";
import { confirmDeleteCustomer, deleteErrorToast } from "@/features/water/water-delete";
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

export const Route = createFileRoute("/_authenticated/water/customers/$customerId")({
  head: () => ({ meta: [{ title: "Customer — Water Project — AIMS" }] }),
  component: CustomerDetailPage,
});

const MONTH_OPTIONS = [3, 6, 12, 24];

function BackLink() {
  return (
    <Link
      to="/water/customers"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back to Customers
    </Link>
  );
}

function CustomerDetailPage() {
  const { customerId } = Route.useParams();
  const [months, setMonths] = useState(6);
  const detailQ = useWaterCustomerDetail(customerId, months);
  const canManage = useCanManageWater();
  const navigate = useNavigate();
  const deleteCustomer = useDeleteWaterCustomer();
  const [editOpen, setEditOpen] = useState(false);

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
        <LoadError what="this customer" error={detailQ.error} onRetry={() => detailQ.refetch()} />
      </div>
    );
  }

  const health = vendingHealth(d.totals.last_vend_at);
  const avgPerVend =
    d.totals.transaction_count > 0 ? d.totals.revenue / d.totals.transaction_count : 0;
  const monthly = d.monthly.map((m) => ({ ...m, month: formatPeriodKey(m.month) }));

  const handleDelete = async () => {
    if (!(await confirmDeleteCustomer({ name: d.name, meter_count: d.meters.length }))) return;
    deleteCustomer.mutate(d.id, {
      onSuccess: () => {
        toast.success(`Customer "${d.name}" deleted`);
        navigate({ to: "/water/customers" });
      },
      onError: deleteErrorToast,
    });
  };

  return (
    <div className="space-y-4">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <UserRound className="h-5 w-5 text-primary" aria-hidden="true" />
            {d.name}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            This customer&apos;s meters, water purchases and usage trend.
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <Badge
              className={
                d.is_active
                  ? "bg-success text-success-foreground"
                  : "bg-muted text-muted-foreground"
              }
            >
              {d.is_active ? "Active" : "Inactive"}
            </Badge>
            <Badge className={VENDING_HEALTH_BADGE_STYLES[health]}>
              {VENDING_HEALTH_LABELS[health]}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {canManage && (
            <>
              <Button size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit customer
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={deleteCustomer.isPending}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete customer
              </Button>
            </>
          )}
          <div className="w-32">
            <Label htmlFor="customer-trend-period" className="text-xs">
              Trend period
            </Label>
            <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
              <SelectTrigger id="customer-trend-period" className="h-9">
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

      <CustomerFormDialog
        value={
          editOpen
            ? {
                id: d.id,
                name: d.name,
                zone_id: d.zone?.id ?? null,
                phone: d.phone,
                is_active: d.is_active,
              }
            : null
        }
        onClose={() => setEditOpen(false)}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label={<WithTerm term="units">Lifetime units bought</WithTerm>}
          value={`${d.totals.units_sold.toLocaleString()} m³`}
        />
        <StatCard
          label="Lifetime spend"
          value={d.totals.revenue.toLocaleString(undefined, { style: "currency", currency: "KES" })}
        />
        <StatCard label="Purchases" value={d.totals.transaction_count.toLocaleString()} />
        <StatCard label="Last purchase" value={formatDate(d.totals.last_vend_at)} />
      </div>

      <div className="rounded-lg border bg-card p-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Phone</div>
          <div className="font-medium">{d.phone ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Zone</div>
          <div className="font-medium">{d.zone?.name ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Customer since</div>
          <div className="font-medium">{formatDate(d.created_at)}</div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-semibold mb-1">Insights</div>
        <p className="text-xs text-muted-foreground">
          {d.totals.transaction_count === 0
            ? "No purchases recorded yet for this customer."
            : `Averaging ${avgPerVend.toLocaleString(undefined, { style: "currency", currency: "KES" })} per purchase across ${d.totals.transaction_count} purchase${d.totals.transaction_count === 1 ? "" : "s"} on ${d.meters.length} meter${d.meters.length === 1 ? "" : "s"}. ${
                health === "active"
                  ? "Buying tokens regularly — no action needed."
                  : health === "slowing"
                    ? "Purchases have slowed over the last month — worth a check-in."
                    : "No purchases in over 90 days — check whether they've moved on or the meter needs attention."
              }`}
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-semibold mb-2">Meters ({d.meters.length})</div>
        {d.meters.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center">
            No meters registered to this customer. Assign one from the Meters Registry.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {d.meters.map((m) => (
              <Link
                key={m.id}
                to="/water/meters/$meterId"
                params={{ meterId: m.id }}
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs hover:bg-secondary/60 transition-colors"
              >
                <span className="font-mono">{m.meter_number}</span>
                <Badge variant="secondary" className="text-[0.625rem]">
                  {WATER_METER_TYPE_LABELS[m.meter_type]}
                </Badge>
                <Badge
                  className={
                    m.is_active
                      ? "bg-success/15 text-success text-[0.625rem]"
                      : "bg-muted text-muted-foreground text-[0.625rem]"
                  }
                  variant="secondary"
                >
                  {m.is_active ? "Active" : "Inactive"}
                </Badge>
              </Link>
            ))}
          </div>
        )}
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
                name="Units bought (m³)"
                stroke="#0F7A78"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                name="Spend (KES)"
                stroke="#B9762A"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

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
                  <th className="px-4 py-2 font-medium">Meter</th>
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
                    <td className="px-4 py-2 text-xs font-mono">{r.meter_number}</td>
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
