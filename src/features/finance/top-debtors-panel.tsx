import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import {
  paymentsByInvoice,
  useClients,
  useInvoices,
  usePayments,
} from "@/features/finance/use-finance-data";
import {
  daysBetween,
  formatCurrency,
  invoiceOutstanding,
  isBilledInvoice,
} from "@/features/finance/finance";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Who owes us the most, and how much of it is already late. */
export function TopDebtorsPanel() {
  const invoicesQ = useInvoices();
  const paymentsQ = usePayments();
  const clientsQ = useClients();
  const failed = [invoicesQ, paymentsQ].find((q) => q.isError);

  const paid = paymentsByInvoice(paymentsQ.data ?? []);
  const clientName = new Map((clientsQ.data ?? []).map((c) => [c.id, c.name]));
  const now = new Date();

  const owing = new Map<
    string,
    { currency: string; outstanding: number; overdue: number; count: number; oldestDays: number }
  >();
  for (const inv of (invoicesQ.data ?? []).filter(isBilledInvoice)) {
    const left = invoiceOutstanding(inv, paid.get(inv.id) ?? 0);
    if (left <= 0.01) continue;
    const late = daysBetween(now, new Date(inv.due_date));
    const row = owing.get(inv.client_id) ?? {
      currency: inv.currency_code,
      outstanding: 0,
      overdue: 0,
      count: 0,
      oldestDays: 0,
    };
    row.outstanding += left;
    row.count += 1;
    if (late > 0) {
      row.overdue += left;
      row.oldestDays = Math.max(row.oldestDays, late);
    }
    owing.set(inv.client_id, row);
  }
  const top = Array.from(owing.entries())
    .sort((a, b) => b[1].outstanding - a[1].outstanding)
    .slice(0, 5);

  return (
    <section className="rounded-xl border bg-card" aria-labelledby="debtors-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="debtors-heading" className="text-sm font-semibold">
          Who owes us the most
        </h2>
        <Link to="/finance/debtors" className="text-xs font-medium text-primary hover:underline">
          Chase unpaid invoices
        </Link>
      </div>

      {failed ? (
        <div className="p-4">
          <LoadError
            what="unpaid invoices"
            error={failed.error}
            onRetry={() => {
              void invoicesQ.refetch();
              void paymentsQ.refetch();
            }}
          />
        </div>
      ) : invoicesQ.isLoading || paymentsQ.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : top.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-sm font-medium">Nobody owes us anything</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Every invoice that has been sent has been paid in full.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link to="/finance/invoices" search={{ new: 1 }}>
              New invoice
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y">
          {top.map(([clientId, row]) => (
            <li key={clientId}>
              <Link
                to="/clients"
                search={{ q: clientName.get(clientId) ?? "" }}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-secondary/40"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {clientName.get(clientId) ?? "Client"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {row.count} unpaid invoice{row.count === 1 ? "" : "s"}
                    {row.oldestDays > 0 ? ` · oldest ${row.oldestDays} days late` : " · none late"}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-semibold tabular-nums">
                    {formatCurrency(row.outstanding, row.currency)}
                  </span>
                  <span
                    className={cn(
                      "block text-xs tabular-nums",
                      row.overdue > 0 ? "font-medium text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {row.overdue > 0
                      ? `${formatCurrency(row.overdue, row.currency)} late`
                      : "Not due yet"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
