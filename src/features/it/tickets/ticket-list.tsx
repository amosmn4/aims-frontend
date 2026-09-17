import { useEffect, useState } from "react";
import { formatDate, formatDateTime } from "@/lib/format-date";
import {
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  personName,
  type TicketRow,
  type TicketStatus,
} from "@/features/it/use-tickets";
import { TicketPriorityBadge, TicketStatusBadge } from "./ticket-badges";
import type { TicketActions } from "./ticket-board";
import { PaginationBar } from "@/components/pagination-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Table of tickets, newest first; IT can change status in the row. */
export function TicketList({
  tickets,
  canManage,
  currentUserId,
  onOpen,
  onMove,
}: { tickets: TicketRow[] } & TicketActions) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const lastPage = Math.max(1, Math.ceil(tickets.length / pageSize));
  useEffect(() => {
    if (page > lastPage) setPage(lastPage);
  }, [page, lastPage]);
  const rows = tickets.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">Ticket</TableHead>
              <TableHead className="min-w-[140px]">Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assigned to</TableHead>
              <TableHead>System</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Messages</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => onOpen(t)}
                    className="text-left text-sm font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {t.title}
                  </button>
                  <div className="text-xs text-muted-foreground">
                    Asked by {personName(t.requester, "Unknown")}
                  </div>
                </TableCell>
                <TableCell>
                  {canManage ? (
                    <Select
                      value={t.status}
                      onValueChange={(v) => v !== t.status && onMove(t, v as TicketStatus)}
                    >
                      <SelectTrigger
                        className="h-8 w-36 text-xs"
                        aria-label={`Move ticket to another status: ${t.title}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TICKET_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {TICKET_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <TicketStatusBadge status={t.status} />
                  )}
                </TableCell>
                <TableCell>
                  <TicketPriorityBadge priority={t.priority} />
                </TableCell>
                <TableCell className="text-sm">
                  {t.assignee ? (
                    t.assigneeId === currentUserId ? (
                      "You"
                    ) : (
                      personName(t.assignee)
                    )
                  ) : (
                    <span className="text-muted-foreground">Not assigned</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {t.system?.name ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  <time dateTime={t.createdAt} title={formatDateTime(t.createdAt)}>
                    {formatDate(t.createdAt)}
                  </time>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {t._count?.comments ?? 0}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {tickets.length > 25 && (
        <PaginationBar
          page={page}
          pageSize={pageSize}
          total={tickets.length}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}
