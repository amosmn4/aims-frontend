import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { useCostItems, useCreateCostItem } from "@/features/project-workspace/use-project-workspace";
import { useProjectFinancials, type Project } from "@/features/projects/use-projects";
import { money, fmtDate } from "@/features/project-workspace/workspace-theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const INVOICE_STATUS_STYLES: Record<string, { bg: string; c: string }> = {
  paid: { bg: "var(--pipeline-teal-soft)", c: "var(--pipeline-teal)" },
  sent: { bg: "var(--pipeline-gold-soft)", c: "var(--pipeline-gold)" },
  overdue: { bg: "var(--pipeline-coral-soft)", c: "var(--pipeline-coral)" },
};

export function FinancialsTab({ project, projectId }: { project: Project; projectId: string }) {
  const costItemsQ = useCostItems(projectId);
  const financialsQ = useProjectFinancials(projectId);

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
          <div className="label">Total Budget</div>
          <div className="num">{money(budget)}</div>
        </div>
        <div className="ws-metric-card">
          <div className="label">Committed</div>
          <div className="num">{money(committed)}</div>
          <div className="sub">contracted / obligated</div>
        </div>
        <div className="ws-metric-card">
          <div className="label">Actual Spend</div>
          <div className="num">{money(actual)}</div>
        </div>
        <div className="ws-metric-card">
          <div className="label">Remaining</div>
          <div className="num" style={{ color: remaining < 0 ? "var(--pipeline-coral)" : "var(--pipeline-teal)" }}>
            {money(remaining)}
          </div>
        </div>
      </div>

      <div className="ws-two-col">
        <div className="ws-panel">
          <h3>
            Cost Breakdown by Category
            <AddCostItemDialog projectId={projectId} />
          </h3>
          {costItemsQ.isLoading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : costItems.length === 0 ? (
            <div className="ws-section-label">No cost items recorded yet.</div>
          ) : (
            <table className="ws-costs">
              <tbody>
                <tr>
                  <th>Category</th>
                  <th className="num">Budget</th>
                  <th className="num">Actual</th>
                  <th className="num">% Used</th>
                </tr>
                {costItems.map((c) => (
                  <tr key={c.id}>
                    <td>{c.category}</td>
                    <td className="num">{money(c.budgeted_amount)}</td>
                    <td className="num">{money(c.actual_amount)}</td>
                    <td className="num">
                      {c.budgeted_amount > 0 ? Math.round((c.actual_amount / c.budgeted_amount) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="ws-panel">
          <h3>Invoice Schedule</h3>
          {!financialsQ.data?.hasContract ? (
            <div className="ws-section-label">
              This project isn't linked to a contract yet — link one to see invoices here.
            </div>
          ) : invoices.length === 0 ? (
            <div className="ws-section-label">No invoices raised yet.</div>
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
                    <div className="ws-section-label" style={{ margin: "2px 0 0" }}>
                      {fmtDate(inv.dueDate)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="p-mono">{money(inv.total)}</div>
                    <span className="p-chip" style={{ background: style.bg, color: style.c, marginTop: 4 }}>
                      {inv.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

function AddCostItemDialog({ projectId }: { projectId: string }) {
  const createItem = useCreateCostItem(projectId);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [budgeted, setBudgeted] = useState("");
  const [actual, setActual] = useState("");

  const submit = () => {
    if (!category.trim() || !budgeted) {
      toast.error("Category and budgeted amount are required");
      return;
    }
    createItem.mutate(
      { category: category.trim(), budgetedAmount: Number(budgeted), actualAmount: Number(actual) || 0 },
      {
        onSuccess: () => {
          toast.success("Cost item added");
          setOpen(false);
          setCategory("");
          setBudgeted("");
          setActual("");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="ws-section-label" style={{ margin: 0 }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add cost item</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Internal Labour" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Budgeted amount</Label>
              <Input type="number" value={budgeted} onChange={(e) => setBudgeted(e.target.value)} />
            </div>
            <div>
              <Label>Actual amount</Label>
              <Input type="number" value={actual} onChange={(e) => setActual(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={createItem.isPending}>
            {createItem.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
