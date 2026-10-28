import { Link } from "@tanstack/react-router";
import { AlertTriangle, Loader2, Plus } from "lucide-react";
import {
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_STYLES,
  personName,
} from "@/features/it/use-tickets";
import {
  RESPONSE_TARGET_TEXT,
  hoursWaiting,
  useTicketInsights,
} from "@/features/it/ticket-insights";
import { AgingBars } from "@/components/aging-bars";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const waitedFor = (hours: number) =>
  hours < 48 ? `${Math.round(hours)} hours` : `${Math.round(hours / 24)} days`;

/** What IT has been asked for: how much is waiting, how long, and what is late. */
export function TicketPressurePanel({
  canLogTickets,
  onLogTicket,
}: {
  canLogTickets: boolean;
  onLogTicket: () => void;
}) {
  const { query, unfinished, byPriority, breaching, ageRows } = useTicketInsights();

  return (
    <section className="rounded-xl border bg-card" aria-labelledby="ticket-pressure-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="ticket-pressure-heading" className="text-sm font-semibold">
          Tickets waiting for IT
        </h2>
        <Link
          to="/it/tickets"
          search={{ view: "list" }}
          className="text-xs font-medium text-primary hover:underline"
        >
          Open every ticket
        </Link>
      </div>

      {query.isError ? (
        <div className="p-4">
          <LoadError what="tickets" error={query.error} onRetry={() => query.refetch()} />
        </div>
      ) : query.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : unfinished.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-sm font-medium">Nothing is waiting for IT</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Staff raise tickets from Ask IT for help. New ones land here and on the ticket board.
          </p>
          {canLogTickets && (
            <Button size="sm" onClick={onLogTicket}>
              <Plus className="mr-1 h-4 w-4" /> Log a ticket
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4 p-4">
          <ul className="grid grid-cols-2 gap-2">
            {TICKET_PRIORITIES.map((p) => (
              <li key={p}>
                <Link
                  to="/it/tickets"
                  search={{ view: "list" }}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 hover:border-primary/50"
                >
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      TICKET_PRIORITY_STYLES[p],
                    )}
                  >
                    {TICKET_PRIORITY_LABELS[p]}
                  </span>
                  <span className="text-lg font-semibold tabular-nums">
                    {byPriority.get(p) ?? 0}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div>
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
              How long they have been waiting
            </h3>
            <AgingBars rows={ageRows} countLabel="tickets" emptyText="Nothing is waiting for IT." />
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <AlertTriangle
                className={cn("h-3.5 w-3.5", breaching.length > 0 && "text-destructive")}
                aria-hidden="true"
              />
              Waited longer than IT aims to
            </h3>
            {breaching.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Every ticket was picked up in time. Nothing to chase.
              </p>
            ) : (
              <ul className="divide-y">
                {breaching.slice(0, 4).map((t) => (
                  <li key={t.id}>
                    <Link
                      to="/it/tickets"
                      search={{ ticket: t.id }}
                      className="flex items-start justify-between gap-3 py-2 text-sm hover:bg-secondary/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{t.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {personName(t.requester, "Someone")} · aim to start{" "}
                          {RESPONSE_TARGET_TEXT[t.priority]}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-destructive">
                        {waitedFor(hoursWaiting(t))}
                      </span>
                    </Link>
                  </li>
                ))}
                {breaching.length > 4 && (
                  <li className="pt-2 text-xs">
                    <Link
                      to="/it/tickets"
                      search={{ view: "list" }}
                      className="text-primary hover:underline"
                    >
                      +{breaching.length - 4} more waiting too long
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
