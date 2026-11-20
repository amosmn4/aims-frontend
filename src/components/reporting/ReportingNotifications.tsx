import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import NotificationsNoneOutlined from "@mui/icons-material/NotificationsNoneOutlined";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWeekly, weeklyTime } from "@/lib/weekly";
import { api } from "@/lib/api";
import { perform } from "@/lib/workspace";

export function ReportingNotifications() {
  const query =
    useWeekly<
      { id: string; title: string; body: string | null; isRead: boolean; createdAt: string }[]
    >("notifications");
  const client = useQueryClient();
  const unread = query.data?.filter((item) => !item.isRead).length ?? 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="report-notification-button"
          aria-label={`Reporting notifications${unread ? `, ${unread} unread` : ""}`}
        >
          <NotificationsNoneOutlined fontSize="small" />
          {unread > 0 && <span>{unread}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-96 overflow-y-auto">
        <strong>Reporting notifications</strong>
        {query.error && <p role="alert">{query.error.message}</p>}
        {query.data?.map((item) => (
          <div className="my-3 border-b pb-3 text-xs" key={item.id}>
            <p className="font-semibold">{item.title}</p>
            <p className="my-1 whitespace-pre-wrap">{item.body}</p>
            <p className="text-muted-foreground">{weeklyTime(item.createdAt)}</p>
            {!item.isRead && (
              <button
                className="mt-2 text-primary underline"
                onClick={async () => {
                  if (
                    await perform(async () => {
                      await api(`/weekly/notifications/${item.id}/read`, { method: "POST" });
                    })
                  )
                    await client.invalidateQueries({ queryKey: ["weekly"] });
                }}
              >
                Mark read
              </button>
            )}
          </div>
        ))}
        {query.data && !query.data.length && (
          <p className="my-3 text-xs text-muted-foreground">No reporting notifications yet.</p>
        )}
        <Link
          to="/reporting"
          search={{ view: "submissions" }}
          className="text-xs text-primary underline"
        >
          Open submissions
        </Link>
      </PopoverContent>
    </Popover>
  );
}
