import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export type LeadStage = "new" | "contacted" | "qualified" | "nurturing" | "converted" | "lost";
export type LeadSource = "website" | "referral" | "campaign" | "event" | "social" | "cold_outreach" | "other";
export type LeadActivityType = "call" | "email" | "meeting" | "note";

export const LEAD_STAGES: LeadStage[] = ["new", "contacted", "qualified", "nurturing", "converted", "lost"];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  nurturing: "Nurturing",
  converted: "Converted",
  lost: "Lost",
};

export const LEAD_STAGE_STYLES: Record<LeadStage, string> = {
  new: "bg-secondary text-secondary-foreground",
  contacted: "bg-primary/10 text-primary",
  qualified: "bg-warning/15 text-warning",
  nurturing: "bg-accent/15 text-accent",
  converted: "bg-success/15 text-success",
  lost: "bg-destructive/15 text-destructive",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  website: "Website",
  referral: "Referral",
  campaign: "Campaign",
  event: "Event",
  social: "Social",
  cold_outreach: "Cold Outreach",
  other: "Other",
};

export const LEAD_ACTIVITY_TYPE_LABELS: Record<LeadActivityType, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
};

export interface LeadRow {
  id: string;
  name: string;
  company: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  source: LeadSource;
  stage: LeadStage;
  notes: string | null;
  converted_request_id: string | null;
  campaign_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadActivityRow {
  id: string;
  lead_id: string;
  type: LeadActivityType;
  summary: string;
  occurred_at: string;
  created_by_name: string | null;
  created_at: string;
}

type BackendLead = {
  id: string;
  name: string;
  company: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  source: LeadSource;
  stage: LeadStage;
  notes: string | null;
  convertedRequestId: string | null;
  campaignId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapLead(l: BackendLead): LeadRow {
  return {
    id: l.id,
    name: l.name,
    company: l.company,
    contact_email: l.contactEmail,
    contact_phone: l.contactPhone,
    source: l.source,
    stage: l.stage,
    notes: l.notes,
    converted_request_id: l.convertedRequestId,
    campaign_id: l.campaignId,
    created_by: l.createdBy,
    created_at: l.createdAt,
    updated_at: l.updatedAt,
  };
}

type BackendLeadActivity = {
  id: string;
  leadId: string;
  type: LeadActivityType;
  summary: string;
  occurredAt: string;
  creator?: { id: string; fullName: string | null; email: string } | null;
  createdAt: string;
};

function mapActivity(a: BackendLeadActivity): LeadActivityRow {
  return {
    id: a.id,
    lead_id: a.leadId,
    type: a.type,
    summary: a.summary,
    occurred_at: a.occurredAt,
    created_by_name: a.creator?.fullName ?? a.creator?.email ?? null,
    created_at: a.createdAt,
  };
}

export interface LeadFilters {
  stage?: LeadStage;
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

export function useLeads(filters: LeadFilters = {}) {
  return useQuery({
    queryKey: ["leads", filters],
    queryFn: async () => (await apiJson<BackendLead[]>(`/leads${buildQuery(filters)}`)).map(mapLead),
  });
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: ["leads", id],
    enabled: !!id,
    queryFn: async () => mapLead(await apiJson<BackendLead>(`/leads/${id}`)),
  });
}

export function useLeadActivities(leadId: string | undefined) {
  return useQuery({
    queryKey: ["leads", leadId, "activities"],
    enabled: !!leadId,
    queryFn: async () => (await apiJson<BackendLeadActivity[]>(`/leads/${leadId}/activities`)).map(mapActivity),
  });
}

/* ---------- Mutations ---------- */

export function useSaveLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<LeadRow> & { name: string }) => {
      const body = {
        name: input.name,
        company: input.company || undefined,
        contactEmail: input.contact_email || undefined,
        contactPhone: input.contact_phone || undefined,
        source: input.source || undefined,
        stage: input.stage || undefined,
        notes: input.notes || undefined,
        campaignId: input.campaign_id || undefined,
      };
      if (input.id) {
        await apiJson(`/leads/${input.id}`, { method: "PATCH", body: JSON.stringify(body) });
        return input.id;
      }
      const created = await apiJson<BackendLead>("/leads", { method: "POST", body: JSON.stringify(body) });
      return created.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useUpdateLeadStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; stage: LeadStage }) => {
      return mapLead(
        await apiJson<BackendLead>(`/leads/${input.id}`, {
          method: "PATCH",
          body: JSON.stringify({ stage: input.stage }),
        }),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiJson(`/leads/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useLogLeadActivity(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { type?: LeadActivityType; summary: string; occurred_at?: string }) => {
      await apiJson(`/leads/${leadId}/activities`, {
        method: "POST",
        body: JSON.stringify({ type: input.type, summary: input.summary, occurredAt: input.occurred_at }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads", leadId, "activities"] }),
  });
}

export function useConvertLeadToRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leadId: string) => {
      return apiJson(`/leads/${leadId}/convert-to-request`, { method: "POST" });
    },
    onSuccess: (_d, leadId) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["leads", leadId] });
      qc.invalidateQueries({ queryKey: ["client-requests"] });
    },
  });
}
