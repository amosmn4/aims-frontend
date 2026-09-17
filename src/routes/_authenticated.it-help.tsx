import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { ChevronRight, LifeBuoy, Loader2, MessageSquare, Ticket } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format-date";
import {
  TICKET_STATUS_HINTS,
  personName,
  useTickets,
  type TicketRow,
} from "@/features/it/use-tickets";
import { TicketStatusBadge } from "@/features/it/tickets/ticket-badges";
import { TicketDetailSheet } from "@/features/it/tickets/ticket-detail-sheet";
import { TicketFormDialog } from "@/features/it/tickets/ticket-form-dialog";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({
  ticket: z.string().optional().catch(undefined),
  new: z.literal(1).optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/it-help")({
  head: () => ({ meta: [{ title: "IT help — AIMS" }] }),
  validateSearch: searchSchema,
  component: ItHelp,
});

const ACTIVE = new Set(["open", "in_progress"]);

/** Still-active requests first, each group newest first. */
const byActiveThenNewest = (a: TicketRow, b: TicketRow) =>
  Number(ACTIVE.has(b.status)) - Number(ACTIVE.has(a.status)) ||
  b.createdAt.localeCompare(a.createdAt);

function ItHelp() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { user, canWriteDepartment } = useAuth();
  const isIt = canWriteDepartment("it");
  const ticketsQ = useTickets({ mine: true });
  const [formOpen, setFormOpen] = useState(false);

  // ?new=1 opens the form once, then drops the flag.
  useEffect(() => {
    if (search.new !== 1) return;
    setFormOpen(true);
    navigate({ search: (prev) => ({ ...prev, new: undefined }), replace: true });
  }, [search.new, navigate]);

  const { mine, givenToMe } = useMemo(() => {
    const rows = ticketsQ.data ?? [];
    return {
      mine: rows.filter((t) => t.requesterId === user?.id).sort(byActiveThenNewest),
      givenToMe: isIt
        ? []
        : rows.filter((t) => t.requesterId !== user?.id).sort(byActiveThenNewest),
    };
  }, [ticketsQ.data, user?.id, isIt]);

  const askButton = (
    <Button onClick={() => setFormOpen(true)}>
      <LifeBuoy className="mr-1 h-4 w-4" /> Ask IT for help
    </Button>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="IT help"
        description="Ask IT for help with a computer, system or access problem."
        actions={
          <>
            {isIt && (
              <Button variant="outline" asChild>
                <Link to="/it/tickets">
                  <Ticket className="mr-1 h-4 w-4" /> Go to IT tickets
                </Link>
              </Button>
            )}
            {askButton}
          </>
        }
      />

      <section aria-labelledby="my-requests-heading" className="space-y-3">
        <h2 id="my-requests-heading" className="text-sm font-semibold">
          My requests
        </h2>
        {ticketsQ.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading requests" />
          </div>
        ) : ticketsQ.isError ? (
          <LoadError
            what="your requests"
            error={ticketsQ.error}
            onRetry={() => ticketsQ.refetch()}
          />
        ) : mine.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            <span>You haven't asked IT for anything yet.</span>
            {askButton}
          </div>
        ) : (
          <RequestList tickets={mine} currentUserId={user?.id} />
        )}
      </section>

      {givenToMe.length > 0 && (
        <section aria-labelledby="given-to-me-heading" className="space-y-3">
          <h2 id="given-to-me-heading" className="text-sm font-semibold">
            Given to you by IT
          </h2>
          <RequestList tickets={givenToMe} currentUserId={user?.id} />
        </section>
      )}

      <TicketFormDialog open={formOpen} mode="help" onClose={() => setFormOpen(false)} />
      <TicketDetailSheet
        ticketId={search.ticket ?? null}
        onClose={() =>
          navigate({ search: (prev) => ({ ...prev, ticket: undefined }), replace: true })
        }
      />
    </div>
  );
}

function RequestList({ tickets, currentUserId }: { tickets: TicketRow[]; currentUserId?: string }) {
  return (
    <ul className="space-y-2">
      {tickets.map((t) => {
        const messages = t._count?.comments ?? 0;
        const handler = t.assignee
          ? `Handled by ${t.assigneeId === currentUserId ? "you" : personName(t.assignee)}`
          : "Not picked up by IT yet";
        return (
          <li key={t.id}>
            <Link
              to="/it-help"
              search={{ ticket: t.id }}
              className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium leading-snug">{t.title}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <TicketStatusBadge status={t.status} />
                  <span>{TICKET_STATUS_HINTS[t.status]}</span>
                </div>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>Asked {formatDate(t.createdAt)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{handler}</span>
                  {messages > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                        {messages} {messages === 1 ? "message" : "messages"}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <span className="hidden shrink-0 items-center text-xs font-medium text-primary sm:inline-flex">
                Open request <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-muted-foreground sm:hidden"
                aria-hidden="true"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
