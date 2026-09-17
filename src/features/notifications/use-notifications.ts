import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { apiJson } from "@/lib/api-client";
import { useIsIdle } from "@/hooks/use-idle";

// Idle tabs stop polling so they don't keep the session alive forever.
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
  | "client_request_assigned"
  | "report_submitted"
  | "report_reviewed"
  | "report_comment"
  | "report_due"
  | "comment_reply"
  | "ticket_update";

export type NotificationSeverity = "info" | "warning" | "critical";

/** Words for severity so it never relies on colour alone. */
export const NOTIFICATION_SEVERITY_LABELS: Record<NotificationSeverity, string | null> = {
  info: null,
  warning: "Needs attention",
  critical: "Urgent",
};

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
  report_submitted: "Report submitted",
  report_reviewed: "Report reviewed",
  report_comment: "Report message",
  report_due: "Report due",
  comment_reply: "Reply",
  ticket_update: "IT request",
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
  const id = row.resource_id;
  const isReply = (row.type as string) === "comment_reply";
  switch (row.resource_type) {
    case "task":
    case "ticket":
      return null; // Needs a lookup; see resolveNotificationLink.
    case "document":
      return "/documents";
    case "project":
      return isReply ? `/projects/${id}?view=comms` : `/projects/${id}`;
    case "contract":
      return `/clients/contracts/${id}`;
    case "invoice": {
      // Follow-up replies live on Debtors; other invoice alerts open the invoice list.
      if (isReply) return "/finance/debtors";
      const invoiceNumber = row.title.match(/invoice (\S+)/i)?.[1];
      return invoiceNumber
        ? `/finance/invoices?q=${encodeURIComponent(invoiceNumber)}`
        : "/finance/invoices";
    }
    case "lead":
      return "/marketing/leads";
    case "tender":
      return isReply ? `/tender/${id}?tab=activity` : `/tender/${id}`;
    case "client_request":
      return `/requests/${id}`;
    case "department_report":
      return `/department-reports/${id}`;
    case "finance_report":
      return `/finance/reports/${id}`;
    case "department_reports":
      return `/${id}/reports`;
    case "reports_inbox":
      return "/reports";
    default:
      return null;
  }
}

// Tasks open their project's task list; tickets open where the viewer works on them.
export async function resolveNotificationLink(row: NotificationRow): Promise<string | null> {
  const id = row.resource_id;
  if (row.resource_type === "task" && id) {
    const task = await apiJson<{ projectId: string | null }>(`/tasks/${id}`);
    return task.projectId ? `/projects/${task.projectId}?view=tasks` : null;
  }
  if (row.resource_type === "ticket" && id) {
    const ticket = await apiJson<{ canManage?: boolean }>(`/tickets/${id}`);
    const ticketParam = `ticket=${encodeURIComponent(id)}`;
    return ticket.canManage ? `/it/tickets?${ticketParam}` : `/it-help?${ticketParam}`;
  }
  return notificationLink(row);
}

/** Whether a notification points at something that can be opened. */
export function hasNotificationLink(row: NotificationRow): boolean {
  if (row.resource_type === "task" || row.resource_type === "ticket") return !!row.resource_id;
  return notificationLink(row) !== null;
}

/** Marks a notification read, then opens the record it's about. */
export function useOpenNotification(onOpened?: () => void) {
  const navigate = useNavigate();
  const markRead = useMarkNotificationRead();
  return async (row: NotificationRow) => {
    if (!row.is_read) markRead.mutate(row.id);
    let link: string | null;
    try {
      link = await resolveNotificationLink(row);
    } catch {
      toast.error("This item is no longer available.");
      return;
    }
    if (!link) {
      toast.info("This item has no page to open.");
      return;
    }
    onOpened?.();
    // Links may carry a query string (e.g. ?view=tasks), so navigate by href.
    navigate({ href: link });
  };
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
