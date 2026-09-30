import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkAllNotificationsRead,
  useDismissNotification,
  useOpenNotification,
} from "@/features/notifications/use-notifications";
import { NotificationItem } from "@/features/notifications/notification-item";
import { LoadError } from "@/components/load-error";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const unreadQ = useUnreadNotificationCount();
  const listQ = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();
  const dismiss = useDismissNotification();
  const openNotification = useOpenNotification(() => setOpen(false));

  const unread = unreadQ.data ?? 0;
  const rows = listQ.data ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative shrink-0 flex items-center justify-center h-8 w-8 rounded-full text-sidebar-foreground hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          title="Notifications"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[0.625rem] font-semibold flex items-center justify-center"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-1.5rem)] p-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b">
          <h2 className="text-sm font-semibold">Notifications</h2>
          {unread > 0 && (
            <button
              type="button"
              className="text-xs text-primary hover:underline disabled:opacity-50"
              disabled={markAllRead.isPending}
              onClick={() =>
                markAllRead.mutate(undefined, {
                  onError: () => toast.error("Couldn't mark notifications as read. Try again."),
                })
              }
            >
              Mark all as read
            </button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {listQ.isLoading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : listQ.isError ? (
            <LoadError
              what="notifications"
              error={listQ.error}
              onRetry={() => listQ.refetch()}
              className="m-3"
            />
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              You're all caught up. Nothing needs your attention.
            </div>
          ) : (
            <ul className="divide-y">
              {rows.slice(0, 20).map((row) => (
                <NotificationItem
                  key={row.id}
                  row={row}
                  onOpen={(r) => void openNotification(r)}
                  onDismiss={(r) =>
                    dismiss.mutate(r.id, {
                      onError: () => toast.error("Couldn't dismiss that notification. Try again."),
                    })
                  }
                />
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t px-3 py-2 text-center">
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="text-xs font-medium text-primary hover:underline"
          >
            See all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
