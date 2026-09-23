import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { TENDER_STAGE_LABELS, TENDER_STAGE_STYLES, useTenders } from "@/features/tender/use-tender";
import { daysToDeadline, tendersStillToSubmit } from "@/features/tender/bid-deadlines";
import { formatCurrency } from "@/features/finance/finance";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";

const deadlineText = (days: number) =>
  days < 0
    ? `${-days} day${days === -1 ? "" : "s"} past the deadline`
    : days === 0
      ? "Closes today"
      : `${days} day${days === 1 ? "" : "s"} left`;

/** What has to be finished and sent, ordered by how soon it closes. */
export function ClosingSoonPanel() {
  const tendersQ = useTenders({});
  const tenders = tendersQ.data ?? [];
  const queue = tendersStillToSubmit(tenders);
  const closingThisWeek = queue.filter((t) => {
    const days = daysToDeadline(t.submission_deadline!);
    return days >= 0 && days <= 7;
  });
  const missed = queue.filter((t) => daysToDeadline(t.submission_deadline!) < 0);

  return (
    <section className="rounded-xl border bg-card" aria-labelledby="closing-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="closing-heading" className="text-sm font-semibold">
          What has to go in next
        </h2>
        <Link
          to="/tender/bid-pipeline"
          className="text-xs font-medium text-primary hover:underline"
        >
          Open the board
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
      ) : queue.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-sm font-medium">Nothing waiting to be submitted</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Add a tender with its closing date and it will appear here, counting down.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link to="/tender/bid-pipeline">Open the board</Link>
          </Button>
        </div>
      ) : (
        <div className="p-4">
          <p className="mb-2 text-xs text-muted-foreground">
            {closingThisWeek.length} close{closingThisWeek.length === 1 ? "s" : ""} within a week
            {missed.length > 0 && (
              <span className="font-semibold text-destructive">
                {" "}
                · {missed.length} already past the deadline
              </span>
            )}
          </p>
          <ul className="divide-y">
            {queue.slice(0, 6).map((t) => {
              const days = daysToDeadline(t.submission_deadline!);
              const docs =
                t.requirements_total && t.requirements_total > 0
                  ? `${t.requirements_done ?? 0} of ${t.requirements_total} documents ready`
                  : "No documents listed";
              return (
                <li key={t.id}>
                  <Link
                    to="/tender/$tenderId"
                    params={{ tenderId: t.id }}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-secondary/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{t.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {t.client_name ?? t.prospect_client_name ?? "Client not set"} · {docs}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span
                        className={cn(
                          "block text-xs font-semibold",
                          days < 0
                            ? "text-destructive"
                            : days <= 7
                              ? "text-warning"
                              : "text-muted-foreground",
                        )}
                      >
                        {deadlineText(days)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(t.submission_deadline)}
                        {t.estimated_value != null
                          ? ` · ${formatCurrency(t.estimated_value, t.currency)}`
                          : ""}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 inline-block rounded-full px-2 py-0.5 text-[0.625rem] font-medium",
                          TENDER_STAGE_STYLES[t.stage],
                        )}
                      >
                        {TENDER_STAGE_LABELS[t.stage]}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {queue.length > 6 && (
            <Link
              to="/tender/bid-pipeline"
              className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
            >
              +{queue.length - 6} more waiting to go in
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
