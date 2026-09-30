import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useContracts } from "@/features/clients/use-clients-contracts";
import { formatCurrency, monthlyRecurringRevenue } from "@/features/finance/finance";
import { CurrencyNote, splitByCurrency, useCompanyCurrency } from "@/features/finance/money";
import { CHART_BLUE } from "@/components/chart-colors";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";

const monthEdges = (monthsAgo: number) => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const last = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0);
  return {
    label: first.toLocaleDateString("en-GB", { month: "short" }),
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
  };
};

/** The money recurring contracts bring in each month, over the last six months. */
export function MrrTrendPanel() {
  const contractsQ = useContracts();
  const companyCurrency = useCompanyCurrency();
  const all = contractsQ.data ?? [];
  const split = splitByCurrency(all, (c) => c.currency, companyCurrency);
  const recurring = split.inCompany.filter((c) => c.billing_frequency !== "one_off");

  const trend = Array.from({ length: 6 }, (_, i) => {
    const { label, from, to } = monthEdges(5 - i);
    // Contracts that were running that month, valued the way today's figure is.
    const running = recurring.filter(
      (c) =>
        c.status !== "draft" &&
        c.start_date <= to &&
        (!c.end_date || c.end_date >= from) &&
        c.status !== "terminated",
    );
    return {
      month: label,
      mrr: Math.round(monthlyRecurringRevenue(running.map((c) => ({ ...c, status: "active" })))),
    };
  });
  const latest = trend[trend.length - 1].mrr;
  const previous = trend[trend.length - 2]?.mrr ?? 0;
  const change = latest - previous;

  return (
    <section className="rounded-xl border bg-card" aria-labelledby="mrr-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="mrr-heading" className="text-sm font-semibold">
          Money coming in every month
        </h2>
        <Link to="/clients/contracts" className="text-xs font-medium text-primary hover:underline">
          All contracts
        </Link>
      </div>

      {contractsQ.isError ? (
        <div className="p-4">
          <LoadError
            what="contracts"
            error={contractsQ.error}
            onRetry={() => contractsQ.refetch()}
          />
        </div>
      ) : contractsQ.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : recurring.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-sm font-medium">No repeating contracts yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            A monthly, quarterly or yearly contract is what makes this figure. One-off jobs are not
            counted here.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link to="/clients/contracts">Open contracts</Link>
          </Button>
        </div>
      ) : (
        <div className="p-4">
          <p className="text-xs text-muted-foreground">
            <span className="text-base font-semibold tabular-nums text-foreground">
              {formatCurrency(latest, companyCurrency)}
            </span>{" "}
            this month ·{" "}
            {change === 0
              ? "unchanged from last month"
              : `${formatCurrency(Math.abs(change), companyCurrency)} ${change > 0 ? "more" : "less"} than last month`}
          </p>
          <CurrencyNote
            companyCurrency={companyCurrency}
            otherCount={split.otherCount}
            otherCodes={split.otherCodes}
            what="contract"
            className="mt-1"
          />
          <div className="mt-3 h-48">
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  domain={["auto", "auto"]}
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}K`}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v: number) => [formatCurrency(v, companyCurrency), "Each month"]}
                />
                <Line
                  type="monotone"
                  dataKey="mrr"
                  name="Each month"
                  stroke={CHART_BLUE}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}
