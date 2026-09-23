import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { getRenewalInfo, useContracts } from "@/features/clients/use-clients-contracts";
import { useClients } from "@/features/finance/use-finance-data";
import { formatCurrency } from "@/features/finance/finance";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";

const inDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Contracts that run out soon — renew them or the money stops. */
export function ContractRenewalsPanel() {
  const contractsQ = useContracts();
  const clientsQ = useClients();
  const clientName = new Map((clientsQ.data ?? []).map((c) => [c.id, c.name]));
  const horizon = inDays(90);

  const ending = (contractsQ.data ?? [])
    .filter((c) => c.status === "active" && c.end_date && c.end_date <= horizon)
    .sort((a, b) => (a.end_date ?? "").localeCompare(b.end_date ?? ""));
  const valueAtRisk = ending.reduce((sum, c) => sum + Number(c.value ?? 0), 0);

  return (
    <section className="rounded-xl border bg-card" aria-labelledby="renewals-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="renewals-heading" className="text-sm font-semibold">
          Contracts ending within 90 days
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
      ) : ending.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-sm font-medium">Nothing ends in the next 90 days</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Contracts with an end date appear here in good time, so renewals are never a surprise.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link to="/clients/contracts">Open contracts</Link>
          </Button>
        </div>
      ) : (
        <div className="p-4">
          <p className="mb-2 text-xs text-muted-foreground">
            {ending.length} contract{ending.length === 1 ? "" : "s"} worth{" "}
            {formatCurrency(valueAtRisk, ending[0].currency)} need a decision.
          </p>
          <ul className="divide-y">
            {ending.slice(0, 5).map((c) => {
              const renewal = getRenewalInfo(c.end_date);
              return (
                <li key={c.id}>
                  <Link
                    to="/clients/contracts/$id"
                    params={{ id: c.id }}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-secondary/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {clientName.get(c.client_id) ?? "Client"} · ends {formatDate(c.end_date)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-semibold tabular-nums">
                        {formatCurrency(c.value, c.currency)}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                          renewal.className,
                        )}
                      >
                        {renewal.label}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {ending.length > 5 && (
            <Link
              to="/clients/contracts"
              className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
            >
              +{ending.length - 5} more ending soon
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
