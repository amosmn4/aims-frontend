import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import {
  ledgerDate,
  ledgerMoney,
  useLedgerAccess,
  useLedgerData,
  useLedgerMutation,
  type LedgerRow,
} from "./use-payment-ledger";

type Summary = {
  count: number;
  unallocated: number;
  requiresReview: number;
  failedProcessing: number;
  totals: {
    currency: string;
    direction: string;
    _sum: { amount: string | null };
  }[];
  systems: {
    systemName: string;
    currency: string;
    direction: string;
    paymentStatus: string;
    _count: number;
    _sum: { amount: string | null };
  }[];
  systemNames: string[];
};
const selectClass = "h-9 rounded-md border bg-background px-2 text-sm";

export function PaymentLedgerPage() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const access = useLedgerAccess();
  const sync = useLedgerMutation();
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  const rows = useLedgerData<{
    data: LedgerRow[];
    total: number;
    pageSize: number;
  }>(`entries?${query}&page=${page}&pageSize=25`, access.data?.read);
  const summary = useLedgerData<Summary>(`entries/summary?${query}`, access.data?.read);
  const status = useLedgerData<{
    configured: boolean;
    lastSuccessAt: string | null;
    lastError: string | null;
  }>("sync", access.data?.read);
  const change = (key: string, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const select = (key: string, label: string, choices: string[]) => (
    <label className="grid gap-1 text-xs">
      {label}
      <select
        aria-label={label}
        className={selectClass}
        value={filters[key] ?? ""}
        onChange={(event) => change(key, event.target.value)}
      >
        <option value="">All</option>
        {choices.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </label>
  );
  const download = async () => {
    setExporting(true);
    try {
      const response = await apiFetch(`/payment-ledger/entries/export?${query}`);
      if (!response.ok) throw new Error("The ledger export failed. Check the filters and retry.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "aims-payment-ledger.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payment Ledger"
        description="All shared paybill payments, their destination systems, and transaction history."
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={exporting || rows.isError} onClick={download}>
          {exporting ? "Exporting..." : "Export CSV"}
        </Button>
        {access.data?.write && (
          <Button
            variant="outline"
            disabled={sync.isPending || !status.data?.configured}
            onClick={() =>
              sync.mutate(
                { path: "sync" },
                {
                  onSuccess: () => toast.success("Ledger synchronization completed"),
                  onError: (error) => toast.error(error.message),
                },
              )
            }
          >
            Sync now
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          Last synchronized: {ledgerDate(status.data?.lastSuccessAt)}
        </span>
      </div>
      {status.data && !status.data.configured && (
        <p className="rounded-md border p-3 text-sm">
          The payment gateway connection has not been configured.
        </p>
      )}
      {status.data?.lastError && (
        <p role="alert" className="text-sm text-destructive">
          {status.data.lastError}
        </p>
      )}
      {status.isError && (
        <LoadError
          what="synchronization status"
          error={status.error}
          onRetry={() => status.refetch()}
        />
      )}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Transactions", summary.data?.count],
          ["Unallocated", summary.data?.unallocated],
          ["Needs review", summary.data?.requiresReview],
          ["Processing failed", summary.data?.failedProcessing],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold">{value ?? "..."}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        {summary.data?.totals.map((total) => (
          <p key={`${total.currency}-${total.direction}`} className="text-sm font-medium">
            {total.direction === "in" ? "Received" : "Paid out"}:{" "}
            {ledgerMoney(total._sum.amount, total.currency)}
          </p>
        ))}
      </div>
      <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3 lg:grid-cols-5">
        <label className="grid gap-1 text-xs">
          Search
          <Input
            placeholder="Receipt, account, payer"
            value={filters.q ?? ""}
            onChange={(event) => change("q", event.target.value)}
          />
        </label>
        {select("system", "System", summary.data?.systemNames ?? [])}
        {select("destination", "Destination", ["water", "external", "unallocated"])}
        {select("channel", "Channel", ["c2b", "stk", "b2c", "manual"])}
        {select("direction", "Direction", ["in", "out"])}
        {select("paymentStatus", "Payment status", ["succeeded", "pending", "failed", "refunded"])}
        {select("status", "Processing status", ["unallocated", "pending", "succeeded", "failed"])}
        <label className="grid gap-1 text-xs">
          Paybill
          <Input
            value={filters.paybill ?? ""}
            onChange={(event) => change("paybill", event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-xs">
          From
          <Input
            type="date"
            value={filters.from ?? ""}
            onChange={(event) => change("from", event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-xs">
          To
          <Input
            type="date"
            value={filters.to ?? ""}
            onChange={(event) => change("to", event.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.review === "true"}
            onChange={(event) => change("review", event.target.checked ? "true" : "")}
          />
          Needs review only
        </label>
        <Button
          variant="outline"
          onClick={() => {
            setFilters({});
            setPage(1);
          }}
        >
          Reset filters
        </Button>
      </div>
      {summary.isError && (
        <LoadError what="ledger totals" error={summary.error} onRetry={() => summary.refetch()} />
      )}
      {rows.isError ? (
        <LoadError what="payment ledger" error={rows.error} onRetry={() => rows.refetch()} />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                {[
                  "Receipt",
                  "Date",
                  "Account",
                  "System",
                  "Amount",
                  "Channel",
                  "Payment",
                  "Processing",
                ].map((label) => (
                  <th key={label} className="p-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.data?.data.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-3">
                    <Link
                      to="/payment-ledger/entries/$entryId"
                      params={{ entryId: row.id }}
                      className="text-primary underline"
                    >
                      {row.receipt}
                    </Link>
                    {row.requiresReview && <p className="text-xs text-destructive">Needs review</p>}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {ledgerDate(row.transactionAt ?? row.receivedAt)}
                  </td>
                  <td className="p-3">
                    {row.reference}
                    <p className="text-xs text-muted-foreground">{row.paybill}</p>
                  </td>
                  <td className="p-3">{row.systemName}</td>
                  <td className="p-3 whitespace-nowrap">
                    {ledgerMoney(row.amount, row.currency)}
                    <p className="text-xs text-muted-foreground">
                      {row.direction === "in" ? "Incoming" : "Outgoing"}
                    </p>
                  </td>
                  <td className="p-3 uppercase">{row.channel}</td>
                  <td className="p-3">{row.paymentStatus}</td>
                  <td className="p-3">{row.processingStatus}</td>
                </tr>
              ))}
              {!rows.data?.data.length && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    {rows.isPending ? "Loading payments..." : "No payments match these filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between text-sm">
        <span>
          {rows.data?.total ?? 0} transactions. Page {page} of{" "}
          {Math.max(1, Math.ceil((rows.data?.total ?? 0) / 25))}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={page === 1 || rows.isFetching}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={page * 25 >= (rows.data?.total ?? 0) || rows.isFetching}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
      {!!summary.data?.systems.length && (
        <section className="overflow-x-auto rounded-lg border">
          <h2 className="p-3 font-semibold">Totals by system</h2>
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                {["System", "Direction", "Payment status", "Count", "Amount"].map((label) => (
                  <th className="p-3" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.data.systems.map((system, index) => (
                <tr key={index} className="border-t">
                  <td className="p-3">{system.systemName}</td>
                  <td className="p-3">{system.direction === "in" ? "Incoming" : "Outgoing"}</td>
                  <td className="p-3">{system.paymentStatus}</td>
                  <td className="p-3">{system._count}</td>
                  <td className="p-3">{ledgerMoney(system._sum.amount, system.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
