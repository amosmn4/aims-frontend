import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export type NotificationType =
  | "task_due"
  | "project_alert"
  | "contract_expiry"
  | "invoice_overdue"
  | "tender_deadline"
  | "meeting"
  | "reminder";

export type NotificationSeverity = "info" | "warning" | "critical";

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  task_due: "Task due",
  project_alert: "Project alert",
  contract_expiry: "Contract expiry",
  invoice_overdue: "Invoice overdue",
  tender_deadline: "Tender deadline",
  meeting: "Meeting",
  reminder: "Reminder",
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
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await apiJson<BackendNotification[]>("/notifications")).map(mapNotification),
    refetchInterval: 60_000,
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => apiJson<number>("/notifications/unread-count"),
    refetchInterval: 60_000,
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
