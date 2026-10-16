import { cn } from "@/lib/utils";
import {
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_STYLES,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_STYLES,
  type TicketPriority,
  type TicketStatus,
} from "@/features/it/use-tickets";

const PILL =
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

export function TicketStatusBadge({
  status,
  className,
}: {
  status: TicketStatus;
  className?: string;
}) {
  return (
    <span className={cn(PILL, TICKET_STATUS_STYLES[status], className)}>
      {TICKET_STATUS_LABELS[status]}
    </span>
  );
}

export function TicketPriorityBadge({
  priority,
  className,
}: {
  priority: TicketPriority;
  className?: string;
}) {
  return (
    <span className={cn(PILL, TICKET_PRIORITY_STYLES[priority], className)}>
      {TICKET_PRIORITY_LABELS[priority]} priority
    </span>
  );
}
