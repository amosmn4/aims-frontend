import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import {
  useCostItems,
  useCreateCostItem,
} from "@/features/project-workspace/use-project-workspace";
import { useProjectFinancials, type Project } from "@/features/projects/use-projects";
import { money } from "@/features/project-workspace/workspace-theme";
import { ClientContractPanel } from "@/features/projects/client-contract-panel";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { formatDate } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const INVOICE_STATUS_STYLES: Record<string, { bg: string; c: string }> = {
  paid: { bg: "var(--pipeline-teal-soft)", c: "var(--pipeline-teal)" },
  sent: { bg: "var(--pipeline-gold-soft)", c: "var(--pipeline-gold)" },
  overdue: { bg: "var(--pipeline-coral-soft)", c: "var(--pipeline-coral)" },
};
const words = (s: string) => {
  const t = s.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function FinancialsTab({
  project,
  projectId,
  canManage = false,
  showClientContract = false,
}: {
  project: Project;
  projectId: string;
  canManage?: boolean;
  /** Show the client and contract panel here (projects whose overview lacks it). */
  showClientContract?: boolean;
}) {
  const costItemsQ = useCostItems(projectId);
  const financialsQ = useProjectFinancials(projectId);
  const [addingCost, setAddingCost] = useState(false);

  const costItems = costItemsQ.data ?? [];
  const budget = project.budget ?? 0;
  const committed = costItems.reduce((a, c) => a + c.budgeted_amount, 0);
  const actual = costItems.reduce((a, c) => a + c.actual_amount, 0);
  const remaining = budget - actual;

  const invoices = financialsQ.data?.hasContract ? financialsQ.data.invoices : [];

  return (
    <>
      <div className="ws-fin-grid">
        <div className="ws-metric-card">
          <div className="label">Total budget</div>
          <div className="num">{money(budget)}</div>
        </div>
        <div className="ws-metric-card">
          <div className="label">Planned costs</div>
          <div className="num">{money(committed)}</div>
          <div className="sub">Budgeted across cost categories</div>
        </div>
        <div className="ws-metric-card">
          <div className="label">Spent so far</div>
          <div className="num">{money(actual)}</div>
        </div>
        <div className="ws-metric-card">
          <div className="label">Left in budget</div>
          <div
            className="num"
            style={{ color: remaining < 0 ? "var(--pipeline-coral)" : "var(--pipeline-teal)" }}
          >
            {money(remaining)}
          </div>
        </div>
      </div>

      {showClientContract && <ClientContractPanel project={project} canManage={canManage} />}

      <div className="ws-two-col">
        <div className="ws-panel">
          <h3>
            Costs by category
            {canManage && costItems.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setAddingCost(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add cost item
              </Button>
            )}
          </h3>
          {costItemsQ.isLoading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : costItemsQ.isError ? (
            <LoadError what="costs" error={costItemsQ.error} onRetry={() => costItemsQ.refetch()} />
          ) : costItems.length === 0 ? (
            <div className="flex flex-col items-start gap-2 text-sm">
              <span style={{ color: "var(--pipeline-slate)" }}>No costs recorded yet.</span>
              {canManage && (
                <Button size="sm" variant="outline" onClick={() => setAddingCost(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add cost item
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ws-costs">
                <tbody>
                  <tr>
                    <th>Category</th>
                    <th className="num">Budget</th>
                    <th className="num">Spent</th>
                    <th className="num">% used</th>
                  </tr>
                  {costItems.map((c) => (
                    <tr key={c.id}>
                      <td>{c.category}</td>
                      <td className="num">{money(c.budgeted_amount)}</td>
                      <td className="num">{money(c.actual_amount)}</td>
                      <td className="num">
                        {c.budgeted_amount > 0
                          ? Math.round((c.actual_amount / c.budgeted_amount) * 100)
                          : 0}
                        %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="ws-panel">
          <h3>Invoices</h3>
          {financialsQ.isLoading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : financialsQ.isError ? (
            <LoadError
              what="invoices"
              error={financialsQ.error}
              onRetry={() => financialsQ.refetch()}
            />
          ) : !financialsQ.data?.hasContract ? (
            <div className="text-sm" style={{ color: "var(--pipeline-slate)" }}>
              {!canManage
                ? "This project isn't linked to a contract yet."
                : showClientContract
                  ? "This project isn't linked to a contract yet. Link one under Client & contract above to see invoices here."
                  : "This project isn't linked to a contract yet. Link one on the Overview tab to see invoices here."}
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-sm" style={{ color: "var(--pipeline-slate)" }}>
              No invoices raised yet.
            </div>
          ) : (
            invoices.map((inv) => {
              const style = INVOICE_STATUS_STYLES[inv.status.toLowerCase()] ?? {
                bg: "var(--pipeline-paper)",
                c: "var(--pipeline-slate)",
              };
              return (
                <div
                  key={inv.id}
                  className="flex justify-between items-center py-2.5"
                  style={{ borderBottom: "1px solid var(--pipeline-line-soft)", fontSize: 12.5 }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{inv.invoiceNumber}</div>
                    <div className="text-xs" style={{ color: "var(--pipeline-slate)" }}>
                      Due {formatDate(inv.dueDate)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="p-mono">{money(inv.total)}</div>
                    <span
                      className="p-chip"
                      style={{ background: style.bg, color: style.c, marginTop: 4 }}
                    >
                      {words(inv.status)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      {addingCost && (
        <AddCostItemDialog projectId={projectId} onClose={() => setAddingCost(false)} />
      )}
    </>
  );
}

type CostErrors = Partial<Record<"category" | "budgeted" | "actual", string>>;

function AddCostItemDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const createItem = useCreateCostItem(projectId);
  const [category, setCategory] = useState("");
  const [budgeted, setBudgeted] = useState("");
  const [actual, setActual] = useState("");
  const [errors, setErrors] = useState<CostErrors>({});
  const { guardClose } = useUnsavedChanges(!!(category.trim() || budgeted || actual));

  const submit = () => {
    const found: CostErrors = {};
    if (!category.trim()) found.category = "Name the category, e.g. “Venue hire”.";
    if (!budgeted || Number(budgeted) < 0) found.budgeted = "Enter the budgeted amount.";
    if (actual && Number(actual) < 0) found.actual = "The amount spent can't be negative.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    createItem.mutate(
      {
        category: category.trim(),
        budgetedAmount: Number(budgeted),
        actualAmount: Number(actual) || 0,
      },
      {
        onSuccess: () => {
          toast.success("Cost item added");
          onClose();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onClose)}>
      <DialogContent>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Add cost item</DialogTitle>
            <RequiredNote />
          </DialogHeader>
          <div className="space-y-3">
            <FormField id="cost-category" label="Category" required error={errors.category}>
              <Input
                id="cost-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Venue hire"
                aria-invalid={!!errors.category}
              />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                id="cost-budgeted"
                label="Budgeted amount"
                required
                error={errors.budgeted}
              >
                <Input
                  id="cost-budgeted"
                  type="number"
                  min={0}
                  value={budgeted}
                  onChange={(e) => setBudgeted(e.target.value)}
                  aria-invalid={!!errors.budgeted}
                />
              </FormField>
              <FormField id="cost-actual" label="Spent so far" error={errors.actual}>
                <Input
                  id="cost-actual"
                  type="number"
                  min={0}
                  value={actual}
                  onChange={(e) => setActual(e.target.value)}
                  aria-invalid={!!errors.actual}
                />
              </FormField>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => guardClose(onClose)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createItem.isPending}>
              {createItem.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add cost item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
