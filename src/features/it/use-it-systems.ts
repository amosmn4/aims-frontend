import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export type ItSystemType =
  "website" | "internal_system" | "integration" | "client_system" | "infrastructure" | "mobile_app";
export type ItSystemStatus = "active" | "inactive" | "deprecated";

export const IT_SYSTEM_TYPE_LABELS: Record<ItSystemType, string> = {
  website: "Website",
  internal_system: "Internal System",
  integration: "Integration",
  client_system: "Client System (e.g. HRMS deployment)",
  infrastructure: "Infrastructure / Hosting",
  mobile_app: "Mobile App",
};

export const IT_SYSTEM_STATUS_LABELS: Record<ItSystemStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  deprecated: "Deprecated",
};

export const IT_SYSTEM_STATUS_STYLES: Record<ItSystemStatus, string> = {
  active: "bg-success/15 text-success",
  inactive: "bg-secondary text-secondary-foreground",
  deprecated: "bg-destructive/15 text-destructive",
};

export interface ItSystemRow {
  id: string;
  name: string;
  type: ItSystemType;
  status: ItSystemStatus;
  owner: string | null;
  notes: string | null;
  /** What it does, in plain words. */
  purpose: string | null;
  techStack: string[];
  tools: string[];
  repoUrl: string | null;
  docsUrl: string | null;
  liveUrl: string | null;
  currentStage: SdlcStep | null;
  progressPercent: number | null;
  created_at: string;
  updated_at: string;
}

type BackendItSystem = {
  id: string;
  name: string;
  type: ItSystemType;
  status: ItSystemStatus;
  owner: string | null;
  notes: string | null;
  purpose?: string | null;
  techStack?: unknown;
  tools?: unknown;
  repoUrl?: string | null;
  docsUrl?: string | null;
  liveUrl?: string | null;
  currentStage?: SdlcStep | null;
  progressPercent?: number | null;
  createdAt: string;
  updatedAt: string;
};

/** Tech stack and tools are stored as JSON, so ignore anything that isn't a list of names. */
const nameList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

function mapItSystem(s: BackendItSystem): ItSystemRow {
  return {
    id: s.id,
    name: s.name,
    type: s.type,
    status: s.status,
    owner: s.owner,
    notes: s.notes,
    purpose: s.purpose ?? null,
    techStack: nameList(s.techStack),
    tools: nameList(s.tools),
    repoUrl: s.repoUrl ?? null,
    docsUrl: s.docsUrl ?? null,
    liveUrl: s.liveUrl ?? null,
    currentStage: s.currentStage ?? null,
    progressPercent: s.progressPercent ?? null,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  };
}

export function useItSystems() {
  return useQuery({
    queryKey: ["it-systems"],
    queryFn: async () => (await apiJson<BackendItSystem[]>("/it-systems")).map(mapItSystem),
  });
}

export function useSaveItSystem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ItSystemInput & { id?: string }) => {
      const body = systemBody(input);
      if (input.id) {
        return mapItSystem(
          await apiJson<BackendItSystem>(`/it-systems/${input.id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          }),
        );
      }
      return mapItSystem(
        await apiJson<BackendItSystem>("/it-systems", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      );
    },
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: ["it-systems"] });
      void qc.invalidateQueries({ queryKey: itSystemKey(saved.id) });
    },
  });
}

export function useDeleteItSystem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiJson(`/it-systems/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["it-systems"] }),
  });
}

/* ---------- One system or site: what it does, how it's built, its steps and features ---------- */

export const SDLC_STEPS = [
  "requirements",
  "design",
  "development",
  "testing",
  "deployment",
  "maintenance",
] as const;
export type SdlcStep = (typeof SDLC_STEPS)[number];

export const SDLC_STEP_LABELS: Record<SdlcStep, string> = {
  requirements: "Requirements",
  design: "Design",
  development: "Development",
  testing: "Testing",
  deployment: "Deployment",
  maintenance: "Maintenance",
};

/** What each step means, for people who don't build software. */
export const SDLC_STEP_HINTS: Record<SdlcStep, string> = {
  requirements: "Agreeing what it must do and who needs it",
  design: "Deciding how it looks and works",
  development: "Building it",
  testing: "Checking it works before anyone uses it",
  deployment: "Putting it live for people to use",
  maintenance: "Keeping it running and fixing problems",
};

export const STAGE_STATUSES = ["not_started", "in_progress", "done"] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

export const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};

export const STAGE_STATUS_STYLES: Record<StageStatus, string> = {
  not_started: "bg-secondary text-secondary-foreground",
  in_progress: "bg-warning/15 text-warning",
  done: "bg-success/15 text-success",
};

export const FEATURE_STATUSES = ["planned", "building", "live", "dropped"] as const;
export type FeatureStatus = (typeof FEATURE_STATUSES)[number];

export const FEATURE_STATUS_LABELS: Record<FeatureStatus, string> = {
  planned: "Planned",
  building: "Being built",
  live: "Live",
  dropped: "Dropped",
};

