import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketSource = "internal" | "hrms_client";

export const TICKET_STATUSES: TicketStatus[] = ["open", "in_progress", "resolved", "closed"];
export const TICKET_PRIORITIES: TicketPriority[] = ["low", "medium", "high", "urgent"];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

/** What each status means to the person who asked for help. */
export const TICKET_STATUS_HINTS: Record<TicketStatus, string> = {
  open: "Waiting for IT to start",
  in_progress: "IT is working on it",
  resolved: "IT says it's fixed",
  closed: "Finished",
};

export const TICKET_STATUS_STYLES: Record<TicketStatus, string> = {
  open: "bg-primary/10 text-primary",
  in_progress: "bg-warning/15 text-warning",
  resolved: "bg-success/15 text-success",
  closed: "bg-secondary text-secondary-foreground",
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

/** Plain descriptions for "How urgent?". */
export const TICKET_PRIORITY_HINTS: Record<TicketPriority, string> = {
  low: "It's annoying, but I can still work",
  medium: "It slows my work down",
  high: "I can't do an important part of my job",
  urgent: "I can't work at all, or many people are affected",
};

export const TICKET_PRIORITY_STYLES: Record<TicketPriority, string> = {
  low: "bg-secondary text-secondary-foreground",
  medium: "bg-primary/10 text-primary",
  high: "bg-warning/15 text-warning",
  urgent: "bg-destructive/15 text-destructive",
};

export const TICKET_SOURCE_LABELS: Record<TicketSource, string> = {
  internal: "Internal",
  hrms_client: "HRMS client",
};

export type TicketUserRef = { id: string; fullName: string | null; email: string };

export interface TicketRow {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  source: TicketSource;
  systemId: string | null;
  system: { id: string; name: string } | null;
  requesterId: string | null;
  requester: TicketUserRef | null;
  assigneeId: string | null;
  assignee: TicketUserRef | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt?: string;
  _count?: { comments: number };
}

export interface TicketDetail extends TicketRow {
  canManage: boolean;
  canEditDetails: boolean;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  author: TicketUserRef | null;
  body: string;
  parentId: string | null;
  createdAt: string;
}

export interface TicketFilters {
  status?: TicketStatus;
  assigneeId?: string;
  mine?: boolean;
  q?: string;
}

export const personName = (u: TicketUserRef | null | undefined, fallback = "Someone") =>
  u?.fullName || u?.email || fallback;

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
    queryKey: ["tickets", "list", filters],
    queryFn: () => apiJson<TicketRow[]>(`/tickets${buildQuery(filters)}`),
  });
}

export function useTicket(id: string | null | undefined) {
  return useQuery({
    queryKey: ["tickets", "detail", id],
    enabled: !!id,
    retry: false,
    queryFn: () => apiJson<TicketDetail>(`/tickets/${id}`),
  });
}

export function useTicketComments(id: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["tickets", "comments", id],
    enabled: !!id && enabled,
    queryFn: () => apiJson<TicketComment[]>(`/tickets/${id}/comments`),
  });
}

/** Active staff for the "Assign to" picker. */
export function useTicketStaff(enabled = true) {
  return useQuery({
    queryKey: ["users", "lite"],
    enabled,
    queryFn: () => apiJson<TicketUserRef[]>("/users/lite"),
  });
}

/* ---------- Mutations ---------- */

export interface TicketInput {
  title: string;
  description?: string;
  priority?: TicketPriority;
  systemId?: string | null;
  assigneeId?: string | null;
  requesterId?: string;
  source?: TicketSource;
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TicketInput) =>
      apiJson<TicketRow>("/tickets", {
        method: "POST",
        body: JSON.stringify({
          title: input.title,
          description: input.description || undefined,
          priority: input.priority,
          systemId: input.systemId || undefined,
          assigneeId: input.assigneeId || undefined,
          requesterId: input.requesterId || undefined,
          source: input.source,
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });
}

/** Sends only the fields given; null clears system or assignee. */
export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<TicketInput> & { id: string }) =>
      apiJson<TicketRow>(`/tickets/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
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
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: ["tickets", "detail", id] });
      return qc.invalidateQueries({ queryKey: ["tickets", "list"] });
    },
  });
}

export function useAddTicketComment(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; parentId?: string }) =>
      apiJson<TicketComment>(`/tickets/${ticketId}/comments`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });
}

export function useDeleteTicketComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      await apiJson(`/tickets/comments/${commentId}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });
}
