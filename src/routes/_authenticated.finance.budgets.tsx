import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { confirmDialog } from "@/components/confirm-dialog";
import { FormField, RequiredNote } from "@/components/form-field";
import { ActionHint } from "@/components/help-link";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { formatDate } from "@/lib/format-date";
import {
  useBudgets,
  useCreateBudget,
  useDeleteBudget,
  type Budget,
} from "@/features/finance/use-budgets";
import {
  CURRENCY_CODES,
  useContracts,
  useDepartments,
  type ContractRow,
  type DepartmentRow,
} from "@/features/clients/use-clients-contracts";
import { useInvoices } from "@/features/finance/use-finance-data";
import { formatCurrency, isBilledInvoice, type InvoiceRow } from "@/features/finance/finance";
import { formatTotals, useCompanyCurrency, useFinanceAccess } from "@/features/finance/money";

export const Route = createFileRoute("/_authenticated/finance/budgets")({
  head: () => ({ meta: [{ title: "Budgets — AIMS Finance" }] }),
  component: BudgetsPage,
});

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : "Something went wrong. Please try again.";

// Invoiced amounts for a budget, split into its own currency and the rest.
function invoicedFor(b: Budget, invoices: InvoiceRow[], contracts: Map<string, ContractRow>) {
  let same = 0;
  const others = new Map<string, number>();
  for (const inv of invoices) {
    if (!isBilledInvoice(inv) || !inv.contract_id) continue;
    if (inv.issue_date < b.period_start || inv.issue_date > b.period_end) continue;
    if (
      b.contract_id
        ? inv.contract_id !== b.contract_id
        : contracts.get(inv.contract_id)?.department_id !== b.department_id
    )
      continue;
    if (inv.currency_code === b.currency) same += Number(inv.total);
    else others.set(inv.currency_code, (others.get(inv.currency_code) ?? 0) + Number(inv.total));
  }
  return { same, others };
}

