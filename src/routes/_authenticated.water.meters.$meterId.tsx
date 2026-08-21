import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
  useWaterReadingsWithDelta,
  vendingHealth,
  VENDING_HEALTH_LABELS,
  VENDING_HEALTH_BADGE_STYLES,
  WATER_METER_TYPE_LABELS,
  WATER_VENDING_SYSTEM_LABELS,
} from "@/features/water/use-water";
import { Badge } from "@/components/ui/badge";
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

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString() : "—";
}

function MeterDetailPage() {
  const { meterId } = Route.useParams();
  const [months, setMonths] = useState(6);
  const detailQ = useWaterMeterDetail(meterId, months);

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

  const isReadingMeter = d.meter_type !== "household";
  const health = vendingHealth(d.totals.last_vend_at);
  const avgPerVend =
    !isReadingMeter && d.totals.transaction_count > 0
      ? d.totals.revenue / d.totals.transaction_count
      : 0;

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
            {d.name && <span className="text-muted-foreground font-normal">— {d.name}</span>}
          </h1>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <Badge variant="secondary">{WATER_METER_TYPE_LABELS[d.meter_type]}</Badge>
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
            <Badge
              className={
                d.is_active
                  ? "bg-success text-success-foreground"
                  : "bg-muted text-muted-foreground"
              }
            >
              {d.is_active ? "Active" : "Inactive"}
            </Badge>
            {!isReadingMeter && (
              <Badge className={VENDING_HEALTH_BADGE_STYLES[health]}>
                {VENDING_HEALTH_LABELS[health]}
              </Badge>
            )}
          </div>
        </div>
        <div className="w-32">
          <Label className="text-xs">Trend period</Label>
          <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
            <SelectTrigger className="h-9">
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label={isReadingMeter ? "Lifetime volume" : "Lifetime units sold"}
          value={d.totals.units_sold.toLocaleString()}
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
          label={isReadingMeter ? "Readings" : "Transactions"}
          value={d.totals.transaction_count.toLocaleString()}
        />
        <StatCard
          label={isReadingMeter ? "Last reading" : "Last vend"}
          value={fmtDate(d.totals.last_vend_at)}
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
            <div className="font-medium">{d.customer?.name ?? "Unassigned"}</div>
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
          <div className="font-medium">{fmtDate(d.installed_at)}</div>
        </div>
        {(d.replaces_meter || d.replaced_by_meter) && (
          <div>
            <div className="text-xs text-muted-foreground">Replacement lineage</div>
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
              : `${d.totals.transaction_count} reading${d.totals.transaction_count === 1 ? "" : "s"} logged, totalling ${d.totals.units_sold.toLocaleString()} units drawn over that time. Each figure below is the delta between consecutive readings — last reading to current reading — not a raw dial value.`
            : d.totals.transaction_count === 0
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
        <div className="text-sm font-semibold mb-2">{months}-month trend</div>
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
                name={isReadingMeter ? "Volume" : "Units sold"}
                stroke="#0F7A78"
                strokeWidth={2}
              />
              {!isReadingMeter && (
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#B9762A"
                  strokeWidth={2}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {isReadingMeter ? (
        <MeterReadingLog meterId={d.id} />
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="p-4 pb-0 text-sm font-semibold">Recent transactions</div>
          {d.recent_usage.length === 0 ? (
            <div className="text-xs text-muted-foreground py-8 text-center">
              No transactions yet.
            </div>
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
      )}
    </div>
  );
}

function MeterReadingLog({ meterId }: { meterId: string }) {
  const readingsQ = useWaterReadingsWithDelta({ meterId });
  const rows = readingsQ.data ?? [];

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="p-4 pb-0 text-sm font-semibold">Reading log</div>
      {readingsQ.isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-muted-foreground py-8 text-center">
          No readings logged yet.
        </div>
      ) : (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Date & time</th>
                <th className="px-4 py-2 font-medium text-right">Reading</th>
                <th className="px-4 py-2 font-medium text-right">Usage since last</th>
                <th className="px-4 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-4 py-2 text-xs">{new Date(r.reading_date).toLocaleString()}</td>
                  <td className="px-4 py-2 text-xs text-right tabular-nums">
                    {r.value.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-xs text-right tabular-nums">
                    {r.delta === null ? (
                      <span className="text-muted-foreground">first reading</span>
                    ) : (
                      `+${r.delta.toLocaleString()}`
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{r.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
