import { useState, type KeyboardEvent, type SyntheticEvent } from "react";
import { MessageSquare, MoreHorizontal } from "lucide-react";
import { formatRelative } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import {
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  personName,
  type TicketRow,
  type TicketStatus,
} from "@/features/it/use-tickets";
import { TicketPriorityBadge } from "./ticket-badges";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const COLUMN_ACCENTS: Record<TicketStatus, string> = {
  open: "border-t-primary",
  in_progress: "border-t-warning",
  resolved: "border-t-success",
  closed: "border-t-muted-foreground/40",
};

const stop = (e: SyntheticEvent) => e.stopPropagation();

export interface TicketActions {
  canManage: boolean;
  currentUserId?: string;
  onOpen: (ticket: TicketRow) => void;
  onMove: (ticket: TicketRow, status: TicketStatus) => void;
  onAssignToMe: (ticket: TicketRow) => void;
}

/** Status columns; cards open on click or Enter, move by menu or (for IT) by drag. */
export function TicketBoard({ tickets, ...actions }: { tickets: TicketRow[] } & TicketActions) {
  const { canManage, onMove } = actions;
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TicketStatus | null>(null);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {TICKET_STATUSES.map((status) => {
        const column = tickets.filter((t) => t.status === status);
        return (
          <section
            key={status}
            aria-label={`${TICKET_STATUS_LABELS[status]}: ${column.length} tickets`}
            className={cn(
              "min-h-[160px] rounded-lg border border-t-4 bg-muted/30 p-2",
              COLUMN_ACCENTS[status],
              dragOver === status && "ring-2 ring-primary/40",
            )}
            onDragOver={(e) => {
              if (!canManage) return;
              e.preventDefault();
              setDragOver(status);
            }}
            onDragLeave={() => setDragOver((cur) => (cur === status ? null : cur))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const ticket = tickets.find((t) => t.id === dragId);
              if (ticket && ticket.status !== status) onMove(ticket, status);
              setDragId(null);
            }}
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <h2 className="text-sm font-semibold">{TICKET_STATUS_LABELS[status]}</h2>
              <span
                className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground"
                aria-hidden="true"
              >
                {column.length}
              </span>
            </div>
            <div className="space-y-2">
              {column.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">No tickets</p>
              ) : (
                column.map((t) => (
                  <TicketCard
                    key={t.id}
                    ticket={t}
                    dragging={dragId === t.id}
                    onDragStart={() => setDragId(t.id)}
                    onDragEnd={() => setDragId(null)}
                    {...actions}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TicketCard({
  ticket: t,
  dragging,
  onDragStart,
  onDragEnd,
  canManage,
  currentUserId,
  onOpen,
  onMove,
  onAssignToMe,
}: {
  ticket: TicketRow;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
} & TicketActions) {
  const messages = t._count?.comments ?? 0;
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(t);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ticket: ${t.title}`}
      draggable={canManage}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(t)}
      onKeyDown={onKeyDown}
      className={cn(
        "cursor-pointer rounded-lg border bg-card p-2.5 shadow-sm transition-shadow hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        dragging && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{t.title}</p>
        {canManage && (
          <div onClick={stop} onKeyDown={stop} onMouseDown={stop}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="-mr-1 -mt-1 h-7 w-7 shrink-0"
                  aria-label={`Actions for ticket: ${t.title}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={stop} className="w-48">
                <DropdownMenuItem onSelect={() => onOpen(t)}>Open ticket</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Move to…
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={t.status}
                  onValueChange={(v) => v !== t.status && onMove(t, v as TicketStatus)}
                >
                  {TICKET_STATUSES.map((s) => (
                    <DropdownMenuRadioItem key={s} value={s}>
                      {TICKET_STATUS_LABELS[s]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                {currentUserId && t.assigneeId !== currentUserId && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => onAssignToMe(t)}>
                      Assign ticket to me
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {personName(t.requester, "Unknown")} · {formatRelative(t.createdAt)}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <TicketPriorityBadge priority={t.priority} />
        {messages > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            {messages} {messages === 1 ? "message" : "messages"}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-xs">
        {t.assignee ? (
          <>
            <span className="text-muted-foreground">Assigned to </span>
            {t.assigneeId === currentUserId ? "you" : personName(t.assignee)}
          </>
        ) : (
          <span className="text-muted-foreground">Not assigned</span>
        )}
      </p>
    </div>
  );
}
