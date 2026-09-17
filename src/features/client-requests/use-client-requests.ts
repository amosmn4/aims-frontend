import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import type { PaginatedResponse } from "@/hooks/use-pagination";

export type ClientRequestStage =
  "new" | "assigned" | "engaging" | "proposal" | "won" | "lost" | "withdrawn";
export type ClientRequestSource = "operations" | "marketing" | "referral" | "website" | "other";
export type ClientRequestConversionType = "project" | "recurring_contract";
export type ClientRequestActivityType = "note" | "call" | "email" | "meeting";

export const CLIENT_REQUEST_STAGES: ClientRequestStage[] = [
  "new",
  "assigned",
  "engaging",
  "proposal",
  "won",
  "lost",
  "withdrawn",
];

export const CLIENT_REQUEST_STAGE_LABELS: Record<ClientRequestStage, string> = {
  new: "New Request",
  assigned: "Assigned to Dept",
  engaging: "Engagement",
  proposal: "Proposal Sent",
  won: "Won",
  lost: "Lost",
  withdrawn: "Withdrawn",
};

export const CLIENT_REQUEST_STAGE_STYLES: Record<ClientRequestStage, string> = {
  new: "bg-secondary text-secondary-foreground",
  assigned: "bg-primary/10 text-primary",
  engaging: "bg-warning/15 text-warning",
  proposal: "bg-accent/15 text-accent",
  won: "bg-success/15 text-success",
  lost: "bg-destructive/15 text-destructive",
  withdrawn: "bg-muted text-muted-foreground",
};

export const SOURCE_LABELS: Record<ClientRequestSource, string> = {
  operations: "Operations",
  marketing: "Marketing",
  referral: "Referral",
  website: "Website",
  other: "Other",
};

export const ACTIVITY_TYPE_LABELS: Record<ClientRequestActivityType, string> = {
  note: "Note",
  call: "Call",
  email: "Email",
  meeting: "Meeting",
};

export interface ClientRequestRow {
  id: string;
  reference_number: string | null;
  title: string;
  description: string | null;
  client_id: string | null;
  client_name: string | null;
  prospect_client_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  source: ClientRequestSource;
  service_line_id: string | null;
  service_line_name: string | null;
  department_id: string | null;
  department_name: string | null;
  department_code: string | null;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  stage: ClientRequestStage;
  estimated_value: number | null;
  currency: string;
  routed_at: string | null;
  engaged_at: string | null;
  converted_at: string | null;
  conversion_type: ClientRequestConversionType | null;
  lost_at: string | null;
  lost_from_stage: ClientRequestStage | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
  converted_project_id: string | null;
  converted_project_name: string | null;
  converted_contract_id: string | null;
  converted_contract_number: string | null;
  converted_from_lead_id: string | null;
  converted_from_lead_name: string | null;
}

export interface ClientRequestPipelineStage {
  stage: ClientRequestStage;
  /** How many requests currently sit in exactly this stage right now — for "needs attention". */
  count: number;
  total_value: number;
  /** How many requests have EVER reached at least this stage (pass-through funnel: never shrinks
   * as requests advance, only when one is deleted) — this is what the funnel chart should render,
   * not `count`. */
  cumulative_count: number;
  /** cumulative_count / previous stage's cumulative_count * 100 — null for the first stage. */
  conversion_pct: number | null;
}

export interface LostBreakdownEntry {
  stage: ClientRequestStage;
  count: number;
}

export interface ClientRequestActivityRow {
  id: string;
  request_id: string;
  type: ClientRequestActivityType;
  summary: string;
  occurred_at: string;
  created_by_id: string | null;
  created_by_name: string | null;
  created_at: string;
  /** The thread's first entry when this is a reply. */
  parent_id: string | null;
}

type BackendRequest = {
  id: string;
  referenceNumber: string | null;
  title: string;
  description: string | null;
  clientId: string | null;
  client?: { id: string; name: string } | null;
  prospectClientName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  source: ClientRequestSource;
  serviceLineId: string | null;
  serviceLine?: { id: string; name: string } | null;
  departmentId: string | null;
  department?: { id: string; name: string; code: string } | null;
  assignedToId: string | null;
  assignedTo?: { id: string; fullName: string | null; email: string } | null;
  stage: ClientRequestStage;
  estimatedValue: number | string | null;
  currency: string;
  routedAt: string | null;
  engagedAt: string | null;
  convertedAt: string | null;
  conversionType: ClientRequestConversionType | null;
  lostAt: string | null;
  lostFromStage: ClientRequestStage | null;
  lostReason: string | null;
  createdAt: string;
  updatedAt: string;
  convertedProject?: { id: string; name: string } | null;
  convertedContract?: { id: string; contractNumber: string } | null;
  convertedFromLead?: { id: string; name: string } | null;
};

