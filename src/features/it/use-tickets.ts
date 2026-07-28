import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketSource = "internal" | "hrms_client";

export const TICKET_STATUSES: TicketStatus[] = ["open", "in_progress", "resolved", "closed"];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const TICKET_PRIORITY_STYLES: Record<TicketPriority, string> = {
  low: "bg-secondary text-secondary-foreground",
  medium: "bg-primary/10 text-primary",
  high: "bg-warning/15 text-warning",
  urgent: "bg-destructive/15 text-destructive",
};

export const TICKET_SOURCE_LABELS: Record<TicketSource, string> = {
  internal: "Internal",
  hrms_client: "HRMS Client",
};

type UserRef = { id: string; fullName: string | null; email: string } | null;

export interface TicketRow {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  source: TicketSource;
  system: { id: string; name: string } | null;
  requester: UserRef;
  assignee: UserRef;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketFilters {
  status?: TicketStatus;
}

function buildQuery(filters: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/* ---------- Queries ---------- */

export function useTickets(filters: TicketFilters = {}) {
  return useQuery({
    queryKey: ["tickets", filters],
    queryFn: () => apiJson<TicketRow[]>(`/tickets${buildQuery(filters)}`),
  });
}

/* ---------- Mutations ---------- */

export function useSaveTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      title: string;
      description?: string;
      priority?: TicketPriority;
      source?: TicketSource;
    }) => {
      const body = {
        title: input.title,
        description: input.description || undefined,
        priority: input.priority || undefined,
        source: input.source || undefined,
      };
      if (input.id) {
        await apiJson(`/tickets/${input.id}`, { method: "PATCH", body: JSON.stringify(body) });
        return input.id;
      }
      const created = await apiJson<TicketRow>("/tickets", { method: "POST", body: JSON.stringify(body) });
      return created.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });
}

export function useUpdateTicketStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: TicketStatus }) =>
      apiJson<TicketRow>(`/tickets/${input.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: input.status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });
}

export function useDeleteTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiJson(`/tickets/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });
}
