import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Droplets, Loader2 } from "lucide-react";
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
  vendingHealth,
  VENDING_HEALTH_LABELS,
  VENDING_HEALTH_BADGE_STYLES,
  WATER_METER_TYPE_LABELS,
} from "@/features/water/use-water";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/water/meters/$meterId")({
  head: () => ({ meta: [{ title: "Meter — Water Project — AIMS" }] }),
  component: MeterDetailPage,
});

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString() : "—";
}

function MeterDetailPage() {
  const { meterId } = Route.useParams();
  const detailQ = useWaterMeterDetail(meterId);

  if (detailQ.isLoading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  const d = detailQ.data;
  if (!d) {
    return (
      <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
        Meter not found.
      </div>
    );
  }

  const health = vendingHealth(d.totals.last_vend_at);
  const avgPerVend =
    d.totals.transaction_count > 0 ? d.totals.revenue / d.totals.transaction_count : 0;

  return (
    <div className="space-y-4">
      <Link
        to="/water/meters"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Meters Registry
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            <span className="font-mono">{d.meter_number}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <Badge variant="secondary">{WATER_METER_TYPE_LABELS[d.meter_type]}</Badge>
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
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Lifetime units sold" value={d.totals.units_sold.toLocaleString()} />
        <StatCard
          label="Lifetime revenue"
          value={d.totals.revenue.toLocaleString(undefined, { style: "currency", currency: "KES" })}
        />
        <StatCard label="Transactions" value={d.totals.transaction_count.toLocaleString()} />
        <StatCard label="Last vend" value={fmtDate(d.totals.last_vend_at)} />
      </div>

      <div className="rounded-lg border bg-card p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Customer</div>
          <div className="font-medium">{d.customer?.name ?? "Unassigned"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Zone</div>
          <div className="font-medium">{d.zone?.name ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Plot number</div>
          <div className="font-medium">{d.plot_no ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Installed</div>
          <div className="font-medium">{fmtDate(d.installed_at)}</div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-semibold mb-1">Insights</div>
        <p className="text-xs text-muted-foreground">
          {d.totals.transaction_count === 0
            ? "No vending activity recorded yet for this meter."
            : `Averaging ${avgPerVend.toLocaleString(undefined, { style: "currency", currency: "KES" })} per transaction across ${d.totals.transaction_count} purchase${d.totals.transaction_count === 1 ? "" : "s"}. ${
                health === "active"
                  ? "Vending consistently — no action needed."
                  : health === "slowing"
                    ? "Purchases have slowed over the last month — worth a check-in."
                    : "No purchases in over 90 days — check whether the meter is faulty or the customer has moved on."
              }`}
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-semibold mb-2">6-month trend</div>
        {d.monthly.every((m) => m.units_sold === 0 && m.revenue === 0) ? (
          <div className="text-xs text-muted-foreground py-8 text-center">
            No usage in this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={d.monthly} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="units_sold"
                name="Units sold"
                stroke="#0F7A78"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="#B9762A"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="p-4 pb-0 text-sm font-semibold">Recent transactions</div>
        {d.recent_usage.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">No transactions yet.</div>
        ) : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium text-right">Units</th>
                  <th className="px-4 py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {d.recent_usage.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-2 text-xs">{fmtDate(r.recorded_at)}</td>
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

      {(d.meter_type === "main" || d.meter_type === "bulk") && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="p-4 pb-0 text-sm font-semibold">Recent dial readings</div>
          {d.recent_readings.length === 0 ? (
            <div className="text-xs text-muted-foreground py-8 text-center">
              No readings logged yet.
            </div>
          ) : (
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium text-right">Reading</th>
                    <th className="px-4 py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recent_readings.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-4 py-2 text-xs">{fmtDate(r.reading_date)}</td>
                      <td className="px-4 py-2 text-xs text-right tabular-nums">{r.value}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{r.notes ?? "—"}</td>
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