function mapRequest(r: BackendRequest): ClientRequestRow {
  return {
    id: r.id,
    reference_number: r.referenceNumber,
    title: r.title,
    description: r.description,
    client_id: r.clientId,
    client_name: r.client?.name ?? null,
    prospect_client_name: r.prospectClientName,
    contact_name: r.contactName,
    contact_email: r.contactEmail,
    contact_phone: r.contactPhone,
    source: r.source,
    service_line_id: r.serviceLineId,
    service_line_name: r.serviceLine?.name ?? null,
    department_id: r.departmentId,
    department_name: r.department?.name ?? null,
    department_code: r.department?.code ?? null,
    assigned_to_id: r.assignedToId,
    assigned_to_name: r.assignedTo?.fullName ?? r.assignedTo?.email ?? null,
    stage: r.stage,
    estimated_value: r.estimatedValue != null ? Number(r.estimatedValue) : null,
    currency: r.currency,
    routed_at: r.routedAt,
    engaged_at: r.engagedAt,
    converted_at: r.convertedAt,
    conversion_type: r.conversionType,
    lost_at: r.lostAt,
    lost_from_stage: r.lostFromStage,
    lost_reason: r.lostReason,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
    converted_project_id: r.convertedProject?.id ?? null,
    converted_project_name: r.convertedProject?.name ?? null,
    converted_contract_id: r.convertedContract?.id ?? null,
    converted_contract_number: r.convertedContract?.contractNumber ?? null,
    converted_from_lead_id: r.convertedFromLead?.id ?? null,
    converted_from_lead_name: r.convertedFromLead?.name ?? null,
  };
}

type BackendActivity = {
  id: string;
  requestId: string;
  type: ClientRequestActivityType;
  summary: string;
  occurredAt: string;
  createdBy: string | null;
  creator?: { id: string; fullName: string | null; email: string } | null;
  parentId?: string | null;
  createdAt: string;
};

function mapActivity(a: BackendActivity): ClientRequestActivityRow {
  return {
    id: a.id,
    request_id: a.requestId,
    type: a.type,
    summary: a.summary,
    occurred_at: a.occurredAt,
    created_by_id: a.createdBy,
    created_by_name: a.creator?.fullName ?? a.creator?.email ?? null,
    created_at: a.createdAt,
    parent_id: a.parentId ?? null,
  };
}

