import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Loader2 } from "lucide-react";
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDismissNotification,
  notificationLink,
  NOTIFICATION_TYPE_LABELS,
  type NotificationRow,
  type NotificationSeverity,
} from "@/features/notifications/use-notifications";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

const SEVERITY_DOT: Record<NotificationSeverity, string> = {
  info: "bg-primary",
  warning: "bg-warning",
  critical: "bg-destructive",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const unreadQ = useUnreadNotificationCount();
  const listQ = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const dismiss = useDismissNotification();

  const unread = unreadQ.data ?? 0;

  const handleClick = (row: NotificationRow) => {
    if (!row.is_read) markRead.mutate(row.id);
    const link = notificationLink(row);
    if (link) {
      setOpen(false);
      navigate({ to: link });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex items-center justify-center h-8 w-8 rounded-full text-sidebar-foreground hover:bg-white/10"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[0.625rem] font-semibold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b">
          <div className="text-sm font-semibold">Notifications</div>
          {unread > 0 && (
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => markAllRead.mutate()}
            >
              Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {listQ.isLoading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (listQ.data ?? []).length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              You're all caught up — nothing needs attention.
            </div>
          ) : (
            <div className="divide-y">
              {(listQ.data ?? []).map((row) => (
                <div
                  key={row.id}
                  className={`group flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-secondary/40 ${
                    row.is_read ? "" : "bg-primary/3"
                  }`}
                  onClick={() => handleClick(row)}
                >
                  <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${SEVERITY_DOT[row.severity]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs font-medium leading-snug">{row.title}</div>
                      <button
                        className="opacity-0 group-hover:opacity-100 text-[0.6875rem] text-muted-foreground hover:text-destructive shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismiss.mutate(row.id);
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                    {row.body && (
                      <div className="text-[0.6875rem] text-muted-foreground mt-0.5 line-clamp-2">{row.body}</div>
                    )}
                    <div className="flex items-center gap-1.5 mt-1 text-[0.625rem] text-muted-foreground">
                      <span>{NOTIFICATION_TYPE_LABELS[row.type]}</span>
                      <span>·</span>
                      <span>{timeAgo(row.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
