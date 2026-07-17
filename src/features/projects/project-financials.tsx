import { Loader2 } from "lucide-react";
import { useProjectFinancials } from "@/features/projects/use-projects";
import { formatCurrency } from "@/features/finance/finance";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[0.6875rem] text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-0.5">{value}</div>
    </div>
  );
}

export function ProjectFinancialsTab({ projectId }: { projectId: string }) {
  const financialsQ = useProjectFinancials(projectId);

  if (financialsQ.isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const data = financialsQ.data;
  if (!data || !data.hasContract) {
    return (
      <div className="rounded-lg border bg-card py-10 text-center text-sm text-muted-foreground">
        This project isn't linked to a contract yet — link one from the project's edit screen to see
        budget vs. actual, invoices, and margin here.
      </div>
    );
  }

  const { totals, budgets, invoices } = data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Budgeted" value={formatCurrency(totals.totalBudgeted)} />
        <SummaryCard label="Invoiced" value={formatCurrency(totals.totalInvoiced)} />
        <SummaryCard label="Direct cost" value={formatCurrency(totals.totalDirectCost)} />
        <SummaryCard label="Outstanding" value={formatCurrency(totals.totalOutstanding)} />
        <SummaryCard label="Margin" value={formatCurrency(totals.margin)} />
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Budget periods</h3>
        {budgets.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No budgets recorded yet for this project's contract.
          </p>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Budgeted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="text-xs">
                      {b.periodStart.slice(0, 10)} → {b.periodEnd.slice(0, 10)}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {formatCurrency(b.budgetedAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Invoices</h3>
        {invoices.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No invoices raised against this contract yet.
          </p>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-xs font-medium">{inv.invoiceNumber}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[0.625rem]">
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {formatCurrency(inv.total)}
                    </TableCell>
                    <TableCell className="text-right text-xs">{formatCurrency(inv.paid)}</TableCell>
                    <TableCell className="text-right text-xs">
                      {formatCurrency(inv.outstanding)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
