import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useCanManageWater } from "./use-water";
import { usePayWaterExpense, useSaveWaterExpense } from "./use-water-expenses";
import {
  WATER_EXPENSE_CATEGORY_LABELS,
  waterToday,
  type WaterExpenseCategory,
  type WaterExpenseRow,
} from "./water-expense-types";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { FormField, RequiredNote } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

export function ExpenseFormDialog({
  value,
  paymentOnly = false,
  onClose,
}: {
  value: WaterExpenseRow | "new" | null;
  paymentOnly?: boolean;
  onClose: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const { guardClose } = useUnsavedChanges(dirty);
  const close = () => {
    setDirty(false);
    onClose();
  };
  return (
    <Dialog open={!!value} onOpenChange={(open) => !open && !busy && guardClose(close)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {value && (
          <ExpenseForm
            key={value === "new" ? "new" : `${value.id}-${paymentOnly}`}
            value={value === "new" ? null : value}
            paymentOnly={paymentOnly}
            onDirtyChange={setDirty}
            onBusyChange={setBusy}
            onCancel={() => guardClose(close)}
            onDone={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ExpenseForm({
  value,
  paymentOnly,
  onDirtyChange,
  onBusyChange,
  onCancel,
  onDone,
}: {
  value: WaterExpenseRow | null;
  paymentOnly: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { viewAs } = useAuth();
  const canManage = useCanManageWater() && !viewAs;
  const save = useSaveWaterExpense();
  const pay = usePayWaterExpense();
  const [initialDate] = useState(waterToday);
  const [date, setDate] = useState(value?.expenseDate ?? initialDate);
  const [category, setCategory] = useState<WaterExpenseCategory>(
    value?.waterCategory ?? "electricity",
  );
  const [description, setDescription] = useState(value?.description ?? "");
  const [amount, setAmount] = useState(value ? String(value.amount) : "");
  const [supplier, setSupplier] = useState(value?.supplier ?? "");
  const [reference, setReference] = useState(value?.reference ?? "");
  const [paid, setPaid] = useState(paymentOnly || !value || value.status === "paid");
  const [paidOn, setPaidOn] = useState(value?.paidOn ?? initialDate);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const busy = save.isPending || pay.isPending;
  const dirty =
    date !== (value?.expenseDate ?? initialDate) ||
    category !== (value?.waterCategory ?? "electricity") ||
    description !== (value?.description ?? "") ||
    amount !== (value ? String(value.amount) : "") ||
    supplier !== (value?.supplier ?? "") ||
    reference !== (value?.reference ?? "") ||
    paid !== (paymentOnly || !value || value.status === "paid") ||
    paidOn !== (value?.paidOn ?? initialDate);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManage || busy) return;
    const next: Record<string, string> = {};
    const number = Number(amount);
    if (!paymentOnly) {
      if (!date) next.date = "Choose a date";
      if (description.trim().length < 2) next.description = "Describe the expense in a few words";
      if (
        !amount.trim() ||
        !Number.isFinite(number) ||
        number <= 0 ||
        number > 999999999999.99 ||
        !/^\d+(\.\d{1,2})?$/.test(amount)
      )
        next.amount = "Enter an amount greater than zero with at most two decimal places";
    }
    if (paid && !paidOn) next.paidOn = "Choose the payment date";
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      if (paymentOnly && value)
        await pay.mutateAsync({ id: value.id, paidOn, reference: reference.trim() });
      else
        await save.mutateAsync({
          id: value?.id,
          expenseDate: date,
          category,
          description: description.trim(),
          amount: number,
          supplier: supplier.trim(),
          reference: reference.trim(),
          paidOn: paid ? paidOn : null,
        });
      toast.success(
        paymentOnly ? "Expense marked as paid" : value ? "Expense updated" : "Expense recorded",
      );
      onDone();
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Could not save the expense" });
    }
  };
  const invalid = (key: string, id: string) =>
    errors[key] ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` } : {};
  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>
          {paymentOnly ? "Mark expense as paid" : value ? "Edit expense" : "Add expense"}
        </DialogTitle>
        <DialogDescription>
          {paymentOnly ? value?.description : "Record a Water operating cost. Amounts are in KES."}
        </DialogDescription>
      </DialogHeader>
      <RequiredNote />
      {!paymentOnly && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="expense-date" label="Date" required error={errors.date}>
              <Input
                id="expense-date"
                type="date"
                value={date}
                onChange={(e) => {
                  if (!value && paidOn === date) setPaidOn(e.target.value);
                  setDate(e.target.value);
                }}
                {...invalid("date", "expense-date")}
              />
            </FormField>
            <FormField id="expense-category" label="Category" required>
              <Select
                value={category}
                onValueChange={(next) => setCategory(next as WaterExpenseCategory)}
              >
                <SelectTrigger id="expense-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WATER_EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField
            id="expense-description"
            label="Description"
            required
            error={errors.description}
          >
            <Input
              id="expense-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={190}
              placeholder="For example, electricity used to pump water"
              {...invalid("description", "expense-description")}
            />
          </FormField>
          <FormField id="expense-amount" label="Amount (KES)" required error={errors.amount}>
            <Input
              id="expense-amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              max="999999999999.99"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              {...invalid("amount", "expense-amount")}
            />
          </FormField>
          <div className="flex items-center gap-2">
            <Switch id="expense-paid" checked={paid} onCheckedChange={setPaid} />
            <Label htmlFor="expense-paid">Already paid</Label>
          </div>
        </>
      )}
      {paid && (
        <FormField id="expense-paid-on" label="Payment date" required error={errors.paidOn}>
          <Input
            id="expense-paid-on"
            type="date"
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
            {...invalid("paidOn", "expense-paid-on")}
          />
        </FormField>
      )}
      {paymentOnly ? (
        <FormField id="expense-reference" label="Payment reference">
          <Input
            id="expense-reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={120}
          />
        </FormField>
      ) : (
        <details className="rounded-md border p-3" open={!!value?.supplier || !!value?.reference}>
          <summary className="cursor-pointer text-sm">Supplier and reference</summary>
          <div className="mt-3 space-y-3">
            <FormField id="expense-supplier" label="Supplier">
              <Input
                id="expense-supplier"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                maxLength={160}
              />
            </FormField>
            <FormField id="expense-reference" label="Reference">
              <Input
                id="expense-reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={120}
              />
            </FormField>
          </div>
        </details>
      )}
      {errors.form && (
        <p role="alert" className="text-sm text-destructive">
          {errors.form}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canManage || busy}>
          {busy ? "Saving..." : paymentOnly ? "Mark as paid" : "Save expense"}
        </Button>
      </DialogFooter>
    </form>
  );
}
