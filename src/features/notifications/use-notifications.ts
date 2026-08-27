import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import { useIsIdle } from "@/hooks/use-idle";

// Pause background polling after 5 minutes with no real interaction — well under the session's
// own idle timeout, so a tab left open-but-unused stops manufacturing "activity" that would
// otherwise keep silently renewing the session forever. See hooks/use-idle.ts.
const IDLE_POLL_PAUSE_MS = 5 * 60_000;

export type NotificationType =
  | "task_due"
  | "project_alert"
  | "contract_expiry"
  | "invoice_overdue"
  | "tender_deadline"
  | "meeting"
  | "reminder"
  | "task_assigned"
  | "project_shared"
  | "document_shared"
  | "task_comment"
  | "client_request_assigned";

export type NotificationSeverity = "info" | "warning" | "critical";

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  task_due: "Task due",
  project_alert: "Project alert",
  contract_expiry: "Contract expiry",
  invoice_overdue: "Invoice overdue",
  tender_deadline: "Tender deadline",
  meeting: "Meeting",
  reminder: "Reminder",
  task_assigned: "Task assigned",
  project_shared: "Project shared",
  document_shared: "Document shared",
  task_comment: "Task comment",
  client_request_assigned: "Client request assigned",
};

export interface NotificationRow {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  resource_type: string | null;
  resource_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

type BackendNotification = {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  resourceType: string | null;
  resourceId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

function mapNotification(n: BackendNotification): NotificationRow {
  return {
    id: n.id,
    type: n.type,
    severity: n.severity,
    title: n.title,
    body: n.body,
    resource_type: n.resourceType,
    resource_id: n.resourceId,
    is_read: n.isRead,
    read_at: n.readAt,
    created_at: n.createdAt,
  };
}

export function useNotifications() {
  const isIdle = useIsIdle(IDLE_POLL_PAUSE_MS);
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () =>
      (await apiJson<BackendNotification[]>("/notifications")).map(mapNotification),
    refetchInterval: isIdle ? false : 60_000,
  });
}

export function useUnreadNotificationCount() {
  const isIdle = useIsIdle(IDLE_POLL_PAUSE_MS);
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => apiJson<number>("/notifications/unread-count"),
    refetchInterval: isIdle ? false : 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiJson(`/notifications/${id}/read`, { method: "PATCH" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiJson("/notifications/read-all", { method: "PATCH" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useDismissNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiJson(`/notifications/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useCreateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      type: "meeting" | "reminder";
      title: string;
      body?: string;
      user_id?: string;
      resource_type?: string;
      resource_id?: string;
    }) => {
      await apiJson("/notifications", {
        method: "POST",
        body: JSON.stringify({
          type: input.type,
          title: input.title,
          body: input.body,
          userId: input.user_id,
          resourceType: input.resource_type,
          resourceId: input.resource_id,
        }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

// Resource-type -> route, so a notification click navigates straight to the record it's about.
export function notificationLink(row: NotificationRow): string | null {
  if (!row.resource_type || !row.resource_id) return null;
  switch (row.resource_type) {
    case "task":
      return null; // tasks are opened from within their project; no standalone route
    case "project":
      return `/projects/${row.resource_id}`;
    case "contract":
      return `/clients/contracts/${row.resource_id}`;
    case "invoice":
      return `/finance/invoices`;
    case "tender":
      return `/tender/${row.resource_id}`;
    case "client_request":
      return `/requests/${row.resource_id}`;
    default:
      return null;
  }
}

/* ---------- Preferences ---------- */

export interface NotificationPreferences {
  task_updates: boolean;
  project_updates: boolean;
  finance_alerts: boolean;
  tender_alerts: boolean;
  reminders_meetings: boolean;
  email_digest: boolean;
}

type BackendNotificationPreferences = {
  taskUpdates: boolean;
  projectUpdates: boolean;
  financeAlerts: boolean;
  tenderAlerts: boolean;
  remindersMeetings: boolean;
  emailDigest: boolean;
};

function mapPreferences(p: BackendNotificationPreferences): NotificationPreferences {
  return {
    task_updates: p.taskUpdates,
    project_updates: p.projectUpdates,
    finance_alerts: p.financeAlerts,
    tender_alerts: p.tenderAlerts,
    reminders_meetings: p.remindersMeetings,
    email_digest: p.emailDigest,
  };
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: async () =>
      mapPreferences(await apiJson<BackendNotificationPreferences>("/notifications/preferences")),
  });
}

export function useSaveNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<NotificationPreferences>) =>
      apiJson("/notifications/preferences", {
        method: "PUT",
        body: JSON.stringify({
          taskUpdates: input.task_updates,
          projectUpdates: input.project_updates,
          financeAlerts: input.finance_alerts,
          tenderAlerts: input.tender_alerts,
          remindersMeetings: input.reminders_meetings,
          emailDigest: input.email_digest,
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", "preferences"] }),
  });
}
