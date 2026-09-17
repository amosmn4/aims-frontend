import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format-date";
import {
  hasNotificationLink,
  NOTIFICATION_SEVERITY_LABELS,
  NOTIFICATION_TYPE_LABELS,
  type NotificationRow,
} from "@/features/notifications/use-notifications";

const SEVERITY_BADGE = {
  info: "",
  warning: "bg-warning/15 text-warning",
  critical: "bg-destructive/10 text-destructive",
} as const;

/** One notification: unread shows a dot, bold title and "Unread" for screen readers. */
export function NotificationItem({
  row,
  onOpen,
  onDismiss,
  onMarkRead,
  size = "compact",
}: {
  row: NotificationRow;
  onOpen: (row: NotificationRow) => void;
  onDismiss: (row: NotificationRow) => void;
  onMarkRead?: (row: NotificationRow) => void;
  size?: "compact" | "full";
}) {
  const unread = !row.is_read;
  const severity = NOTIFICATION_SEVERITY_LABELS[row.severity];
  const openable = hasNotificationLink(row);

  const body = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 h-2 w-2 rounded-full shrink-0",
          unread ? "bg-primary" : "border border-muted-foreground/40",
        )}
      />
      <span className="flex-1 min-w-0">
        <span
          className={cn(
            "block leading-snug",
            size === "full" ? "text-sm" : "text-[0.8125rem]",
            unread ? "font-semibold text-foreground" : "font-normal text-foreground/85",
          )}
        >
          {unread && <span className="sr-only">Unread: </span>}
          {row.title}
        </span>
        {row.body && (
          <span
            className={cn(
              "block text-xs text-muted-foreground mt-0.5",
              size === "compact" && "line-clamp-2",
            )}
          >
            {row.body}
          </span>
        )}
        <span className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-muted-foreground">
          {severity && (
            <span
              className={cn(
                "rounded px-1.5 py-px text-[0.6875rem] font-medium",
                SEVERITY_BADGE[row.severity],
              )}
            >
              {severity}
            </span>
          )}
          <span>{NOTIFICATION_TYPE_LABELS[row.type] ?? "Update"}</span>
          <span aria-hidden="true">·</span>
          <span>{formatRelative(row.created_at)}</span>
        </span>
      </span>
    </>
  );

  return (
    <li
      className={cn(
        "flex items-start gap-1 pr-1.5",
        unread ? "bg-primary/5" : "",
        openable && "hover:bg-secondary/50",
      )}
    >
      {openable ? (
        <button
          type="button"
          className="flex flex-1 min-w-0 items-start gap-2.5 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          onClick={() => onOpen(row)}
        >
          {body}
        </button>
      ) : (
        <div className="flex flex-1 min-w-0 items-start gap-2.5 px-3 py-2.5">{body}</div>
      )}
      <div className="mt-2 flex shrink-0 items-center gap-0.5">
        {unread && onMarkRead && (
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onMarkRead(row)}
            title="Mark as read"
            aria-label={`Mark as read: ${row.title}`}
          >
            <Check className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onDismiss(row)}
          title="Dismiss notification"
          aria-label={`Dismiss notification: ${row.title}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
