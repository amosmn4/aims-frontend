import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useInventoryItems } from "@/features/it/use-inventory";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const inDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Laptops and other kit that needs a decision: broken, idle, or out of warranty soon. */
export function InventoryAttentionPanel() {
  const itemsQ = useInventoryItems();
  const items = itemsQ.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const soon = inDays(60);

  const rows = [
    {
      label: "Faulty or needs a look",
      count: items.filter((i) => i.condition === "faulty" || i.condition === "needs_attention")
        .length,
      note: "Repair it or take it out of use",
      urgent: true,
    },
    {
      label: "Away being repaired",
      count: items.filter((i) => i.status === "under_repair").length,
      note: "Chase the repairer if it has been a while",
      urgent: false,
    },
    {
      label: "In use with nobody's name on it",
      count: items.filter((i) => i.status === "in_use" && !i.assigned_user_id && !i.assigned_to)
        .length,
      note: "Write down who is using it",
      urgent: false,
    },
    {
      label: "Warranty ends within 60 days",
      count: items.filter(
        (i) => i.warranty_expiry && i.warranty_expiry >= today && i.warranty_expiry <= soon,
      ).length,
      note: "Renew cover or plan the replacement",
      urgent: true,
    },
  ];
  const needsNothing = rows.every((r) => r.count === 0);

  return (
    <section className="rounded-xl border bg-card" aria-labelledby="kit-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="kit-heading" className="text-sm font-semibold">
          Equipment needing a decision
        </h2>
        <Link to="/it/inventory" className="text-xs font-medium text-primary hover:underline">
          All equipment ({items.length})
        </Link>
      </div>

      {itemsQ.isError ? (
        <div className="p-4">
          <LoadError what="equipment" error={itemsQ.error} onRetry={() => itemsQ.refetch()} />
        </div>
      ) : itemsQ.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-sm font-medium">No equipment written down yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Add the laptops, monitors and printers the company owns, so repairs, warranties and who
            has what are all in one place.
          </p>
          <Button size="sm" asChild>
            <Link to="/it/inventory">Open the equipment list</Link>
          </Button>
        </div>
      ) : needsNothing ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          All {items.length} items are in good shape, in use and in warranty.
        </p>
      ) : (
        <ul className="divide-y">
          {rows
            .filter((r) => r.count > 0)
            .map((r) => (
              <li key={r.label}>
                <Link
                  to="/it/inventory"
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-secondary/40"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{r.label}</span>
                    <span className="block text-xs text-muted-foreground">{r.note}</span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-lg font-semibold tabular-nums",
                      r.urgent && "text-destructive",
                    )}
                  >
                    {r.count}
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
