import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { PaginationBar } from "@/components/pagination-bar";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { usePagination } from "@/hooks/use-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatDate, formatMonth } from "@/lib/format-date";
import { useCanManageWater } from "@/features/water/use-water";
import { useWaterExpenses, useWaterExpenseSummary } from "@/features/water/use-water-expenses";
import { ExpenseFormDialog } from "@/features/water/expense-form-dialog";
import { WaterExpenseSummary } from "@/features/water/water-expense-summary";
import {
  WATER_EXPENSE_CATEGORY_LABELS,
  formatWaterMoney,
  waterToday,
  type WaterExpenseRow,
} from "@/features/water/water-expense-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/water/expenses")({
  head: () => ({ meta: [{ title: "Water expenses | AIMS" }] }),
  component: WaterExpensesPage,
});

function WaterExpensesPage() {
  const { viewAs } = useAuth();
  const canManage = useCanManageWater() && !viewAs;
  const [month, setMonth] = useState(() => waterToday().slice(0, 7));
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const query = useDebouncedValue(q);
  const [editing, setEditing] = useState<WaterExpenseRow | "new" | null>(null);
  const [paymentOnly, setPaymentOnly] = useState(false);
  const pagination = usePagination();
  const expensesQ = useWaterExpenses(
    { month, status: status === "all" ? undefined : status, q: query || undefined },
    { page: pagination.page, pageSize: pagination.pageSize },
  );
  const summaryQ = useWaterExpenseSummary(month);
  const open = (value: WaterExpenseRow | "new", payment = false) => {
    setPaymentOnly(payment);
    setEditing(value);
  };
  return (
    <div className="space-y-4">
      <PageHeader
        title="Expenses"
        description="Electricity for pumping, maintenance and other Water operating costs."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => open("new")}>
              Add expense
            </Button>
          ) : undefined
        }
      />
      {!canManage && <ViewOnlyBanner area="Water expenses" />}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="expense-month" className="text-xs">
            Month
          </Label>
          <Input
            id="expense-month"
            type="month"
            value={month}
            onChange={(e) => {
              if (e.target.value) {
                setMonth(e.target.value);
                pagination.setPage(1);
              }
            }}
            className="mt-1 h-9 w-40"
          />
        </div>
        <div>
          <Label htmlFor="expense-status" className="text-xs">
            Status
          </Label>
          <Select
            value={status}
            onValueChange={(next) => {
              setStatus(next);
              pagination.setPage(1);
            }}
          >
            <SelectTrigger id="expense-status" className="mt-1 h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All expenses</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-auto sm:flex-1 sm:max-w-xs">
          <Label htmlFor="expense-search" className="text-xs">
            Search
          </Label>
          <Input
            id="expense-search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              pagination.setPage(1);
            }}
            placeholder="Description, supplier or reference"
            className="mt-1 h-9"
          />
        </div>
      </div>
      {summaryQ.isError ? (
        <LoadError
          what="expense totals"
          error={summaryQ.error}
          onRetry={() => summaryQ.refetch()}
        />
      ) : summaryQ.data ? (
        <WaterExpenseSummary
          expenses={summaryQ.data.expenses}
          collections={summaryQ.data.collections}
          categories
          link={false}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Loading totals...</p>
      )}
      <section
        className="rounded-lg border bg-card overflow-hidden"
        aria-label="Expenses for the selected month"
      >
        <div className="px-4 py-3 border-b">
          <h2 className="text-sm font-semibold">Recorded in {formatMonth(month)}</h2>
        </div>
        {expensesQ.isError ? (
          <div className="p-4">
            <LoadError
              what="expenses"
              error={expensesQ.error}
              onRetry={() => expensesQ.refetch()}
            />
          </div>
        ) : expensesQ.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading expenses...</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(expensesQ.data?.data ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(row.expenseDate)}
                    </TableCell>
                    <TableCell className="min-w-48">
                      <p>{row.description}</p>
                      {(row.supplier || row.reference) && (
                        <p className="text-xs text-muted-foreground">
                          {[row.supplier, row.reference].filter(Boolean).join(" / ")}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{WATER_EXPENSE_CATEGORY_LABELS[row.waterCategory]}</TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      {formatWaterMoney(row.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.status === "paid" ? "secondary" : "outline"}>
                        {row.status === "paid" ? "Paid" : "Unpaid"}
                      </Badge>
                      {row.paidOn && (
                        <p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(row.paidOn)}
                        </p>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => open(row)}>
                            Edit
                          </Button>
                          {row.status === "unpaid" && (
                            <Button variant="outline" size="sm" onClick={() => open(row, true)}>
                              Mark paid
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {!expensesQ.data?.data.length && (
                  <TableRow>
                    <TableCell
                      colSpan={canManage ? 6 : 5}
                      className="py-10 text-center text-muted-foreground"
                    >
                      {q || status !== "all"
                        ? "No expenses match these filters."
                        : "No expenses recorded this month. Add your first cost to include it in reports."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
        {expensesQ.data && (
          <PaginationBar
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={expensesQ.data.total}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        )}
      </section>
      <ExpenseFormDialog
        value={editing}
        paymentOnly={paymentOnly}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
