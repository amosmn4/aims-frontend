import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  Loader2,
  Percent,
  Plus,
  Receipt,
  Repeat,
  Upload,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { StatLink } from "@/components/stat-link";
import { QuickLinks } from "@/components/quick-links";
import { SectionHeading } from "@/components/section-heading";
import { DEPARTMENT_QUICK_LINKS } from "@/lib/department-quick-links";
import { AgingBars, type AgingRow } from "@/components/aging-bars";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { Button } from "@/components/ui/button";
import {
  useInvoices,
  usePayments,
  paymentsByInvoice,
  useServiceLines,
} from "@/features/finance/use-finance-data";
import { useExpenses } from "@/features/finance/use-expenses";
import {
  computeAging,
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
import { MrrTrendPanel } from "@/features/finance/mrr-trend-panel";
import { TopDebtorsPanel } from "@/features/finance/top-debtors-panel";
import { ContractRenewalsPanel } from "@/features/finance/contract-renewals-panel";
import { useContracts } from "@/features/clients/use-clients-contracts";
import { OwnWorkPanels } from "@/features/my-work/own-work-panels";

export const Route = createFileRoute("/_authenticated/finance/")({
  head: () => ({ meta: [{ title: "Finance — AIMS" }] }),
  component: FinanceOverview,
});

const AGING_TONES: AgingRow["tone"][] = ["ok", "watch", "late", "bad", "bad"];

function FinanceOverview() {
  const { canRaiseInvoices } = useFinanceAccess();
  const companyCurrency = useCompanyCurrency();
  const invoicesQ = useInvoices();
  const paymentsQ = usePayments();
  const serviceLinesQ = useServiceLines();
  const contractsQ = useContracts();
  const expensesQ = useExpenses();

  const loading = invoicesQ.isLoading || paymentsQ.isLoading || serviceLinesQ.isLoading;
  const failed = [invoicesQ, paymentsQ, serviceLinesQ].find((q) => q.isError);

  const stats = useMemo(() => {
    const invoices = invoicesQ.data ?? [];
    const payments = paymentsQ.data ?? [];
    const serviceLines = serviceLinesQ.data ?? [];
    const contracts = contractsQ.data ?? [];
    const expenses = expensesQ.data ?? [];
    const paidMap = paymentsByInvoice(payments);
    const cur = (i: { currency_code: string }) => i.currency_code;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const billed = invoices.filter(isBilledInvoice);
    const invoiceById = new Map(billed.map((i) => [i.id, i]));
    const owed = billed.filter((i) => invoiceOutstanding(i, paidMap.get(i.id) ?? 0) > 0.01);
    const overdue = owed.filter((i) => daysBetween(now, new Date(i.due_date)) > 0);
    const outstandingOf = (i: (typeof billed)[number]) =>
      invoiceOutstanding(i, paidMap.get(i.id) ?? 0);

    // Money actually received this month, counted in the currency of its invoice.
    const receipts = payments
      .filter((p) => p.paid_on >= monthStart && invoiceById.has(p.invoice_id))
      .map((p) => ({
        amount: Number(p.amount),
        currency_code: invoiceById.get(p.invoice_id)!.currency_code,
      }));
    const spend = expenses.filter(
      (e) => e.status === "paid" && (e.paid_on ?? e.expense_date) >= monthStart,
    );

    const collectedAll = payments
      .filter((p) => invoiceById.has(p.invoice_id))
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const billedAll = billed.reduce((sum, i) => sum + Number(i.total), 0);
    const collectionRate = billedAll > 0 ? Math.round((collectedAll / billedAll) * 100) : null;

    const recurring = contracts.filter(
      (c) => c.status === "active" && c.billing_frequency !== "one_off",
    );
    const mrr = new Map<string, number>();
    for (const code of new Set(recurring.map((c) => c.currency))) {
      mrr.set(code, monthlyRecurringRevenue(recurring.filter((c) => c.currency === code)));
    }

    // Aging and service-line figures use company-currency invoices only.
    const split = splitByCurrency(billed, cur, companyCurrency);
    const aging = computeAging(split.inCompany, paidMap, now);

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
      moneyIn: totalsByCurrency(receipts, cur, (r) => r.amount),
      receiptCount: receipts.length,
      moneyOut: totalsByCurrency(spend, cur, (e) => Number(e.amount)),
      spendCount: spend.length,
      owedCount: owed.length,
      outstanding: totalsByCurrency(owed, cur, outstandingOf),
      overdueCount: overdue.length,
      overdue: totalsByCurrency(overdue, cur, outstandingOf),
      collectionRate,
      recurringCount: recurring.length,
      mrr,
      aging,
      split,
      lines: Array.from(byLine.values()).sort((a, b) => b.total - a.total),
    };
  }, [
    invoicesQ.data,
    paymentsQ.data,
    serviceLinesQ.data,
    contractsQ.data,
    expensesQ.data,
    companyCurrency,
  ]);

  const money = (totals: Map<string, number>) => (
    <MoneyTotal totals={totals} companyCurrency={companyCurrency} />
  );
  const noInvoices = stats.billedCount === 0 ? "No invoices yet" : undefined;

  const agingRows: AgingRow[] = stats.aging.map((bucket, i) => ({
    label:
      bucket.label === "Current"
        ? "Not due yet"
        : bucket.label === "90+ days"
          ? "Over 90 days late"
          : `${bucket.label.replace("-", "–")} late`,
    count: bucket.count,
    detail: formatCurrency(bucket.amount, companyCurrency),
    tone: AGING_TONES[i],
    to: "/finance/invoices",
    search: { status: bucket.label === "Current" ? "sent" : "overdue" },
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Finance"
        description="Money in and money out: what came in this month, who still owes us, and what is locked in for next month."
        actions={
          canRaiseInvoices ? (
            <>
              <Button variant="outline" asChild>
                <Link to="/finance/invoices">
                  <Receipt className="mr-1 h-4 w-4" /> Manage invoices
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/finance/debtors">
                  <Wallet className="mr-1 h-4 w-4" /> Manage debtors
                </Link>
              </Button>
              <Button asChild>
                <Link to="/finance/invoices" search={{ new: 1 }}>
                  <Plus className="mr-1 h-4 w-4" /> New invoice
                </Link>
              </Button>
            </>
          ) : undefined
        }
      />
      {!canRaiseInvoices && <ViewOnlyBanner area="Finance" action="raise invoices" />}

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
          <section aria-labelledby="fin-glance">
            <SectionHeading id="fin-glance">At a glance</SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <StatLink
                to="/finance/invoices"
                label="Money in this month"
                value={money(stats.moneyIn)}
                hint={`${stats.receiptCount} payment${stats.receiptCount === 1 ? "" : "s"} received`}
                icon={ArrowDownCircle}
                tone="positive"
                emptyText={stats.receiptCount === 0 ? "No payments in yet this month" : undefined}
              />
              <StatLink
                to="/finance/expenses"
                label="Money out this month"
                value={money(stats.moneyOut)}
                hint={`${stats.spendCount} bill${stats.spendCount === 1 ? "" : "s"} paid`}
                icon={ArrowUpCircle}
                emptyText={
                  expensesQ.isError
                    ? "Couldn't load bills"
                    : stats.spendCount === 0
                      ? "No bills paid yet this month"
                      : undefined
                }
              />
              <StatLink
                to="/finance/debtors"
                label="Still owed to us"
                value={money(stats.outstanding)}
                hint={`${stats.owedCount} unpaid invoice${stats.owedCount === 1 ? "" : "s"}`}
                icon={FileText}
                tone={stats.owedCount > 0 ? "warning" : "default"}
                emptyText={noInvoices}
              />
              <StatLink
                to="/finance/invoices"
                search={{ status: "overdue" }}
                label="Past the due date"
                value={money(stats.overdue)}
                hint={
                  stats.overdueCount > 0
                    ? `${stats.overdueCount} invoice${stats.overdueCount === 1 ? "" : "s"} to chase`
                    : "Nothing is late"
                }
                icon={AlertCircle}
                tone={stats.overdueCount > 0 ? "danger" : "positive"}
                emptyText={noInvoices}
              />
              <StatLink
                to="/finance/debtors"
                label="Of what we invoiced, paid"
                value={stats.collectionRate === null ? "—" : `${stats.collectionRate}%`}
                hint="Everything sent, since the start"
                icon={Percent}
                tone={
                  stats.collectionRate !== null && stats.collectionRate < 80 ? "warning" : "default"
                }
                emptyText={noInvoices}
              />
              <StatLink
                to="/clients/contracts"
                label="Locked in each month"
                value={money(stats.mrr)}
                hint={`${stats.recurringCount} repeating contract${stats.recurringCount === 1 ? "" : "s"}`}
                icon={Repeat}
                emptyText={
                  contractsQ.isError
                    ? "Couldn't load contracts"
                    : stats.recurringCount === 0
                      ? "No repeating contracts yet"
                      : undefined
                }
              />
            </div>
          </section>

          <QuickLinks links={DEPARTMENT_QUICK_LINKS.finance} />

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border bg-card" aria-labelledby="aging-heading">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <h2 id="aging-heading" className="text-sm font-semibold">
                  How long unpaid invoices have been waiting
                </h2>
                <Link
                  to="/finance/debtors"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Chase unpaid invoices
                </Link>
              </div>
              <div className="p-4">
                <AgingBars
                  rows={agingRows}
                  countLabel="invoices"
                  emptyText="Nothing is unpaid. Every invoice sent has been settled."
                />
                <CurrencyNote
                  companyCurrency={companyCurrency}
                  otherCount={stats.split.otherCount}
                  otherCodes={stats.split.otherCodes}
                  className="mt-3"
                />
              </div>
            </section>

            <TopDebtorsPanel />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <MrrTrendPanel />
            <ContractRenewalsPanel />
          </div>

          <section className="rounded-xl border bg-card" aria-labelledby="service-line-heading">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <h2 id="service-line-heading" className="text-sm font-semibold">
                Which service lines earn the money
              </h2>
              <Link
                to="/finance/revenue"
                className="text-xs font-medium text-primary hover:underline"
              >
                Full revenue report
              </Link>
            </div>
            <div className="p-4">
              <p className="text-xs text-muted-foreground">
                All sent invoices, before VAT. Margin is what is left after direct costs.
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
                <ul className="space-y-3">
                  {stats.lines.map((l) => {
                    const max = Math.max(...stats.lines.map((x) => x.total));
                    const pct = max > 0 ? (l.total / max) * 100 : 0;
                    const margin = l.total > 0 ? ((l.total - l.cost) / l.total) * 100 : null;
                    return (
                      <li key={l.name}>
                        <Link
                          to="/finance/revenue"
                          className="block rounded px-1 py-0.5 -mx-1 hover:bg-secondary/40"
                        >
                          <span className="mb-1 flex flex-wrap items-center justify-between gap-x-3 text-sm">
                            <span className="font-medium">
                              {l.name}{" "}
                              <span className="ml-2 text-xs text-muted-foreground">
                                {l.recurring ? "Repeating" : "One-off"}
                              </span>
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              {formatCurrency(l.total, companyCurrency)} · keeps{" "}
                              {margin === null ? "—" : `${margin.toFixed(0)}%`}
                            </span>
                          </span>
                          <span className="block h-2 overflow-hidden rounded-full bg-secondary">
                            <span
                              className={
                                l.recurring ? "block h-full bg-primary" : "block h-full bg-accent"
                              }
                              style={{ width: `${pct}%` }}
                            />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </>
      )}

      <OwnWorkPanels departmentCode="finance" role="finance" />
    </div>
  );
}
