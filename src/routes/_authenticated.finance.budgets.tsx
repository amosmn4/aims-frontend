import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBudgets, useCreateBudget, useDeleteBudget } from "@/features/finance/use-budgets";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { formatCurrency } from "@/features/finance/finance";

export const Route = createFileRoute("/_authenticated/finance/budgets")({
  head: () => ({ meta: [{ title: "Budgets — AIMS Finance" }] }),
  component: BudgetsPage,
});

function BudgetsPage() {
  const budgetsQ = useBudgets();
  const departmentsQ = useDepartments();
  const deleteBudget = useDeleteBudget();

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this budget?")) return;
    try {
      await deleteBudget.mutateAsync(id);
      toast.success("Budget deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold">Department & project budgets</h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              Actuals are computed live from invoices — nothing here is a duplicated figure, so
              budget-vs-actual can never drift out of sync with what's actually been invoiced.
              Contract/project-level budgets will populate once Clients & Contracts moves to AIMS;
              only department budgets can be created here today.
            </p>
          </div>
          <NewBudgetDialog
            departments={departmentsQ.data ?? []}
            onCreated={() => budgetsQ.refetch()}
          />
        </div>

        {budgetsQ.isLoading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (budgetsQ.data ?? []).length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No budgets yet. Create one to start tracking budget vs actual.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Target</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Budgeted</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(budgetsQ.data ?? []).map((b) => {
                const variance = b.actual - b.budgeted_amount;
                const variancePct =
                  b.budgeted_amount > 0 ? (variance / b.budgeted_amount) * 100 : 0;
                return (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="font-medium">
                        {b.department_name ?? b.contract_title ?? "—"}
                      </div>
                      <Badge variant="secondary" className="mt-0.5">
                        {b.department_id ? "Department" : "Contract"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {b.period_start} → {b.period_end}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(b.budgeted_amount, b.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(b.actual, b.currency)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums font-medium ${
                        variance > 0 ? "text-destructive" : "text-success"
                      }`}
                    >
                      {variance >= 0 ? "+" : ""}
                      {variancePct.toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(b.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function NewBudgetDialog({
  departments,
  onCreated,
}: {
  departments: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [departmentId, setDepartmentId] = useState("");
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
  );
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const createBudget = useCreateBudget();

  const handleSave = async () => {
    if (!departmentId || !amount) {
      toast.error("Department and budgeted amount are required");
      return;
    }
    try {
      await createBudget.mutateAsync({
        departmentId,
        periodStart,
        periodEnd,
        budgetedAmount: Number(amount),
        notes: notes || undefined,
      });
      toast.success("Budget created");
      setDepartmentId("");
      setAmount("");
      setNotes("");
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> New budget
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New department budget</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Department</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Period start</Label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Period end</Label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Budgeted amount</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={createBudget.isPending}>
            {createBudget.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create budget
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