function BudgetsPage() {
  const budgetsQ = useBudgets();
  const departmentsQ = useDepartments();
  const contractsQ = useContracts();
  const invoicesQ = useInvoices();
  const deleteBudget = useDeleteBudget();
  const { canWrite } = useFinanceAccess();
  const [creating, setCreating] = useState(false);

  const contractMap = useMemo(
    () => new Map((contractsQ.data ?? []).map((c) => [c.id, c])),
    [contractsQ.data],
  );
  const canSplit = !!invoicesQ.data && !!contractsQ.data;

  const handleDelete = async (b: Budget) => {
    const target = b.department_name ?? b.contract_title ?? "this target";
    const ok = await confirmDialog({
      title: `Delete the budget for ${target}?`,
      description: `The budget for ${formatDate(b.period_start)} – ${formatDate(b.period_end)} is removed. Invoices are not affected.`,
      confirmLabel: "Delete budget",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteBudget.mutateAsync(b.id);
      toast.success("Budget deleted");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const budgets = budgetsQ.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budgets"
        description="Set a billing budget for a department or contract over a period, and compare it with what has been invoiced."
        actions={
          canWrite ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="mr-1 h-4 w-4" /> New budget
            </Button>
          ) : undefined
        }
      />
      {!canWrite && <ViewOnlyBanner area="budgets" action="add or delete budgets" />}
      <ActionHint topic="budgets">
        Only invoices linked to a contract count against a budget.
      </ActionHint>

      <div className="overflow-hidden rounded-lg border bg-card">
        {budgetsQ.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Loading budgets" />
          </div>
        ) : budgetsQ.isError ? (
          <LoadError
            what="budgets"
            error={budgetsQ.error}
            onRetry={() => budgetsQ.refetch()}
            className="m-3"
          />
        ) : budgets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
            <span>No budgets yet</span>
            {canWrite && (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="mr-1 h-4 w-4" /> New budget
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Budget for</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Invoiced</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                  {canWrite && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.map((b) => {
                  const split = canSplit ? invoicedFor(b, invoicesQ.data!, contractMap) : null;
                  const actual = split ? split.same : b.actual;
                  const diff = actual - b.budgeted_amount;
                  const pct = b.budgeted_amount > 0 ? (diff / b.budgeted_amount) * 100 : null;
                  const target = b.department_name ?? b.contract_title ?? "—";
                  return (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div className="font-medium">{target}</div>
                        <Badge variant="secondary" className="mt-0.5">
                          {b.department_id ? "Department" : "Contract"}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatDate(b.period_start)} – {formatDate(b.period_end)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {formatCurrency(b.budgeted_amount, b.currency)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                        {formatCurrency(actual, b.currency)}
                        {split && split.others.size > 0 && (
                          <div className="text-xs font-normal text-muted-foreground">
                            Not counted: {formatTotals(split.others, b.currency)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">
                        {pct === null
                          ? "—"
                          : Math.abs(pct) < 0.05
                            ? "On budget"
                            : `${Math.abs(pct).toFixed(1)}% ${pct > 0 ? "over" : "under"}`}
                      </TableCell>
                      {canWrite && (
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(b)}
                            disabled={deleteBudget.isPending}
                            title={`Delete budget for ${target}`}
                            aria-label={`Delete budget for ${target}, ${formatDate(b.period_start)} to ${formatDate(b.period_end)}`}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="border-t px-4 py-2 text-xs text-muted-foreground">
              Invoiced = sent invoices (including VAT) dated inside the period and linked to the
              contract, or to a contract of the department. Invoices in another currency are shown
              but not counted.
            </p>
          </div>
        )}
      </div>

      {creating && (
        <NewBudgetDialog
          departments={departmentsQ.data ?? []}
          contracts={contractsQ.data ?? []}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}

type BudgetDraft = {
  target: "department" | "contract";
  departmentId: string;
  contractId: string;
  periodStart: string;
  periodEnd: string;
  amount: string;
  currency: string;
  notes: string;
};
type BudgetErrors = Partial<Record<keyof BudgetDraft | "form", string>>;

const localIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function NewBudgetDialog({
  departments,
  contracts,
  onClose,
}: {
  departments: DepartmentRow[];
  contracts: ContractRow[];
  onClose: () => void;
}) {
  const companyCurrency = useCompanyCurrency();
  const [initial] = useState<BudgetDraft>(() => {
    const now = new Date();
    return {
      target: "department",
      departmentId: "",
      contractId: "",
      periodStart: localIso(new Date(now.getFullYear(), now.getMonth(), 1)),
      periodEnd: localIso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      amount: "",
      currency: "",
      notes: "",
    };
  });
  const [draft, setDraft] = useState<BudgetDraft>(initial);
  const [errors, setErrors] = useState<BudgetErrors>({});
  const createBudget = useCreateBudget();
  const { guardClose } = useUnsavedChanges(JSON.stringify(draft) !== JSON.stringify(initial));

  const contract = contracts.find((c) => c.id === draft.contractId);
  const currency = draft.currency || contract?.currency || companyCurrency;
  const currencyOptions = CURRENCY_CODES.includes(currency as (typeof CURRENCY_CODES)[number])
    ? [...CURRENCY_CODES]
    : [currency, ...CURRENCY_CODES];

  const update = (patch: Partial<BudgetDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => {
      const next = { ...e, form: undefined };
      for (const k of Object.keys(patch)) delete next[k as keyof BudgetDraft];
      return next;
    });
  };

  const handleSave = async () => {
    const found: BudgetErrors = {};
    if (draft.target === "department" && !draft.departmentId)
      found.departmentId = "Choose the department";
    if (draft.target === "contract" && !draft.contractId) found.contractId = "Choose the contract";
    if (!draft.periodStart) found.periodStart = "Choose the start date";
    if (!draft.periodEnd) found.periodEnd = "Choose the end date";
    else if (draft.periodStart && draft.periodEnd < draft.periodStart)
      found.periodEnd = "The end date can't be before the start date";
    const amount = Number(draft.amount);
    if (!draft.amount.trim() || !Number.isFinite(amount) || amount < 0)
      found.amount = "Enter the budget amount (0 or more)";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    try {
      await createBudget.mutateAsync({
        departmentId: draft.target === "department" ? draft.departmentId : undefined,
        contractId: draft.target === "contract" ? draft.contractId : undefined,
        periodStart: draft.periodStart,
        periodEnd: draft.periodEnd,
        budgetedAmount: amount,
        currency,
        notes: draft.notes.trim() || undefined,
      });
      toast.success("Budget created");
      onClose();
    } catch (err) {
      const message = errorMessage(err);
      setErrors({ form: message });
      toast.error(message);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onClose)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New budget</DialogTitle>
          <DialogDescription>
            Only invoices linked to a contract count against a budget.
          </DialogDescription>
        </DialogHeader>
        <RequiredNote />
        <form
          className="space-y-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="budget-target" label="Budget for" required>
              <Select
                value={draft.target}
                onValueChange={(v) => update({ target: v as BudgetDraft["target"] })}
              >
                <SelectTrigger id="budget-target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="department">A department</SelectItem>
                  <SelectItem value="contract">A contract</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            {draft.target === "department" ? (
              <FormField
                id="budget-department"
                label="Department"
                required
                error={errors.departmentId}
              >
                <Select
                  value={draft.departmentId}
                  onValueChange={(v) => update({ departmentId: v })}
                >
                  <SelectTrigger id="budget-department" aria-invalid={!!errors.departmentId}>
                    <SelectValue placeholder="Choose a department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            ) : (
              <FormField id="budget-contract" label="Contract" required error={errors.contractId}>
                <Select value={draft.contractId} onValueChange={(v) => update({ contractId: v })}>
                  <SelectTrigger id="budget-contract" aria-invalid={!!errors.contractId}>
                    <SelectValue placeholder="Choose a contract" />
                  </SelectTrigger>
                  <SelectContent>
                    {contracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.contract_number ? `${c.contract_number} — ${c.title}` : c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="budget-start" label="Period start" required error={errors.periodStart}>
              <Input
                id="budget-start"
                type="date"
                value={draft.periodStart}
                aria-invalid={!!errors.periodStart}
                onChange={(e) => update({ periodStart: e.target.value })}
              />
            </FormField>
            <FormField id="budget-end" label="Period end" required error={errors.periodEnd}>
              <Input
                id="budget-end"
                type="date"
                value={draft.periodEnd}
                min={draft.periodStart || undefined}
                aria-invalid={!!errors.periodEnd}
                onChange={(e) => update({ periodEnd: e.target.value })}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField
              id="budget-amount"
              label={`Budget amount (${currency})`}
              required
              error={errors.amount}
              className="sm:col-span-2"
            >
              <Input
                id="budget-amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={draft.amount}
                aria-invalid={!!errors.amount}
                onChange={(e) => update({ amount: e.target.value })}
              />
            </FormField>
            <FormField id="budget-currency" label="Currency">
              <Select value={currency} onValueChange={(v) => update({ currency: v })}>
                <SelectTrigger id="budget-currency">
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
          <FormField id="budget-notes" label="Notes">
            <Input
              id="budget-notes"
              value={draft.notes}
              onChange={(e) => update({ notes: e.target.value })}
            />
          </FormField>
          {errors.form && (
            <p role="alert" className="text-sm text-destructive">
              {errors.form}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => guardClose(onClose)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createBudget.isPending}>
              {createBudget.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create budget
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
