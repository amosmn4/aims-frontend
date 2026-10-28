import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useTenderWorkQueue, type TenderRow } from "@/features/tender/use-tender";
import { LoadError } from "@/components/load-error";
import { cn } from "@/lib/utils";

type Gap = { text: string; serious: boolean };

/** What is still missing before this bid can go in. */
function gapsFor(t: TenderRow): Gap[] {
  const gaps: Gap[] = [];
  if (!t.account_manager_id) gaps.push({ text: "No one owns it", serious: true });
  if (!t.requirements_total) gaps.push({ text: "No documents listed", serious: true });
  else if ((t.requirements_done ?? 0) < t.requirements_total)
    gaps.push({
      text: `${t.requirements_total - (t.requirements_done ?? 0)} documents still missing`,
      serious: false,
    });
  if (!t.submission_deadline) gaps.push({ text: "No closing date", serious: true });
  if (t.estimated_value == null) gaps.push({ text: "No value estimated", serious: false });
  if (!t.client_id && !t.prospect_client_name)
    gaps.push({ text: "No client named", serious: false });
  return gaps;
}

/** Bids that cannot go in yet: no owner, no documents, no closing date. */
export function BidReadinessPanel() {
  const tendersQ = useTenderWorkQueue();
  const rows = (tendersQ.data?.notReady ?? []).map((tender) => ({ tender, gaps: gapsFor(tender) }));
  const total = tendersQ.data?.totals.notReadyTotal ?? 0;
  const noOwner = tendersQ.data?.totals.noOwner ?? 0;
  const noDocs = tendersQ.data?.totals.noDocs ?? 0;

  return (
    <section className="rounded-xl border bg-card" aria-labelledby="readiness-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="readiness-heading" className="text-sm font-semibold">
          Bids that are not ready
        </h2>
        <Link to="/tender/documents" className="text-xs font-medium text-primary hover:underline">
          Mandatory documents library
        </Link>
      </div>

      {tendersQ.isError ? (
        <div className="p-4">
          <LoadError what="tenders" error={tendersQ.error} onRetry={() => tendersQ.refetch()} />
        </div>
      ) : tendersQ.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          Every bid being prepared has an owner, a closing date and its documents listed.
        </p>
      ) : (
        <div className="p-4">
          <p className="mb-2 text-xs text-muted-foreground">
            {noOwner} with nobody in charge · {noDocs} with no documents listed
          </p>
          <ul className="divide-y">
            {rows.slice(0, 6).map(({ tender, gaps }) => (
              <li key={tender.id}>
                <Link
                  to="/tender/$tenderId"
                  params={{ tenderId: tender.id }}
                  className="block py-2.5 hover:bg-secondary/40"
                >
                  <span className="block truncate text-sm font-medium">{tender.title}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {gaps.map((g) => (
                      <span
                        key={g.text}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[0.625rem] font-medium",
                          g.serious
                            ? "bg-destructive/15 text-destructive"
                            : "bg-warning/15 text-warning",
                        )}
                      >
                        {g.text}
                      </span>
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {total > 6 && (
            <Link
              to="/tender/bid-pipeline"
              className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
            >
              +{total - 6} more needing details
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
