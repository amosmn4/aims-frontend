import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import type { ProjectStatus } from "@/features/projects/use-projects";

export type ProjectDeliveryStage =
  "onboarding" | "in_progress" | "delivery" | "invoicing" | "payment" | "closed";

export interface PipelineProjectRow {
  id: string;
  name: string;
  client_id: string | null;
  client_name: string | null;
  contract_id: string | null;
  department_id: string;
  department_code: string | null;
  department_name: string;
  status: ProjectStatus;
  delivery_stage: ProjectDeliveryStage;
  source_type: "tender" | "client_request" | null;
  source_ref: string | null;
  stage_changed_at: string;
  created_at: string;
}

type BackendPipelineProject = {
  id: string;
  name: string;
  clientId: string | null;
  client?: { name: string } | null;
  contractId: string | null;
  departmentId: string;
  department?: { name: string; code: string } | null;
  status: ProjectStatus;
  deliveryStage: ProjectDeliveryStage;
  tender?: { id: string; referenceNumber: string | null } | null;
  clientRequest?: { id: string; referenceNumber: string | null } | null;
  deliveryStageChangedAt?: string;
  createdAt: string;
};

function mapPipelineProject(p: BackendPipelineProject): PipelineProjectRow {
  const sourceType = p.tender ? "tender" : p.clientRequest ? "client_request" : null;
  const sourceRef = p.tender?.referenceNumber ?? p.clientRequest?.referenceNumber ?? null;
  return {
    id: p.id,
    name: p.name,
    client_id: p.clientId,
    client_name: p.client?.name ?? null,
    contract_id: p.contractId,
    department_id: p.departmentId,
    department_code: p.department?.code ?? null,
    department_name: p.department?.name ?? "—",
    status: p.status,
    delivery_stage: p.deliveryStage,
    source_type: sourceType,
    source_ref: sourceRef,
    stage_changed_at: p.deliveryStageChangedAt ?? p.createdAt,
    created_at: p.createdAt,
  };
}

export function usePipelineProjects(departmentId?: string) {
  const qs = departmentId ? `?departmentId=${departmentId}` : "";
  return useQuery({
    queryKey: ["pipeline-projects", departmentId],
    queryFn: async () =>
      (await apiJson<BackendPipelineProject[]>(`/projects${qs}`)).map(mapPipelineProject),
  });
}

export interface ProjectActivityRow {
  id: string;
  project_id: string;
  type: string;
  summary: string;
  occurred_at: string;
  created_by_id: string | null;
  created_by_name: string | null;
  created_at: string;
  /** The thread's first entry when this is a reply. */
  parent_id: string | null;
}

type BackendProjectActivity = {
  id: string;
  projectId: string;
  type: string;
  summary: string;
  occurredAt: string;
  createdBy: string | null;
  creator?: { fullName: string | null; email: string } | null;
  parentId?: string | null;
  createdAt: string;
};

function mapProjectActivity(a: BackendProjectActivity): ProjectActivityRow {
  return {
    id: a.id,
    project_id: a.projectId,
    type: a.type,
    summary: a.summary,
    occurred_at: a.occurredAt,
    created_by_id: a.createdBy,
    created_by_name: a.creator?.fullName ?? a.creator?.email ?? null,
    created_at: a.createdAt,
    parent_id: a.parentId ?? null,
  };
}

export function useProjectActivities(projectId: string | undefined) {
  return useQuery({
    queryKey: ["projects", projectId, "activities"],
    enabled: !!projectId,
    queryFn: async () =>
      (await apiJson<BackendProjectActivity[]>(`/projects/${projectId}/activities`)).map(
        mapProjectActivity,
      ),
  });
}

export function useLogProjectActivity(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { type: string; summary: string; parentId?: string }) =>
      apiJson(`/projects/${projectId}/activities`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects", projectId, "activities"] }),
  });
}

type BackendActivityCommon = {
  id: string;
  type: string;
  summary: string;
  occurredAt: string;
  createdBy: string | null;
  creator?: { fullName: string | null; email: string } | null;
  parentId?: string | null;
  createdAt: string;
};

function mapActivityCommon(a: BackendActivityCommon) {
  return {
    id: a.id,
    type: a.type,
    summary: a.summary,
    occurred_at: a.occurredAt,
    created_by_id: a.createdBy,
    created_by_name: a.creator?.fullName ?? a.creator?.email ?? null,
    created_at: a.createdAt,
    parent_id: a.parentId ?? null,
  };
}

export function useTenderActivities(tenderId: string | undefined) {
  return useQuery({
    queryKey: ["tenders", tenderId, "activities"],
    enabled: !!tenderId,
    queryFn: async () =>
      (await apiJson<BackendActivityCommon[]>(`/tenders/${tenderId}/activities`)).map(
        mapActivityCommon,
      ),
  });
}

export function useLogTenderActivity(tenderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { type: string; summary: string; parentId?: string }) =>
      apiJson(`/tenders/${tenderId}/activities`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenders", tenderId, "activities"] }),
  });
}

/** Whole days since a stage started. */
export function daysInStage(since: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 864e5));
}

export const STUCK_AFTER_DAYS = 30;
