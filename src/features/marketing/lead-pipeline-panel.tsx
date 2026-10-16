import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { LEAD_STAGES, LEAD_STAGE_LABELS, LEAD_STAGE_STYLES } from "@/features/marketing/use-leads";
import { useLeadInsights } from "@/features/marketing/lead-insights";
import { NewLeadDialog } from "@/features/marketing/new-lead-dialog";
import { LoadError } from "@/components/load-error";
import { formatRelative } from "@/lib/format-date";
import { cn } from "@/lib/utils";

/** Every lead by the stage it has reached, plus the ones nobody has touched lately. */
export function LeadPipelinePanel({
  canManage,
  onOpenLead,
}: {
  canManage: boolean;
  onOpenLead: (id: string) => void;
}) {
  const { query, leads, byStage, converted, lost, conversionRate, goingCold } = useLeadInsights();
  const max = Math.max(...LEAD_STAGES.map((s) => byStage.get(s) ?? 0), 1);

  return (
    <section className="rounded-xl border bg-card" aria-labelledby="lead-pipeline-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="lead-pipeline-heading" className="text-sm font-semibold">
          Where leads are right now
        </h2>
        <Link to="/marketing/leads" className="text-xs font-medium text-primary hover:underline">
          Open the leads board
        </Link>
      </div>

      {query.isError ? (
        <div className="p-4">
          <LoadError what="leads" error={query.error} onRetry={() => query.refetch()} />
        </div>
      ) : query.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-sm font-medium">No leads yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            A lead is a company that showed interest. Add the first one, then move it along as you
            talk to them.
          </p>
          {canManage && <NewLeadDialog onCreated={onOpenLead} />}
        </div>
      ) : (
        <div className="space-y-4 p-4">
          <ul className="space-y-2.5">
            {LEAD_STAGES.map((stage) => {
              const count = byStage.get(stage) ?? 0;
              return (
                <li key={stage}>
                  <Link
                    to="/marketing/leads"
                    className="block rounded px-1 py-0.5 -mx-1 hover:bg-secondary/40"
                  >
                    <span className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          LEAD_STAGE_STYLES[stage],
                        )}
                      >
                        {LEAD_STAGE_LABELS[stage]}
                      </span>
                      <span className="tabular-nums font-semibold">{count}</span>
                    </span>
                    <span className="block h-2 overflow-hidden rounded-full bg-secondary">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${(count / max) * 100}%` }}
                      />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="border-t pt-3 text-xs text-muted-foreground">
            {converted.length} became clients · {lost.length} went nowhere ·{" "}
            <span className="font-semibold text-foreground">
              {conversionRate === null ? "No decisions yet" : `${conversionRate}% win rate`}
            </span>
          </p>

          <div>
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
              Nobody has touched these for two weeks
            </h3>
            {goingCold.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Every open lead has been followed up recently.
              </p>
            ) : (
              <ul className="divide-y">
                {goingCold.slice(0, 4).map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => onOpenLead(l.id)}
                      className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {l.name}
                          {l.company && (
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              · {l.company}
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          Last touched {formatRelative(l.updated_at)}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {LEAD_STAGE_LABELS[l.stage]}
                      </span>
                    </button>
                  </li>
                ))}
                {goingCold.length > 4 && (
                  <li className="pt-2 text-xs">
                    <Link to="/marketing/leads" className="text-primary hover:underline">
                      +{goingCold.length - 4} more waiting on a follow-up
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