export interface ClientRequestFilters {
  departmentId?: string;
  serviceLineId?: string;
  stage?: ClientRequestStage;
  source?: ClientRequestSource;
  clientId?: string;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
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

// See useTenders' matching overload comment (use-tender.ts) — same reasoning.
export function useClientRequests(
  filters?: ClientRequestFilters,
): UseQueryResult<ClientRequestRow[]>;
export function useClientRequests(
  filters: ClientRequestFilters,
  pagination: { page: number; pageSize: number },
): UseQueryResult<ClientRequestRow[] | PaginatedResponse<ClientRequestRow>>;
export function useClientRequests(
  filters: ClientRequestFilters = {},
  pagination: { page?: number; pageSize?: number } = {},
) {
  return useQuery({
    queryKey: ["client-requests", filters, pagination],
    queryFn: async () => {
      const raw = await apiJson<BackendRequest[] | PaginatedResponse<BackendRequest>>(
        `/client-requests${buildQuery({ ...filters, ...pagination })}`,
      );
      return Array.isArray(raw) ? raw.map(mapRequest) : { ...raw, data: raw.data.map(mapRequest) };
    },
  });
}

export function useClientRequest(id: string | undefined) {
  return useQuery({
    queryKey: ["client-requests", id],
    enabled: !!id,
    queryFn: async () => mapRequest(await apiJson<BackendRequest>(`/client-requests/${id}`)),
    // A missing or forbidden record won't appear on retry.
    retry: (count, err) =>
      ![403, 404].includes((err as { status?: number }).status ?? 0) && count < 3,
  });
}

export function useClientRequestPipelineSummary(
  filters: Pick<
    ClientRequestFilters,
    "departmentId" | "serviceLineId" | "dateFrom" | "dateTo"
  > = {},
) {
  return useQuery({
    queryKey: ["client-requests", "pipeline-summary", filters],
    queryFn: async () => {
      const raw = await apiJson<
        {
          stage: ClientRequestStage;
          count: number;
          totalValue: number;
          cumulativeCount: number;
          conversionPct: number | null;
        }[]
      >(`/client-requests/pipeline-summary${buildQuery(filters)}`);
      return raw.map((r): ClientRequestPipelineStage => ({
        stage: r.stage,
        count: r.count,
        total_value: r.totalValue,
        cumulative_count: r.cumulativeCount,
        conversion_pct: r.conversionPct,
      }));
    },
  });
}

export function useLostBreakdown(
  filters: Pick<
    ClientRequestFilters,
    "departmentId" | "serviceLineId" | "dateFrom" | "dateTo"
  > = {},
) {
  return useQuery({
    queryKey: ["client-requests", "lost-breakdown", filters],
    queryFn: async () =>
      apiJson<LostBreakdownEntry[]>(`/client-requests/lost-breakdown${buildQuery(filters)}`),
  });
}

export interface TimeInStageEntry {
  stage: "new" | "assigned" | "engaging" | "proposal";
  avg_days: number | null;
  sample_size: number;
  stuck_count: number;
  oldest_stuck: { id: string; title: string; days: number } | null;
}

export function useClientRequestTimeInStage(
  filters: Pick<
    ClientRequestFilters,
    "departmentId" | "serviceLineId" | "dateFrom" | "dateTo"
  > = {},
) {
  return useQuery({
    queryKey: ["client-requests", "time-in-stage", filters],
    queryFn: async () => {
      const raw = await apiJson<
        {
          stage: "new" | "assigned" | "engaging" | "proposal";
          avgDays: number | null;
          sampleSize: number;
          stuckCount: number;
          oldestStuck: { id: string; title: string; days: number } | null;
        }[]
      >(`/client-requests/time-in-stage${buildQuery(filters)}`);
      return raw.map((r): TimeInStageEntry => ({
        stage: r.stage,
        avg_days: r.avgDays,
        sample_size: r.sampleSize,
        stuck_count: r.stuckCount,
        oldest_stuck: r.oldestStuck,
      }));
    },
  });
}

export function useClientRequestActivities(requestId: string | undefined) {
  return useQuery({
    queryKey: ["client-requests", requestId, "activities"],
    enabled: !!requestId,
    queryFn: async () =>
      (await apiJson<BackendActivity[]>(`/client-requests/${requestId}/activities`)).map(
        mapActivity,
      ),
  });
}

/* ---------- Mutations ---------- */

export function useSaveClientRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ClientRequestRow> & { title: string }) => {
      // On edit, a field passed as empty is sent as null so it clears; omitted fields stay untouched.
      const field = <K extends keyof ClientRequestRow>(key: K) => {
        const v = input[key];
        if (v !== undefined && v !== null && v !== "") return v;
        return input.id && key in input ? null : undefined;
      };
      const body = {
        title: input.title,
        description: field("description"),
        clientId: field("client_id"),
        prospectClientName: field("prospect_client_name"),
        contactName: field("contact_name"),
        contactEmail: field("contact_email"),
        contactPhone: field("contact_phone"),
        source: input.source || undefined,
        serviceLineId: field("service_line_id"),
        estimatedValue: field("estimated_value"),
        currency: input.currency || undefined,
        departmentId: field("department_id"),
        assignedToId: field("assigned_to_id"),
      };
      if (input.id) {
        await apiJson(`/client-requests/${input.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        return input.id;
      }
      const created = await apiJson<BackendRequest>("/client-requests", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return created.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-requests"] }),
  });
}

export function useRouteClientRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; department_id: string; assigned_to_id?: string }) => {
      return mapRequest(
        await apiJson<BackendRequest>(`/client-requests/${input.id}/route`, {
          method: "PATCH",
          body: JSON.stringify({
            departmentId: input.department_id,
            assignedToId: input.assigned_to_id,
          }),
        }),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-requests"] }),
  });
}

export function useUpdateClientRequestStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; stage: ClientRequestStage; lost_reason?: string }) => {
      return mapRequest(
        await apiJson<BackendRequest>(`/client-requests/${input.id}/stage`, {
          method: "PATCH",
          body: JSON.stringify({ stage: input.stage, lostReason: input.lost_reason }),
        }),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-requests"] }),
  });
}

export function useDeleteClientRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiJson(`/client-requests/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-requests"] }),
  });
}

export function useConvertToProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      requestId: string;
      name?: string;
      clientId?: string;
      startDate?: string;
    }) => {
      const { requestId, ...body } = input;
      return apiJson<{ id: string; name: string }>(
        `/client-requests/${requestId}/convert-to-project`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-requests"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useConvertClientRequestToContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      requestId: string;
      contractNumber: string;
      billingFrequency: "one_off" | "monthly" | "quarterly" | "annual";
      startDate: string;
      endDate?: string;
      clientId?: string;
      value?: number;
      currency?: string;
      notes?: string;
    }) => {
      const { requestId, ...body } = input;
      return apiJson<{ id: string; contractNumber: string }>(
        `/client-requests/${requestId}/convert-to-contract`,
        { method: "POST", body: JSON.stringify(body) },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-requests"] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}

export function useLogActivity(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      type?: ClientRequestActivityType;
      summary: string;
      occurred_at?: string;
      /** Replying: the entry being replied to. */
      parent_id?: string;
    }) => {
      await apiJson(`/client-requests/${requestId}/activities`, {
        method: "POST",
        body: JSON.stringify({
          type: input.type,
          summary: input.summary,
          occurredAt: input.occurred_at,
          parentId: input.parent_id,
        }),
      });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["client-requests", requestId, "activities"] }),
  });
}

export function useDeleteActivity(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (activityId: string) => {
      await apiJson(`/client-requests/activities/${activityId}`, { method: "DELETE" });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["client-requests", requestId, "activities"] }),
  });
}
