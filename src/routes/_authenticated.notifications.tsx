import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, BellOff, CheckCheck, Loader2, Settings2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, homeRouteFor } from "@/lib/auth";
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useDismissNotification,
  useOpenNotification,
  type NotificationRow,
} from "@/features/notifications/use-notifications";
import { NotificationItem } from "@/features/notifications/notification-item";

type Tab = "unread" | "all";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [{ title: "Notifications — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: z.object({ tab: z.enum(["unread", "all"]).optional().catch(undefined) }),
  component: NotificationsPage,
});

// The API returns the newest 100.
const LIST_LIMIT = 100;

function NotificationsPage() {
  const { tab: tabParam } = Route.useSearch();
  const tab: Tab = tabParam ?? "unread";
  const navigate = Route.useNavigate();
  const { roles } = useAuth();
  const listQ = useNotifications();
  const unreadQ = useUnreadNotificationCount();
  const markAllRead = useMarkAllNotificationsRead();
  const markRead = useMarkNotificationRead();
  const dismiss = useDismissNotification();
  const openNotification = useOpenNotification();

  const all = listQ.data ?? [];
  const unreadRows = all.filter((r) => !r.is_read);
  const unreadCount = unreadQ.data ?? unreadRows.length;

  const setTab = (next: Tab) => navigate({ search: { tab: next }, replace: true });

  const handleMarkAll = () =>
    markAllRead.mutate(undefined, {
      onSuccess: () => toast.success("All notifications marked as read"),
      onError: () => toast.error("Couldn't mark notifications as read. Try again."),
    });

  const renderList = (rows: NotificationRow[], which: Tab) => {
    if (listQ.isLoading) {
      return (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      );
    }
    if (listQ.isError) {
      return <LoadError what="notifications" error={listQ.error} onRetry={() => listQ.refetch()} />;
    }
    if (rows.length === 0) {
      return which === "unread" && all.length > 0 ? (
        <EmptyState
          title="No unread notifications"
          text="You're all caught up."
          action={
            <Button size="sm" variant="outline" onClick={() => setTab("all")}>
              Show all notifications
            </Button>
          }
        />
      ) : (
        <EmptyState
          title="No notifications yet"
          text="You'll see updates here when you're given a task, a project is shared with you, or a deadline is near."
          action={
            <Button size="sm" variant="outline" asChild>
              <Link to="/settings/notifications">
                <Settings2 className="h-4 w-4 mr-1" /> Choose what you're told about
              </Link>
            </Button>
          }
        />
      );
    }
    return (
      <>
        <ul className="divide-y rounded-lg border bg-card overflow-hidden">
          {rows.map((row) => (
            <NotificationItem
              key={row.id}
              row={row}
              size="full"
              onOpen={(r) => void openNotification(r)}
              onMarkRead={(r) =>
                markRead.mutate(r.id, {
                  onError: () => toast.error("Couldn't mark that notification as read. Try again."),
                })
              }
              onDismiss={(r) =>
                dismiss.mutate(r.id, {
                  onError: () => toast.error("Couldn't dismiss that notification. Try again."),
                })
              }
            />
          ))}
        </ul>
        {which === "all" && all.length >= LIST_LIMIT && (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing your {LIST_LIMIT} most recent notifications.
          </p>
        )}
      </>
    );
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to={homeRouteFor(roles)}
        className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" aria-hidden="true" /> Back to home
      </Link>
      <PageHeader
        title="Notifications"
        description="Updates about your tasks, projects, client requests and deadlines. Select one to open it."
        actions={
          <>
            <Button size="sm" variant="outline" asChild>
              <Link to="/settings/notifications">
                <Settings2 className="h-4 w-4 mr-1" /> Notification settings
              </Link>
            </Button>
            <Button
              size="sm"
              onClick={handleMarkAll}
              disabled={unreadCount === 0 || markAllRead.isPending || listQ.isError}
            >
              {markAllRead.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4 mr-1" />
              )}
              Mark all as read
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="unread">
            Unread{unreadCount > 0 ? ` (${unreadCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value="unread" className="mt-3">
          {renderList(unreadRows, "unread")}
        </TabsContent>
        <TabsContent value="all" className="mt-3">
          {renderList(all, "all")}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border bg-card px-6 py-12 text-center">
      <BellOff className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-md text-xs text-muted-foreground">{text}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
