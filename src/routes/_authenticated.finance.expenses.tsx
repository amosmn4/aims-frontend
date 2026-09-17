import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { confirmDialog } from "@/components/confirm-dialog";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { RowActions } from "@/components/row-actions";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { formatDate } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useExpenses,
  useSaveExpense,
  usePayExpense,
  useDeleteExpense,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
  type ExpenseRow,
  type ExpenseStatus,
} from "@/features/finance/use-expenses";
import { useServiceLines, type ServiceLine } from "@/features/finance/use-finance-data";
import {
  CURRENCY_CODES,
  useDepartments,
  type DepartmentRow,
} from "@/features/clients/use-clients-contracts";
import {
  MoneyTotal,
  totalsByCurrency,
  useCompanyCurrency,
  useFinanceAccess,
} from "@/features/finance/money";
import { expenseDueDate, formatCurrency } from "@/features/finance/finance";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export const Route = createFileRoute("/_authenticated/finance/expenses")({
  head: () => ({ meta: [{ title: "Expenses — AIMS Finance" }] }),
  component: ExpensesPage,
});

const localIso = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : "Something went wrong. Please try again.";

// Unpaid bills past their due date (or 30 days after the expense date when none is set).
function isOverdue(e: ExpenseRow) {
  return e.status === "unpaid" && expenseDueDate(e).toISOString().slice(0, 10) < localIso();
}

function ExpensesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | ExpenseStatus>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [departmentId, setDepartmentId] = useState("all");
  const [formTarget, setFormTarget] = useState<ExpenseRow | "new" | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  const periodError = from && to && to < from ? "The end date can't be before the start date" : "";
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const allQ = useExpenses();
  const listQ = useExpenses({
    q: debouncedSearch || undefined,
    status: status === "all" ? undefined : status,
    from: from || undefined,
    to: periodError ? undefined : to || undefined,
    departmentId: departmentId === "all" ? undefined : departmentId,
  });
  const departmentsQ = useDepartments();
  const serviceLinesQ = useServiceLines();
  const deleteExpense = useDeleteExpense();
  const { canWrite } = useFinanceAccess();
  const companyCurrency = useCompanyCurrency();

  const departments = departmentsQ.data ?? [];
  const serviceLines = useMemo(() => serviceLinesQ.data ?? [], [serviceLinesQ.data]);
  const rows = listQ.data ?? [];
  const hasFilters = !!(search.trim() || status !== "all" || from || to || departmentId !== "all");
  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setFrom("");
    setTo("");
    setDepartmentId("all");
  };

  const summary = useMemo(() => {
    const all = allQ.data ?? [];
    const monthKey = localIso().slice(0, 7);
    const unpaid = all.filter((e) => e.status === "unpaid");
    const overdue = unpaid.filter(isOverdue);
    const sum = (list: ExpenseRow[]) =>
      totalsByCurrency(
        list,
        (e) => e.currency_code,
        (e) => Number(e.amount),
      );
    return {
      spentThisMonth: sum(all.filter((e) => e.expense_date.slice(0, 7) === monthKey)),
      unpaidTotal: sum(unpaid),
      unpaidCount: unpaid.length,
      overdueTotal: sum(overdue),
      overdueCount: overdue.length,
    };
  }, [allQ.data]);

  const payingExpense = rows.find((e) => e.id === payingId) ?? null;

  const handleDelete = async (e: ExpenseRow) => {
    const ok = await confirmDialog({
      title: "Delete this expense?",
      description: `"${e.description}" (${formatCurrency(e.amount, e.currency_code)}) will be removed for good.`,
      confirmLabel: "Delete expense",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteExpense.mutateAsync(e.id);
      toast.success("Expense deleted");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Record bills and other costs, and mark them paid when the money goes out."
        actions={
          canWrite ? (
            <Button onClick={() => setFormTarget("new")}>
              <Plus className="h-4 w-4 mr-1" /> New expense
            </Button>
          ) : undefined
        }
      />
      {!canWrite && <ViewOnlyBanner area="expenses" action="add, edit or pay expenses" />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Spent this month"
          value={<MoneyTotal totals={summary.spentThisMonth} companyCurrency={companyCurrency} />}
        />
        <SummaryCard
          label="Unpaid bills"
          value={<MoneyTotal totals={summary.unpaidTotal} companyCurrency={companyCurrency} />}
          hint={`${summary.unpaidCount} bill${summary.unpaidCount === 1 ? "" : "s"} to pay`}
          tone="warning"
        />
        <SummaryCard
          label="Overdue bills"
          value={<MoneyTotal totals={summary.overdueTotal} companyCurrency={companyCurrency} />}
          hint={`${summary.overdueCount} past the due date`}
          tone={summary.overdueCount > 0 ? "danger" : "default"}
        />
      </div>

      <div className="rounded-lg border bg-card p-3 flex flex-wrap items-start gap-3">
        <div className="w-full sm:w-64">
          <Label htmlFor="expense-search" className="text-xs">
            Search
          </Label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="expense-search"
              className="pl-8"
              placeholder="Description, supplier or reference"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="w-full sm:w-36">
          <Label htmlFor="expense-status" className="text-xs">
            Status
          </Label>
          <Select value={status} onValueChange={(v) => setStatus(v as "all" | ExpenseStatus)}>
            <SelectTrigger id="expense-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-40">
          <Label htmlFor="expense-from" className="text-xs">
            From
          </Label>
          <Input
            id="expense-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-40">
          <Label htmlFor="expense-to" className="text-xs">
            To
          </Label>
          <Input
            id="expense-to"
            type="date"
            value={to}
            min={from || undefined}
            aria-invalid={!!periodError}
            onChange={(e) => setTo(e.target.value)}
          />
          {periodError && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {periodError}
            </p>
          )}
        </div>
        <div className="w-full sm:w-48">
          <Label htmlFor="expense-department" className="text-xs">
            Department
          </Label>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger id="expense-department">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        {listQ.isLoading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading expenses" />
          </div>
        ) : listQ.isError ? (
          <LoadError
            what="expenses"
            error={listQ.error}
            onRetry={() => listQ.refetch()}
            className="m-3"
          />
        ) : rows.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3 text-sm text-muted-foreground">
            {hasFilters ? (
              <>
                <span>No matches</span>
                <Button size="sm" variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <span>No expenses yet</span>
                {canWrite && (
                  <Button size="sm" onClick={() => setFormTarget("new")}>
                    <Plus className="h-4 w-4 mr-1" /> New expense
                  </Button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Department / service line</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  {canWrite && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => {
                  const overdue = isOverdue(e);
                  const label = `expense "${e.description}"`;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDate(e.expense_date)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{e.description}</div>
                        {e.supplier && (
                          <div className="text-xs text-muted-foreground">{e.supplier}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{e.department_name ?? "—"}</div>
                        {e.service_line_name && (
                          <div className="text-muted-foreground">{e.service_line_name}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium whitespace-nowrap">
                        {formatCurrency(e.amount, e.currency_code)}
                      </TableCell>
                      <TableCell>
                        <StatusPill expense={e} overdue={overdue} />
                      </TableCell>
                      {canWrite && (
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <RowActions label={label} onEdit={() => setFormTarget(e)} />
                            {e.status === "unpaid" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setPayingId(e.id)}
                                title={`Mark ${label} as paid`}
                                aria-label={`Mark ${label} as paid`}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <RowActions
                              label={label}
                              onDelete={() => handleDelete(e)}
                              disabled={deleteExpense.isPending}
                            />
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {formTarget && (
        <ExpenseFormDialog
          key={formTarget === "new" ? "new" : formTarget.id}
          expense={formTarget === "new" ? null : formTarget}
          departments={departments}
          serviceLines={serviceLines}
          onClose={() => setFormTarget(null)}
        />
      )}

      {payingExpense && (
        <MarkPaidDialog
          key={payingExpense.id}
          expense={payingExpense}
          onClose={() => setPayingId(null)}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "warning" | "danger";
}) {
  const toneCls =
    tone === "warning"
      ? "text-warning"
      : tone === "danger"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="text-xs text-muted-foreground font-semibold">{label}</div>
      <div className={`mt-2 text-xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function StatusPill({ expense, overdue }: { expense: ExpenseRow; overdue: boolean }) {
  const pill = "px-2 py-0.5 rounded-full text-xs font-semibold";
  if (expense.status === "paid") {
    return (
      <div>
        <span className={`${pill} bg-success/15 text-success`}>Paid</span>
        <div className="mt-1 text-xs text-muted-foreground whitespace-nowrap">
          {expense.paid_on ? `Paid on ${formatDate(expense.paid_on)}` : "Paid"}
          {expense.reference ? ` · Ref ${expense.reference}` : ""}
        </div>
      </div>
    );
  }
  return (
    <div>
      <span
        className={`${pill} ${overdue ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}
      >
        {overdue ? "Overdue" : "Unpaid"}
      </span>
      <div className="mt-1 text-xs text-muted-foreground whitespace-nowrap">
        {expense.due_date ? `Due ${formatDate(expense.due_date)}` : "No due date set"}
      </div>
    </div>
  );
}

/* ---------- New / edit expense ---------- */

type ExpenseDraft = {
  description: string;
  supplier: string;
  category: ExpenseCategory | "";
  amount: string;
  currencyCode: string;
  expenseDate: string;
  dueDate: string;
  departmentId: string;
  serviceLineId: string;
  alreadyPaid: boolean;
  paidOn: string;
  reference: string;
};

type ExpenseErrors = Partial<Record<keyof ExpenseDraft | "form", string>>;

function draftFromExpense(e: ExpenseRow | null): ExpenseDraft {
  return {
    description: e?.description ?? "",
    supplier: e?.supplier ?? "",
    category: e?.category ?? "",
    amount: e ? String(e.amount) : "",
    currencyCode: e?.currency_code ?? "",
    expenseDate: e?.expense_date ?? localIso(),
    dueDate: e?.due_date ?? "",
    departmentId: e?.department_id ?? "",
    serviceLineId: e?.service_line_id ?? "",
    alreadyPaid: e?.status === "paid",
    paidOn: e?.paid_on ?? localIso(),
    reference: e?.reference ?? "",
  };
}

// Maps known backend messages to the field they belong to.
function fieldForServerError(message: string): keyof ExpenseErrors {
  const m = message.toLowerCase();
  if (m.includes("due date")) return "dueDate";
  if (m.includes("service line")) return "serviceLineId";
  if (m.includes("category")) return "category";
  if (m.includes("amount")) return "amount";
  if (m.includes("describe")) return "description";
  return "form";
}

function ExpenseFormDialog({
  expense,
  departments,
  serviceLines,
  onClose,
}: {
  expense: ExpenseRow | null;
  departments: DepartmentRow[];
  serviceLines: ServiceLine[];
  onClose: () => void;
}) {
  const [initial] = useState<ExpenseDraft>(() => draftFromExpense(expense));
  const [draft, setDraft] = useState<ExpenseDraft>(initial);
  const [errors, setErrors] = useState<ExpenseErrors>({});
  const save = useSaveExpense();
  const { guardClose } = useUnsavedChanges(JSON.stringify(draft) !== JSON.stringify(initial));
  const companyCurrency = useCompanyCurrency();
  const currency = draft.currencyCode || companyCurrency;
  const currencyOptions = CURRENCY_CODES.includes(currency as (typeof CURRENCY_CODES)[number])
    ? [...CURRENCY_CODES]
    : [currency, ...CURRENCY_CODES];

  const lineOptions = serviceLines.filter(
    (s) =>
      (s.is_active || s.id === draft.serviceLineId) &&
      (!draft.departmentId || s.department_id === draft.departmentId),
  );

  const update = (patch: Partial<ExpenseDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => {
      const next = { ...e, form: undefined };
      for (const k of Object.keys(patch)) delete next[k as keyof ExpenseDraft];
      return next;
    });
  };

  const chooseDepartment = (departmentId: string) => {
    const sl = serviceLines.find((s) => s.id === draft.serviceLineId);
    update({
      departmentId,
      ...(sl && departmentId && sl.department_id !== departmentId ? { serviceLineId: "" } : {}),
    });
  };

  const chooseServiceLine = (serviceLineId: string) => {
    const sl = serviceLines.find((s) => s.id === serviceLineId);
    update({ serviceLineId, ...(sl ? { departmentId: sl.department_id } : {}) });
  };

  const validate = (): ExpenseErrors => {
    const e: ExpenseErrors = {};
    if (draft.description.trim().length < 2) e.description = "Describe the expense in a few words";
    if (!draft.category) e.category = "Choose a category";
    const amount = Number(draft.amount);
    if (!draft.amount.trim() || !Number.isFinite(amount) || amount <= 0)
      e.amount = "Enter an amount greater than zero";
    if (!draft.expenseDate) e.expenseDate = "Choose the date of the expense";
    if (draft.dueDate && draft.expenseDate && draft.dueDate < draft.expenseDate)
      e.dueDate = "The due date can't be before the expense date";
    if (draft.alreadyPaid && !draft.paidOn) e.paidOn = "Choose the date it was paid";
    return e;
  };

  const handleSave = async () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || !draft.category) return;
    const editing = !!expense;
    try {
      await save.mutateAsync({
        id: expense?.id,
        description: draft.description.trim(),
        supplier: editing ? draft.supplier.trim() : draft.supplier.trim() || undefined,
        category: draft.category,
        amount: Number(draft.amount),
        currencyCode: currency,
        expenseDate: draft.expenseDate,
        dueDate: draft.dueDate || (editing ? null : undefined),
        departmentId: draft.departmentId || (editing ? null : undefined),
        serviceLineId: draft.serviceLineId || (editing ? null : undefined),
        paidOn: draft.alreadyPaid ? draft.paidOn : editing ? null : undefined,
        reference: editing ? draft.reference.trim() : draft.reference.trim() || undefined,
      });
      toast.success(editing ? "Expense updated" : "Expense added");
      onClose();
    } catch (err) {
      const message = errorMessage(err);
      setErrors({ [fieldForServerError(message)]: message });
      toast.error(message);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onClose)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit expense" : "New expense"}</DialogTitle>
          <DialogDescription>Record a bill or other cost.</DialogDescription>
        </DialogHeader>
        <RequiredNote />
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          <FormField id="exp-description" label="Description" required error={errors.description}>
            <Input
              id="exp-description"
              value={draft.description}
              aria-invalid={!!errors.description}
              placeholder="e.g. Office rent for September"
              onChange={(e) => update({ description: e.target.value })}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField id="exp-supplier" label="Supplier" error={errors.supplier}>
              <Input
                id="exp-supplier"
                value={draft.supplier}
                placeholder="Who you are paying"
                onChange={(e) => update({ supplier: e.target.value })}
              />
            </FormField>
            <FormField id="exp-category" label="Category" required error={errors.category}>
              <Select
                value={draft.category}
                onValueChange={(v) => update({ category: v as ExpenseCategory })}
              >
                <SelectTrigger id="exp-category" aria-invalid={!!errors.category}>
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {EXPENSE_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField
              id="exp-amount"
              label={`Amount (${currency})`}
              required
              error={errors.amount}
              className="sm:col-span-2"
            >
              <Input
                id="exp-amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={draft.amount}
                aria-invalid={!!errors.amount}
                onChange={(e) => update({ amount: e.target.value })}
              />
            </FormField>
            <FormField id="exp-currency" label="Currency">
              <Select value={currency} onValueChange={(v) => update({ currencyCode: v })}>
                <SelectTrigger id="exp-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField id="exp-date" label="Expense date" required error={errors.expenseDate}>
              <Input
                id="exp-date"
                type="date"
                value={draft.expenseDate}
                aria-invalid={!!errors.expenseDate}
                onChange={(e) => update({ expenseDate: e.target.value })}
              />
            </FormField>
            <FormField
              id="exp-due-date"
              label="Due date"
              error={errors.dueDate}
              hint="Leave empty if there's no due date"
            >
              <Input
                id="exp-due-date"
                type="date"
                value={draft.dueDate}
                min={draft.expenseDate || undefined}
                aria-invalid={!!errors.dueDate}
                onChange={(e) => update({ dueDate: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField id="exp-department" label="Department">
              <Select
                value={draft.departmentId || "none"}
                onValueChange={(v) => chooseDepartment(v === "none" ? "" : v)}
              >
                <SelectTrigger id="exp-department">
                  <SelectValue placeholder="Whole company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Whole company</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              id="exp-service-line"
              label="Service line"
              error={errors.serviceLineId}
              hint="Link it to a service line to count it in that line's margin"
            >
              <Select
                value={draft.serviceLineId || "none"}
                onValueChange={(v) => chooseServiceLine(v === "none" ? "" : v)}
              >
                <SelectTrigger id="exp-service-line">
                  <SelectValue placeholder="No service line" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No service line</SelectItem>
                  {lineOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="rounded-md border p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Switch
                id="exp-already-paid"
                checked={draft.alreadyPaid}
                onCheckedChange={(v) => update({ alreadyPaid: v })}
              />
              <Label htmlFor="exp-already-paid">This bill is already paid</Label>
            </div>
            {draft.alreadyPaid && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField id="exp-paid-on" label="Paid on" required error={errors.paidOn}>
                  <Input
                    id="exp-paid-on"
                    type="date"
                    value={draft.paidOn}
                    aria-invalid={!!errors.paidOn}
                    onChange={(e) => update({ paidOn: e.target.value })}
                  />
                </FormField>
                <FormField id="exp-reference" label="Reference">
                  <Input
                    id="exp-reference"
                    value={draft.reference}
                    placeholder="e.g. M-Pesa code or bank reference"
                    onChange={(e) => update({ reference: e.target.value })}
                  />
                </FormField>
              </div>
            )}
          </div>

          {errors.form && (
            <p role="alert" className="text-sm text-destructive">
              {errors.form}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => guardClose(onClose)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {expense ? "Save expense" : "Add expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Mark as paid ---------- */

function MarkPaidDialog({ expense, onClose }: { expense: ExpenseRow; onClose: () => void }) {
  const [paidOn, setPaidOn] = useState(localIso());
  const [reference, setReference] = useState(expense.reference ?? "");
  const [errors, setErrors] = useState<{ paidOn?: string; form?: string }>({});
  const pay = usePayExpense();
  const { guardClose } = useUnsavedChanges(
    paidOn !== localIso() || reference !== (expense.reference ?? ""),
  );

  const handlePay = async () => {
    if (!paidOn) {
      setErrors({ paidOn: "Choose the date it was paid" });
      return;
    }
    try {
      await pay.mutateAsync({ id: expense.id, paidOn, reference: reference.trim() || undefined });
      toast.success("Marked as paid");
      onClose();
    } catch (err) {
      const message = errorMessage(err);
      setErrors({ form: message });
      toast.error(message);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onClose)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark expense as paid</DialogTitle>
          <DialogDescription>
            {expense.description} · {formatCurrency(expense.amount, expense.currency_code)}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handlePay();
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField id="paid-on" label="Paid on" required error={errors.paidOn}>
              <Input
                id="paid-on"
                type="date"
                value={paidOn}
                aria-invalid={!!errors.paidOn}
                onChange={(e) => {
                  setPaidOn(e.target.value);
                  setErrors({});
                }}
              />
            </FormField>
            <FormField id="paid-reference" label="Reference">
              <Input
                id="paid-reference"
                value={reference}
                placeholder="e.g. M-Pesa code or bank reference"
                onChange={(e) => setReference(e.target.value)}
              />
            </FormField>
          </div>
          {errors.form && (
            <p role="alert" className="text-sm text-destructive">
              {errors.form}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => guardClose(onClose)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pay.isPending}>
              {pay.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Mark expense as paid
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
