import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { LifeBuoy, Loader2, Plus, Search, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useItSystems } from "@/features/it/use-it-systems";
import {
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  personName,
  useTickets,
  useUpdateTicket,
  useUpdateTicketStatus,
  type TicketRow,
  type TicketStatus,
} from "@/features/it/use-tickets";
import { TicketBoard } from "@/features/it/tickets/ticket-board";
import { TicketList } from "@/features/it/tickets/ticket-list";
import { TicketDetailSheet } from "@/features/it/tickets/ticket-detail-sheet";
import { TicketFormDialog } from "@/features/it/tickets/ticket-form-dialog";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const searchSchema = z.object({
  ticket: z.string().optional().catch(undefined),
  view: z.enum(["board", "list"]).optional().catch(undefined),
  new: z.literal(1).optional().catch(undefined),
  /** Show only tickets raised against one system or site. */
  system: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/it/tickets")({
  head: () => ({ meta: [{ title: "IT tickets — AIMS" }] }),
  validateSearch: searchSchema,
  component: ItTickets,
});

type Assigned = "me" | "anyone" | "unassigned";

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border bg-card p-0.5">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            value === v
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function ItTickets() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { user, canWriteDepartment } = useAuth();
  const canManage = canWriteDepartment("it");
  const ticketsQ = useTickets();
  const updateStatus = useUpdateTicketStatus();
  const update = useUpdateTicket();

  const view = search.view ?? "board";
  const [newOpen, setNewOpen] = useState(false);
  const [status, setStatus] = useState<TicketStatus | "all">("all");
  const [assigned, setAssigned] = useState<Assigned>("anyone");
  const [q, setQ] = useState("");

  const setSearch = (patch: Partial<z.infer<typeof searchSchema>>) =>
    navigate({
      search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, ...patch }),
      replace: true,
    });

  // ?new=1 opens the form once, then drops the flag.
  useEffect(() => {
    if (search.new !== 1) return;
    if (canManage) setNewOpen(true);
    navigate({
      search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, new: undefined }),
      replace: true,
    });
  }, [search.new, canManage, navigate]);

  const tickets = useMemo(() => ticketsQ.data ?? [], [ticketsQ.data]);
  const mineCount = tickets.filter((t) => t.assigneeId && t.assigneeId === user?.id).length;
  const unassignedCount = tickets.filter((t) => !t.assigneeId).length;

  const systemFilter = search.system;
  const systemName = useItSystems().data?.find((s) => s.id === systemFilter)?.name;
  const statusFilter = view === "list" ? status : "all";
  const needle = q.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      tickets.filter(
        (t) =>
          (statusFilter === "all" || t.status === statusFilter) &&
          (!systemFilter || t.systemId === systemFilter) &&
          (assigned === "anyone" ||
            (assigned === "me" ? t.assigneeId === user?.id : !t.assigneeId)) &&
          (!needle ||
            t.title.toLowerCase().includes(needle) ||
            (t.description ?? "").toLowerCase().includes(needle) ||
            personName(t.requester, "").toLowerCase().includes(needle) ||
            (t.system?.name ?? "").toLowerCase().includes(needle)),
      ),
    [tickets, statusFilter, systemFilter, assigned, needle, user?.id],
  );
  const isFiltered = statusFilter !== "all" || assigned !== "anyone" || !!needle || !!systemFilter;
  const clearFilters = () => {
    setStatus("all");
    setAssigned("anyone");
    setQ("");
    setSearch({ system: undefined });
  };

  const actions = {
    canManage,
    currentUserId: user?.id,
    onOpen: (t: TicketRow) => setSearch({ ticket: t.id }),
    onMove: (t: TicketRow, next: TicketStatus) =>
      updateStatus.mutate(
        { id: t.id, status: next },
        {
          onSuccess: () => toast.success(`"${t.title}" moved to ${TICKET_STATUS_LABELS[next]}`),
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Couldn't move the ticket"),
        },
      ),
    onAssignToMe: (t: TicketRow) =>
      user &&
      update.mutate(
        { id: t.id, assigneeId: user.id },
        {
          onSuccess: () => toast.success(`"${t.title}" assigned to you`),
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Couldn't assign the ticket"),
        },
      ),
  };

  const newTicketButton = (
    <Button onClick={() => setNewOpen(true)}>
      <Plus className="mr-1 h-4 w-4" /> New ticket
    </Button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="IT tickets"
        description="Problems staff and clients report to IT. Open a ticket to reply, assign it or move it along."
        actions={
          canManage ? (
            newTicketButton
          ) : (
            <Button asChild>
              <Link to="/it-help" search={{ new: 1 }}>
                <LifeBuoy className="mr-1 h-4 w-4" /> Ask IT for help
              </Link>
            </Button>
          )
        }
      />

      {!canManage && (
        <ViewOnlyBanner area="your IT tickets" action="move, assign or delete tickets" />
      )}

      {ticketsQ.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading tickets" />
        </div>
      ) : ticketsQ.isError ? (
        <LoadError what="tickets" error={ticketsQ.error} onRetry={() => ticketsQ.refetch()} />
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-card py-12 text-sm text-muted-foreground">
          <span>No tickets yet</span>
          {canManage && newTicketButton}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label="View"
              value={view}
              onChange={(v) => setSearch({ view: v })}
              options={[
                ["board", "Board"],
                ["list", "List"],
              ]}
            />
            <div className="relative w-full sm:w-64">
              <Search
                className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search tickets"
                className="pl-8"
                aria-label="Search tickets by title, details, person or system"
              />
            </div>
            <Segmented<Assigned>
              label="Assigned to"
              value={assigned}
              onChange={setAssigned}
              options={[
                ["me", `Me (${mineCount})`],
                ["anyone", "Anyone"],
                ["unassigned", `Not assigned (${unassignedCount})`],
              ]}
            />
            {view === "list" && (
              <Select value={status} onValueChange={(v) => setStatus(v as TicketStatus | "all")}>
                <SelectTrigger className="h-9 w-40" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {TICKET_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {TICKET_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {systemFilter && (
              <Badge variant="secondary" className="gap-1 py-1 font-normal">
                {systemName ?? "One system or site"}
                <button
                  type="button"
                  aria-label="Show tickets for every system"
                  onClick={() => setSearch({ system: undefined })}
                  className="rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {isFiltered && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border bg-card py-12 text-sm text-muted-foreground">
              <span>No matches</span>
              <Button size="sm" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : view === "list" ? (
            <TicketList tickets={filtered} {...actions} />
          ) : (
            <TicketBoard tickets={filtered} {...actions} />
          )}
        </>
      )}

      <TicketFormDialog
        open={newOpen}
        mode="new"
        onClose={() => setNewOpen(false)}
        onSaved={(id) => setSearch({ ticket: id })}
      />
      <TicketDetailSheet
        ticketId={search.ticket ?? null}
        onClose={() => setSearch({ ticket: undefined })}
      />
    </div>
  );
}