export const FEATURE_STATUS_STYLES: Record<FeatureStatus, string> = {
  planned: "bg-secondary text-secondary-foreground",
  building: "bg-warning/15 text-warning",
  live: "bg-success/15 text-success",
  dropped: "bg-destructive/15 text-destructive",
};

export interface ItSystemStageRow {
  id: string;
  stage: SdlcStep;
  status: StageStatus;
  notes: string | null;
  startedAt: string | null;
  doneAt: string | null;
  updatedAt: string;
}

export interface ItSystemFeatureRow {
  id: string;
  title: string;
  description: string | null;
  status: FeatureStatus;
  sortOrder: number;
  createdAt: string;
}

export interface ItSystemLatestUptime {
  id: string;
  month: string;
  uptimePercent: number;
  notes: string | null;
}

export interface ItSystemDetail extends ItSystemRow {
  stages: ItSystemStageRow[];
  features: ItSystemFeatureRow[];
  latestUptime: ItSystemLatestUptime | null;
  ticketCount: number;
  openTickets: number;
}

/** Everything the add/edit form can set on a system or site. */
export interface ItSystemInput {
  name: string;
  type: ItSystemType;
  status?: ItSystemStatus;
  owner?: string | null;
  notes?: string | null;
  purpose?: string | null;
  techStack?: string[];
  tools?: string[];
  repoUrl?: string | null;
  docsUrl?: string | null;
  liveUrl?: string | null;
  currentStage?: SdlcStep | null;
  progressPercent?: number | null;
}

type BackendItSystemDetail = BackendItSystem & {
  stages: ItSystemStageRow[];
  features: ItSystemFeatureRow[];
  uptimeRecords: {
    id: string;
    month: string;
    uptimePercent: string | number;
    notes: string | null;
  }[];
  _count: { tickets: number };
  openTickets: number;
};

export const itSystemKey = (id: string) => ["it-system", id] as const;

function mapItSystemDetail(s: BackendItSystemDetail): ItSystemDetail {
  const latest = s.uptimeRecords?.[0];
  return {
    ...mapItSystem(s),
    stages: s.stages ?? [],
    features: s.features ?? [],
    latestUptime: latest ? { ...latest, uptimePercent: Number(latest.uptimePercent) } : null,
    ticketCount: s._count?.tickets ?? 0,
    openTickets: s.openTickets ?? 0,
  };
}

/** Empty text clears the field; leaving it out keeps what's saved. */
const clearable = (v: string | null | undefined) =>
  v === undefined ? undefined : v?.trim() || null;

function systemBody(input: ItSystemInput) {
  return {
    name: input.name,
    type: input.type,
    status: input.status || undefined,
    owner: clearable(input.owner),
    notes: clearable(input.notes),
    purpose: clearable(input.purpose),
    techStack: input.techStack,
    tools: input.tools,
    repoUrl: clearable(input.repoUrl),
    docsUrl: clearable(input.docsUrl),
    liveUrl: clearable(input.liveUrl),
    currentStage: input.currentStage,
    progressPercent: input.progressPercent,
  };
}

export function useItSystem(id: string | undefined) {
  return useQuery({
    queryKey: itSystemKey(id ?? ""),
    enabled: !!id,
    queryFn: async () =>
      mapItSystemDetail(await apiJson<BackendItSystemDetail>(`/it-systems/${id}`)),
  });
}

/** Saves a few fields of one system without touching the rest. */
export function useUpdateItSystem(systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ItSystemInput>) =>
      apiJson<BackendItSystem>(`/it-systems/${systemId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: itSystemKey(systemId) });
      void qc.invalidateQueries({ queryKey: ["it-systems"] });
    },
  });
}

export interface SystemStageInput {
  stage: SdlcStep;
  status?: StageStatus;
  notes?: string | null;
  startedAt?: string | null;
  doneAt?: string | null;
}

export function useSaveSystemStage(systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stage, ...body }: SystemStageInput) =>
      apiJson<ItSystemStageRow>(`/it-systems/${systemId}/stages/${stage}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: itSystemKey(systemId) }),
  });
}

export interface SystemFeatureInput {
  title: string;
  description?: string | null;
  status?: FeatureStatus;
  sortOrder?: number;
}

export function useAddSystemFeature(systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SystemFeatureInput) =>
      apiJson<ItSystemFeatureRow>(`/it-systems/${systemId}/features`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: itSystemKey(systemId) }),
  });
}

export function useUpdateSystemFeature(systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: SystemFeatureInput & { id: string }) =>
      apiJson<ItSystemFeatureRow>(`/it-systems/features/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: itSystemKey(systemId) }),
  });
}

export function useDeleteSystemFeature(systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (featureId: string) =>
      apiJson(`/it-systems/features/${featureId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: itSystemKey(systemId) }),
  });
}

/** The steps in order, each with whatever has been filled in for it. */
export function stepsInOrder(detail: ItSystemDetail | undefined) {
  return SDLC_STEPS.map((stage) => ({
    stage,
    saved: detail?.stages.find((s) => s.stage === stage) ?? null,
  }));
}
