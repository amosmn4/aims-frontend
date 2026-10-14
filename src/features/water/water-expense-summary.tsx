import { Link } from "@tanstack/react-router";
import {
  WATER_EXPENSE_CATEGORY_LABELS,
  formatWaterMoney,
  type WaterExpenseTotals,
} from "./water-expense-types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function WaterExpenseSummary({
  expenses,
  collections,
  categories = false,
  link = true,
  figures = true,
}: {
  expenses: WaterExpenseTotals;
  collections: number;
  categories?: boolean;
  link?: boolean;
  figures?: boolean;
}) {
  const rows = expenses.categories.filter((row) => row.count > 0 || row.paid > 0);
  return (
    <section className="rounded-lg border bg-card p-4 space-y-3" aria-label="Water finances">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Water finances</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Collections this month: {formatWaterMoney(collections)}
          </p>
        </div>
        {link && (
          <Link to="/water/expenses" className="text-sm text-primary hover:underline">
            Open expenses
          </Link>
        )}
      </div>
      {figures && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Expenses recorded", value: expenses.recorded },
            { label: "Paid this month", value: expenses.paid },
            { label: "Unpaid bills for this month", value: expenses.unpaid },
            {
              label: "Collections less paid expenses",
              value: Math.round((collections - expenses.paid) * 100) / 100,
            },
          ].map((row) => (
            <div key={row.label} className="min-w-0 rounded-md bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">{row.label}</p>
              <p className="mt-1 text-lg font-semibold break-words">
                {formatWaterMoney(row.value)}
              </p>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Costs follow the expense date. Paid totals follow the payment date, including older bills.
        Cash shown is before other costs and opening balances.
      </p>
      {categories && rows.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Recorded</TableHead>
                <TableHead className="text-right">Paid this month</TableHead>
                <TableHead className="text-right">Unpaid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.category}>
                  <TableCell>{WATER_EXPENSE_CATEGORY_LABELS[row.category]}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatWaterMoney(row.recorded)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatWaterMoney(row.paid)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatWaterMoney(row.unpaid)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {expenses.count === 0 && expenses.paid === 0 && (
        <p className="text-xs text-muted-foreground">No expenses recorded for this month yet.</p>
      )}
    </section>
  );
}
