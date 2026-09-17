import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Loader2,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Percent,
  FileText,
  Plus,
  Repeat,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { Button } from "@/components/ui/button";
import {
  useInvoices,
  usePayments,
  paymentsByInvoice,
  useServiceLines,
} from "@/features/finance/use-finance-data";
import {
  daysBetween,
  formatCurrency,
  invoiceOutstanding,
  invoiceRevenue,
  isBilledInvoice,
  monthlyRecurringRevenue,
} from "@/features/finance/finance";
import {
  CurrencyNote,
  MoneyTotal,
  splitByCurrency,
  totalsByCurrency,
  useCompanyCurrency,
  useFinanceAccess,
} from "@/features/finance/money";
import { StatTile } from "@/features/finance/stat-tile";
import { useContracts } from "@/features/clients/use-clients-contracts";

import { OwnWorkPanels } from "@/features/my-work/own-work-panels";
export const Route = createFileRoute("/_authenticated/finance/")({
  head: () => ({ meta: [{ title: "Finance — AIMS" }] }),
  component: FinanceOverview,
});

function FinanceOverview() {
  const { canRaiseInvoices } = useFinanceAccess();
  const companyCurrency = useCompanyCurrency();
  const invoicesQ = useInvoices();
  const paymentsQ = usePayments();
  const serviceLinesQ = useServiceLines();
  const contractsQ = useContracts();

  const loading = invoicesQ.isLoading || paymentsQ.isLoading || serviceLinesQ.isLoading;
  const failed = [invoicesQ, paymentsQ, serviceLinesQ].find((q) => q.isError);

  const stats = useMemo(() => {
    const invoices = invoicesQ.data ?? [];
    const payments = paymentsQ.data ?? [];
    const serviceLines = serviceLinesQ.data ?? [];
    const contracts = contractsQ.data ?? [];
    const paidMap = paymentsByInvoice(payments);
    const cur = (i: { currency_code: string }) => i.currency_code;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const billed = invoices.filter(isBilledInvoice);
    const thisMonth = billed.filter((i) => new Date(i.issue_date) >= monthStart);
    const owed = billed.filter((i) => invoiceOutstanding(i, paidMap.get(i.id) ?? 0) > 0.01);
    const overdue = owed.filter((i) => daysBetween(now, new Date(i.due_date)) > 0);
    const outstandingOf = (i: (typeof billed)[number]) =>
      invoiceOutstanding(i, paidMap.get(i.id) ?? 0);

    // Recurring revenue is added up per contract currency.
    const recurring = contracts.filter(
      (c) => c.status === "active" && c.billing_frequency !== "one_off",
    );
    const mrr = new Map<string, number>();
    for (const code of new Set(recurring.map((c) => c.currency))) {
      mrr.set(code, monthlyRecurringRevenue(recurring.filter((c) => c.currency === code)));
    }

    // Margin and service-line bars use company-currency invoices only.
    const split = splitByCurrency(billed, cur, companyCurrency);
    const homeRevenue = split.inCompany.reduce((s, i) => s + invoiceRevenue(i), 0);
    const homeCost = split.inCompany.reduce((s, i) => s + Number(i.direct_cost), 0);
    const grossMargin = homeRevenue > 0 ? ((homeRevenue - homeCost) / homeRevenue) * 100 : null;

    const slMap = new Map(serviceLines.map((s) => [s.id, s]));
    const byLine = new Map<
      string,
      { name: string; recurring: boolean; total: number; cost: number }
    >();
    for (const inv of split.inCompany) {
      const sl = inv.service_line_id ? slMap.get(inv.service_line_id) : null;
      if (!sl) continue;
      const row = byLine.get(sl.id) ?? {
        name: sl.name,
        recurring: sl.is_recurring,
        total: 0,
        cost: 0,
      };
      row.total += invoiceRevenue(inv);
      row.cost += Number(inv.direct_cost);
      byLine.set(sl.id, row);
    }

    return {
      invoiceCount: invoices.length,
      billedCount: billed.length,
      thisMonthCount: thisMonth.length,
      monthRevenue: totalsByCurrency(thisMonth, cur, invoiceRevenue),
      totalRevenue: totalsByCurrency(billed, cur, invoiceRevenue),
      owedCount: owed.length,
      outstanding: totalsByCurrency(owed, cur, outstandingOf),
      overdueCount: overdue.length,
      overdue: totalsByCurrency(overdue, cur, outstandingOf),
      recurringCount: recurring.length,
      mrr,
      grossMargin,
      split,
      lines: Array.from(byLine.values()).sort((a, b) => b.total - a.total),
    };
  }, [invoicesQ.data, paymentsQ.data, serviceLinesQ.data, contractsQ.data, companyCurrency]);

  const money = (totals: Map<string, number>) => (
    <MoneyTotal totals={totals} companyCurrency={companyCurrency} />
  );
  const noInvoices = stats.billedCount === 0 ? "No invoices yet" : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        description="Money in and money out: raise invoices, record payments and bills, and see who still owes you."
        actions={
          canRaiseInvoices ? (
            <Button asChild>
              <Link to="/finance/invoices" search={{ new: 1 }}>
                <Plus className="mr-1 h-4 w-4" /> New invoice
              </Link>
            </Button>
          ) : undefined
        }
      />
      {!canRaiseInvoices && <ViewOnlyBanner area="Finance" action="raise invoices" />}
      <OwnWorkPanels departmentCode="finance" role="finance" />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2
            className="h-6 w-6 animate-spin text-primary"
            aria-label="Loading finance figures"
          />
        </div>
      ) : failed ? (
        <LoadError
          what="finance figures"
          error={failed.error}
          onRetry={() => {
            void invoicesQ.refetch();
            void paymentsQ.refetch();
            void serviceLinesQ.refetch();
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatTile
              label="Revenue this month"
              value={money(stats.monthRevenue)}
              hint="Sent invoices, before VAT"
              icon={DollarSign}
              emptyText={
                noInvoices ?? (stats.thisMonthCount === 0 ? "No invoices this month" : undefined)
              }
            />
            <StatTile
              label="Monthly recurring revenue (MRR)"
              value={money(stats.mrr)}
              hint="What active recurring contracts bring in each month"
              icon={Repeat}
              emptyText={
                contractsQ.isError
                  ? "Couldn't load contracts"
                  : stats.recurringCount === 0
                    ? "No active recurring contracts"
                    : undefined
              }
            />
            <StatTile
              label="Revenue to date"
              value={money(stats.totalRevenue)}
              hint="All sent invoices, before VAT"
              icon={TrendingUp}
              emptyText={noInvoices}
            />
            <StatTile
              label="Still owed to us"
              value={money(stats.outstanding)}
              hint={`${stats.owedCount} unpaid invoice${stats.owedCount === 1 ? "" : "s"}`}
              icon={FileText}
              tone={stats.owedCount > 0 ? "warning" : "default"}
              emptyText={noInvoices}
            />
            <StatTile
              label="Overdue"
              value={money(stats.overdue)}
              hint={
                stats.overdueCount > 0
                  ? `${stats.overdueCount} invoice${stats.overdueCount === 1 ? "" : "s"} past the due date`
                  : "Nothing past the due date"
              }
              icon={AlertCircle}
              tone={stats.overdueCount > 0 ? "danger" : "default"}
              emptyText={noInvoices}
            />
            <StatTile
              label="Gross margin"
              value={stats.grossMargin === null ? "—" : `${stats.grossMargin.toFixed(1)}%`}
              hint={`Revenue left after direct costs${stats.split.otherCount > 0 ? ` · ${companyCurrency} invoices only` : ""}`}
              icon={Percent}
              tone={stats.grossMargin !== null && stats.grossMargin < 0 ? "danger" : "default"}
              emptyText={
                noInvoices ??
                (stats.grossMargin === null ? `No ${companyCurrency} invoices yet` : undefined)
              }
            />
          </div>

          <div className="rounded-lg border bg-card p-4 sm:p-6">
            <h2 className="mb-1 font-semibold">Revenue by service line</h2>
            <p className="text-xs text-muted-foreground">
              All sent invoices, before VAT. Margin is what's left after direct costs.
            </p>
            <CurrencyNote
              companyCurrency={companyCurrency}
              otherCount={stats.split.otherCount}
              otherCodes={stats.split.otherCodes}
              className="mb-4"
            />
            {stats.invoiceCount === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground">
                <span>No invoices yet</span>
                {canRaiseInvoices && (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button size="sm" asChild>
                      <Link to="/finance/invoices" search={{ new: 1 }}>
                        <Plus className="mr-1 h-4 w-4" /> New invoice
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/finance/upload">
                        <Upload className="mr-1 h-4 w-4" /> Import invoices from Excel
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            ) : stats.lines.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground">
                <span className="max-w-md text-center">
                  {stats.billedCount === 0
                    ? "No sent invoices yet. Draft and void invoices aren't counted here."
                    : "None of your sent invoices has a service line. Set a service line on an invoice to see it here."}
                </span>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/finance/invoices">
                    <FileText className="mr-1 h-4 w-4" /> Open invoices
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.lines.map((l) => {
                  const max = Math.max(...stats.lines.map((x) => x.total));
                  const pct = max > 0 ? (l.total / max) * 100 : 0;
                  const margin = l.total > 0 ? ((l.total - l.cost) / l.total) * 100 : null;
                  return (
                    <div key={l.name}>
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 text-sm">
                        <span className="font-medium">
                          {l.name}{" "}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {l.recurring ? "Recurring" : "One-off"}
                          </span>
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatCurrency(l.total, companyCurrency)} · margin{" "}
                          {margin === null ? "—" : `${margin.toFixed(0)}%`}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={l.recurring ? "h-full bg-primary" : "h-full bg-accent"}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
