import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export type TenderStage = "identified" | "applying" | "submitted" | "evaluation" | "won" | "lost" | "withdrawn";

export const TENDER_STAGES: TenderStage[] = [
  "identified",
  "applying",
  "submitted",
  "evaluation",
  "won",
  "lost",
  "withdrawn",
];

export const TENDER_STAGE_LABELS: Record<TenderStage, string> = {
  identified: "Identified",
  applying: "Preparing Application",
  submitted: "Submitted",
  evaluation: "Under Evaluation",
  won: "Awarded",
  lost: "Not Awarded",
  withdrawn: "Withdrawn",
};

export const TENDER_STAGE_STYLES: Record<TenderStage, string> = {
  identified: "bg-secondary text-secondary-foreground",
  applying: "bg-primary/10 text-primary",
  submitted: "bg-warning/15 text-warning",
  evaluation: "bg-accent/15 text-accent",
  won: "bg-success/15 text-success",
  lost: "bg-destructive/15 text-destructive",
  withdrawn: "bg-muted text-muted-foreground",
};

export interface TenderRow {
  id: string;
  reference_number: string | null;
  title: string;
  description: string | null;
  client_id: string | null;
  client_name: string | null;
  prospect_client_name: string | null;
  department_id: string;
  department_name: string;
  department_code: string | null;
  service_line_id: string | null;
  service_line_name: string | null;
  account_manager_id: string | null;
  account_manager_name: string | null;
  stage: TenderStage;
  estimated_value: number | null;
  currency: string;
  submission_deadline: string | null;
  submitted_at: string | null;
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  contract_id: string | null;
  contract_number: string | null;
}

export interface TenderPipelineStage {
  stage: TenderStage;
  count: number;
  total_value: number;
}

export interface TenderResourceRow {
  id: string;
  tender_id: string;
  user_id: string;
  user_name: string;
  role_note: string | null;
  allocated_hours: number | null;
  hourly_rate: number | null;
  created_at: string;
  updated_at: string;
}

export interface TenderTimeEntryRow {
  id: string;
  tender_id: string;
  user_id: string;
  user_name: string;
  entry_date: string;
  hours: number;
  notes: string | null;
  created_at: string;
}

export interface TenderCostSummary {
  budgeted_cost: number;
  budgeted_hours: number;
  actual_cost: number;
  actual_hours: number;
  unrated_hours: number;
  by_user: { user_id: string; user_name: string | null; hours: number; rate: number | null; cost: number | null }[];
}

type BackendTender = {
  id: string;
  referenceNumber: string | null;
  title: string;
  description: string | null;
  clientId: string | null;
  client?: { id: string; name: string } | null;
  prospectClientName: string | null;
  departmentId: string;
  department?: { id: string; name: string; code: string } | null;
  serviceLineId: string | null;
  serviceLine?: { id: string; name: string } | null;
  accountManagerId: string | null;
  accountManager?: { fullName: string | null; email: string } | null;
  stage: TenderStage;
  estimatedValue: number | string | null;
  currency: string;
  submissionDeadline: string | null;
  submittedAt: string | null;
  wonAt: string | null;
  lostAt: string | null;
  lostReason: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  contract?: { id: string; contractNumber: string } | null;
};

function mapTender(t: BackendTender): TenderRow {
  return {
    id: t.id,
    reference_number: t.referenceNumber,
    title: t.title,
    description: t.description,
    client_id: t.clientId,
    client_name: t.client?.name ?? null,
    prospect_client_name: t.prospectClientName,
    department_id: t.departmentId,
    department_name: t.department?.name ?? "—",
    department_code: t.department?.code ?? null,
    service_line_id: t.serviceLineId,
    service_line_name: t.serviceLine?.name ?? null,
    account_manager_id: t.accountManagerId,
    account_manager_name: t.accountManager?.fullName ?? t.accountManager?.email ?? null,
    stage: t.stage,
    estimated_value: t.estimatedValue != null ? Number(t.estimatedValue) : null,
    currency: t.currency,
    submission_deadline: t.submissionDeadline,
    submitted_at: t.submittedAt,
    won_at: t.wonAt,
    lost_at: t.lostAt,
    lost_reason: t.lostReason,
    notes: t.notes,
    created_by: t.createdBy,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
    contract_id: t.contract?.id ?? null,
    contract_number: t.contract?.contractNumber ?? null,
  };
}

type BackendResource = {
  id: string;
  tenderId: string;
  userId: string;
  user?: { id: string; fullName: string | null; email: string } | null;
  roleNote: string | null;
  allocatedHours: number | string | null;
  hourlyRate: number | string | null;
  createdAt: string;
  updatedAt: string;
};

function mapResource(r: BackendResource): TenderResourceRow {
  return {
    id: r.id,
    tender_id: r.tenderId,
    user_id: r.userId,
    user_name: r.user?.fullName ?? r.user?.email ?? "—",
    role_note: r.roleNote,
    allocated_hours: r.allocatedHours != null ? Number(r.allocatedHours) : null,
    hourly_rate: r.hourlyRate != null ? Number(r.hourlyRate) : null,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

type BackendTimeEntry = {
  id: string;
  tenderId: string;
  userId: string;
  user?: { id: string; fullName: string | null; email: string } | null;
  entryDate: string;
  hours: number | string;
  notes: string | null;
  createdAt: string;
};

function mapTimeEntry(e: BackendTimeEntry): TenderTimeEntryRow {
  return {
    id: e.id,
    tender_id: e.tenderId,
    user_id: e.userId,
    user_name: e.user?.fullName ?? e.user?.email ?? "—",
    entry_date: e.entryDate.slice(0, 10),
    hours: Number(e.hours),
    notes: e.notes,
    created_at: e.createdAt,
  };
}

export interface TenderFilters {
  departmentId?: string;
  serviceLineId?: string;
  stage?: TenderStage;
  clientId?: string;
  q?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
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

export function useTenders(filters: TenderFilters = {}) {
  return useQuery({
    queryKey: ["tenders", filters],
    queryFn: async () => (await apiJson<BackendTender[]>(`/tenders${buildQuery(filters)}`)).map(mapTender),
  });
}

export function useTender(id: string | undefined) {
  return useQuery({
    queryKey: ["tenders", id],
    enabled: !!id,
    queryFn: async () => mapTender(await apiJson<BackendTender>(`/tenders/${id}`)),
  });
}

export function useTenderPipelineSummary(
  filters: Pick<TenderFilters, "departmentId" | "serviceLineId" | "deadlineFrom" | "deadlineTo"> = {},
) {
  return useQuery({
    queryKey: ["tenders", "pipeline-summary", filters],
    queryFn: async () =>
      apiJson<TenderPipelineStage[]>(`/tenders/pipeline-summary${buildQuery(filters)}`),
  });
}

export interface TenderTimeMetrics {
  avg_days_to_submit: number | null;
  avg_days_to_decision: number | null;
  stalled: { id: string; title: string; stage: TenderStage; days: number }[];
}

export function useTenderTimeMetrics(
  filters: Pick<TenderFilters, "departmentId" | "serviceLineId" | "deadlineFrom" | "deadlineTo"> = {},
) {
  return useQuery({
    queryKey: ["tenders", "time-metrics", filters],
    queryFn: async () => {
      const raw = await apiJson<{
        avgDaysToSubmit: number | null;
        avgDaysToDecision: number | null;
        stalled: { id: string; title: string; stage: TenderStage; days: number }[];
      }>(`/tenders/time-metrics${buildQuery(filters)}`);
      const result: TenderTimeMetrics = {
        avg_days_to_submit: raw.avgDaysToSubmit,
        avg_days_to_decision: raw.avgDaysToDecision,
        stalled: raw.stalled,
      };
      return result;
    },
  });
}

export function useTenderResources(tenderId: string | undefined) {
  return useQuery({
    queryKey: ["tenders", tenderId, "resources"],
    enabled: !!tenderId,
    queryFn: async () =>
      (await apiJson<BackendResource[]>(`/tenders/${tenderId}/resources`)).map(mapResource),
  });
}

export function useTenderTimeEntries(tenderId: string | undefined) {
  return useQuery({
    queryKey: ["tenders", tenderId, "time-entries"],
    enabled: !!tenderId,
    queryFn: async () =>
      (await apiJson<BackendTimeEntry[]>(`/tenders/${tenderId}/time-entries`)).map(mapTimeEntry),
  });
}

export function useTenderCostSummary(tenderId: string | undefined) {
  return useQuery({
    queryKey: ["tenders", tenderId, "cost-summary"],
    enabled: !!tenderId,
    queryFn: async () => {
      const raw = await apiJson<{
        budgetedCost: number;
        budgetedHours: number;
        actualCost: number;
        actualHours: number;
        unratedHours: number;
        byUser: { userId: string; userName: string | null; hours: number; rate: number | null; cost: number | null }[];
      }>(`/tenders/${tenderId}/cost-summary`);
      return {
        budgeted_cost: raw.budgetedCost,
        budgeted_hours: raw.budgetedHours,
        actual_cost: raw.actualCost,
        actual_hours: raw.actualHours,
        unrated_hours: raw.unratedHours,
        by_user: raw.byUser.map((u) => ({
          user_id: u.userId,
          user_name: u.userName,
          hours: u.hours,
          rate: u.rate,
          cost: u.cost,
        })),
      } satisfies TenderCostSummary;
    },
  });
}

/* ---------- Mutations ---------- */

export function useSaveTender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<TenderRow> & { title: string; department_id: string },
    ) => {
      const body = {
        referenceNumber: input.reference_number || undefined,
        title: input.title,
        description: input.description || undefined,
        clientId: input.client_id || undefined,
        prospectClientName: input.prospect_client_name || undefined,
        departmentId: input.department_id,
        serviceLineId: input.service_line_id || undefined,
        accountManagerId: input.account_manager_id || undefined,
        estimatedValue: input.estimated_value ?? undefined,
        currency: input.currency || undefined,
        submissionDeadline: input.submission_deadline || undefined,
        notes: input.notes || undefined,
      };
      if (input.id) {
        await apiJson(`/tenders/${input.id}`, { method: "PATCH", body: JSON.stringify(body) });
        return input.id;
      }
      const created = await apiJson<BackendTender>("/tenders", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return created.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenders"] }),
  });
}

export function useUpdateTenderStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; stage: TenderStage; lost_reason?: string }) => {
      return mapTender(
        await apiJson<BackendTender>(`/tenders/${input.id}/stage`, {
          method: "PATCH",
          body: JSON.stringify({ stage: input.stage, lostReason: input.lost_reason }),
        }),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenders"] }),
  });
}

export function useDeleteTender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiJson(`/tenders/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenders"] }),
  });
}

export function useConvertToContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      tenderId: string;
      contractNumber: string;
      billingFrequency: "one_off" | "monthly" | "quarterly" | "annual";
      startDate: string;
      endDate?: string;
      clientId?: string;
      value?: number;
      currency?: string;
      notes?: string;
    }) => {
      const { tenderId, ...body } = input;
      return apiJson(`/tenders/${tenderId}/convert-to-contract`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["tenders", vars.tenderId] }),
  });
}

export function useConvertTenderToProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      tenderId: string;
      name?: string;
      clientId?: string;
      contractNumber?: string;
      billingFrequency?: "one_off" | "monthly" | "quarterly" | "annual";
    }) => {
      const { tenderId, ...body } = input;
      return apiJson(`/tenders/${tenderId}/convert-to-project`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["tenders", vars.tenderId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useSaveTenderResource(tenderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<TenderResourceRow> & { user_id?: string },
    ) => {
      const body = {
        userId: input.user_id,
        roleNote: input.role_note || undefined,
        allocatedHours: input.allocated_hours ?? undefined,
        hourlyRate: input.hourly_rate ?? undefined,
      };
      if (input.id) {
        await apiJson(`/tenders/resources/${input.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            roleNote: body.roleNote,
            allocatedHours: body.allocatedHours,
            hourlyRate: body.hourlyRate,
          }),
        });
      } else {
        await apiJson(`/tenders/${tenderId}/resources`, { method: "POST", body: JSON.stringify(body) });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenders", tenderId, "resources"] }),
  });
}

export function useDeleteTenderResource(tenderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (resourceId: string) => {
      await apiJson(`/tenders/resources/${resourceId}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenders", tenderId, "resources"] }),
  });
}

export function useLogTime(tenderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { entry_date: string; hours: number; notes?: string }) => {
      await apiJson(`/tenders/${tenderId}/time-entries`, {
        method: "POST",
        body: JSON.stringify({ entryDate: input.entry_date, hours: input.hours, notes: input.notes }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenders", tenderId, "time-entries"] });
      qc.invalidateQueries({ queryKey: ["tenders", tenderId, "cost-summary"] });
    },
  });
}

export function useDeleteTimeEntry(tenderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entryId: string) => {
      await apiJson(`/tenders/time-entries/${entryId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenders", tenderId, "time-entries"] });
      qc.invalidateQueries({ queryKey: ["tenders", tenderId, "cost-summary"] });
    },
  });
}

/* ================= Financial resourcing ================= */

export const TENDER_COST_CATEGORY_SUGGESTIONS = ["travel", "printing", "consultant", "materials", "other"];

export interface TenderCostItemRow {
  id: string;
  tender_id: string;
  category: string;
  description: string;
  amount: number;
  created_at: string;
}

type BackendCostItem = {
  id: string;
  tenderId: string;
  category: string;
  description: string;
  amount: number | string;
  createdAt: string;
};

function mapCostItem(c: BackendCostItem): TenderCostItemRow {
  return {
    id: c.id,
    tender_id: c.tenderId,
    category: c.category,
    description: c.description,
    amount: Number(c.amount),
    created_at: c.createdAt,
  };
}

export function useTenderCostItems(tenderId: string | undefined) {
  return useQuery({
    queryKey: ["tenders", tenderId, "cost-items"],
    enabled: !!tenderId,
    queryFn: async () => (await apiJson<BackendCostItem[]>(`/tenders/${tenderId}/cost-items`)).map(mapCostItem),
  });
}

export function useSaveTenderCostItem(tenderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; category?: string; description: string; amount: number }) => {
      const body = { category: input.category || undefined, description: input.description, amount: input.amount };
      if (input.id) {
        await apiJson(`/tenders/cost-items/${input.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiJson(`/tenders/${tenderId}/cost-items`, { method: "POST", body: JSON.stringify(body) });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenders", tenderId, "cost-items"] });
      qc.invalidateQueries({ queryKey: ["tenders", tenderId, "financials-summary"] });
    },
  });
}

export function useDeleteTenderCostItem(tenderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      await apiJson(`/tenders/cost-items/${itemId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenders", tenderId, "cost-items"] });
      qc.invalidateQueries({ queryKey: ["tenders", tenderId, "financials-summary"] });
    },
  });
}

export type TenderBondType = "bid_bond" | "performance_bond" | "other";
export type TenderBondStatus = "pending" | "lodged" | "released" | "forfeited";

export const TENDER_BOND_TYPE_LABELS: Record<TenderBondType, string> = {
  bid_bond: "Bid bond",
  performance_bond: "Performance bond",
  other: "Other",
};

export const TENDER_BOND_STATUS_LABELS: Record<TenderBondStatus, string> = {
  pending: "Pending",
  lodged: "Lodged",
  released: "Released",
  forfeited: "Forfeited",
};

export const TENDER_BOND_STATUS_STYLES: Record<TenderBondStatus, string> = {
  pending: "bg-secondary text-secondary-foreground",
  lodged: "bg-primary/10 text-primary",
  released: "bg-success/15 text-success",
  forfeited: "bg-destructive/15 text-destructive",
};

export interface TenderBondRow {
  id: string;
  tender_id: string;
  bond_type: TenderBondType;
  amount: number;
  provider: string | null;
  status: TenderBondStatus;
  issued_date: string | null;
  expiry_date: string | null;
  notes: string | null;
}

type BackendBond = {
  id: string;
  tenderId: string;
  bondType: TenderBondType;
  amount: number | string;
  provider: string | null;
  status: TenderBondStatus;
  issuedDate: string | null;
  expiryDate: string | null;
  notes: string | null;
};

function mapBond(b: BackendBond): TenderBondRow {
  return {
    id: b.id,
    tender_id: b.tenderId,
    bond_type: b.bondType,
    amount: Number(b.amount),
    provider: b.provider,
    status: b.status,
    issued_date: b.issuedDate ? b.issuedDate.slice(0, 10) : null,
    expiry_date: b.expiryDate ? b.expiryDate.slice(0, 10) : null,
    notes: b.notes,
  };
}

export function useTenderBonds(tenderId: string | undefined) {
  return useQuery({
    queryKey: ["tenders", tenderId, "bonds"],
    enabled: !!tenderId,
    queryFn: async () => (await apiJson<BackendBond[]>(`/tenders/${tenderId}/bonds`)).map(mapBond),
  });
}

export function useSaveTenderBond(tenderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      bond_type: TenderBondType;
      amount: number;
      provider?: string;
      status?: TenderBondStatus;
      issued_date?: string;
      expiry_date?: string;
      notes?: string;
    }) => {
      const body = {
        bondType: input.bond_type,
        amount: input.amount,
        provider: input.provider || undefined,
        status: input.status || undefined,
        issuedDate: input.issued_date || undefined,
        expiryDate: input.expiry_date || undefined,
        notes: input.notes || undefined,
      };
      if (input.id) {
        await apiJson(`/tenders/bonds/${input.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiJson(`/tenders/${tenderId}/bonds`, { method: "POST", body: JSON.stringify(body) });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenders", tenderId, "bonds"] });
      qc.invalidateQueries({ queryKey: ["tenders", tenderId, "financials-summary"] });
    },
  });
}

export function useDeleteTenderBond(tenderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bondId: string) => {
      await apiJson(`/tenders/bonds/${bondId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenders", tenderId, "bonds"] });
      qc.invalidateQueries({ queryKey: ["tenders", tenderId, "financials-summary"] });
    },
  });
}

export interface TenderPricingItemRow {
  id: string;
  tender_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
}

type BackendPricingItem = {
  id: string;
  tenderId: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  notes: string | null;
};

function mapPricingItem(p: BackendPricingItem): TenderPricingItemRow {
  return {
    id: p.id,
    tender_id: p.tenderId,
    description: p.description,
    quantity: Number(p.quantity),
    unit_price: Number(p.unitPrice),
    notes: p.notes,
  };
}

export function useTenderPricingItems(tenderId: string | undefined) {
  return useQuery({
    queryKey: ["tenders", tenderId, "pricing-items"],
    enabled: !!tenderId,
    queryFn: async () =>
      (await apiJson<BackendPricingItem[]>(`/tenders/${tenderId}/pricing-items`)).map(mapPricingItem),
  });
}

export function useSaveTenderPricingItem(tenderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; description: string; quantity?: number; unit_price: number; notes?: string }) => {
      const body = {
        description: input.description,
        quantity: input.quantity ?? undefined,
        unitPrice: input.unit_price,
        notes: input.notes || undefined,
      };
      if (input.id) {
        await apiJson(`/tenders/pricing-items/${input.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiJson(`/tenders/${tenderId}/pricing-items`, { method: "POST", body: JSON.stringify(body) });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenders", tenderId, "pricing-items"] });
      qc.invalidateQueries({ queryKey: ["tenders", tenderId, "financials-summary"] });
    },
  });
}

export function useDeleteTenderPricingItem(tenderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      await apiJson(`/tenders/pricing-items/${itemId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenders", tenderId, "pricing-items"] });
      qc.invalidateQueries({ queryKey: ["tenders", tenderId, "financials-summary"] });
    },
  });
}

export interface TenderFinancialsSummary {
  human_cost: number;
  other_cost_total: number;
  total_cost_to_pursue: number;
  bid_price: number;
  bonds_total: number;
  bond_count: number;
}

export function useTenderFinancialsSummary(tenderId: string | undefined) {
  return useQuery({
    queryKey: ["tenders", tenderId, "financials-summary"],
    enabled: !!tenderId,
    queryFn: async () => {
      const raw = await apiJson<{
        humanCost: number;
        otherCostTotal: number;
        totalCostToPursue: number;
        bidPrice: number;
        bondsTotal: number;
        bondCount: number;
      }>(`/tenders/${tenderId}/financials-summary`);
      return {
        human_cost: raw.humanCost,
        other_cost_total: raw.otherCostTotal,
        total_cost_to_pursue: raw.totalCostToPursue,
        bid_price: raw.bidPrice,
        bonds_total: raw.bondsTotal,
        bond_count: raw.bondCount,
      } satisfies TenderFinancialsSummary;
    },
  });
}

/* ================= Requirements ================= */

export type TenderRequirementStatus = "pending" | "in_progress" | "obtained" | "not_applicable";

export const TENDER_REQUIREMENT_STATUS_LABELS: Record<TenderRequirementStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  obtained: "Obtained",
  not_applicable: "N/A",
};

export const TENDER_REQUIREMENT_STATUS_STYLES: Record<TenderRequirementStatus, string> = {
  pending: "bg-secondary text-secondary-foreground",
  in_progress: "bg-primary/10 text-primary",
  obtained: "bg-success/15 text-success",
  not_applicable: "bg-muted text-muted-foreground",
};

export interface TenderRequirementRow {
  id: string;
  tender_id: string;
  title: string;
  category: string;
  status: TenderRequirementStatus;
  notes: string | null;
  document_id: string | null;
}

type BackendRequirement = {
  id: string;
  tenderId: string;
  title: string;
  category: string;
  status: TenderRequirementStatus;
  notes: string | null;
  documentId: string | null;
};

function mapRequirement(r: BackendRequirement): TenderRequirementRow {
  return {
    id: r.id,
    tender_id: r.tenderId,
    title: r.title,
    category: r.category,
    status: r.status,
    notes: r.notes,
    document_id: r.documentId,
  };
}

export function useTenderRequirements(tenderId: string | undefined) {
  return useQuery({
    queryKey: ["tenders", tenderId, "requirements"],
    enabled: !!tenderId,
    queryFn: async () =>
      (await apiJson<BackendRequirement[]>(`/tenders/${tenderId}/requirements`)).map(mapRequirement),
  });
}

export function useSaveTenderRequirement(tenderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      title?: string;
      category?: string;
      status?: TenderRequirementStatus;
      notes?: string;
      document_id?: string | null;
    }) => {
      if (input.id) {
        await apiJson(`/tenders/requirements/${input.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: input.title,
            category: input.category,
            status: input.status,
            notes: input.notes,
            documentId: input.document_id,
          }),
        });
      } else {
        await apiJson(`/tenders/${tenderId}/requirements`, {
          method: "POST",
          body: JSON.stringify({ title: input.title, category: input.category }),
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenders", tenderId, "requirements"] }),
  });
}

export function useDeleteTenderRequirement(tenderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reqId: string) => {
      await apiJson(`/tenders/requirements/${reqId}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenders", tenderId, "requirements"] }),
  });
}

export function useApplyRequirementTemplate(tenderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      await apiJson(`/tenders/${tenderId}/requirements/apply-template/${templateId}`, { method: "POST" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenders", tenderId, "requirements"] }),
  });
}

export function useSaveRequirementsAsTemplate(tenderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      await apiJson(`/tenders/${tenderId}/requirements/save-as-template`, {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requirement-templates"] }),
  });
}

/* ================= Requirement templates (global catalog) ================= */

export interface RequirementTemplateRow {
  id: string;
  name: string;
  description: string | null;
  item_count: number;
}

export interface RequirementTemplateItemRow {
  id: string;
  template_id: string;
  title: string;
  category: string;
}

type BackendTemplate = {
  id: string;
  name: string;
  description: string | null;
  _count?: { items: number };
  items?: { id: string; templateId: string; title: string; category: string }[];
};

function mapTemplate(t: BackendTemplate): RequirementTemplateRow {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    item_count: t._count?.items ?? t.items?.length ?? 0,
  };
}

export function useRequirementTemplates() {
  return useQuery({
    queryKey: ["requirement-templates"],
    queryFn: async () => (await apiJson<BackendTemplate[]>("/tender-requirement-templates")).map(mapTemplate),
  });
}

export function useRequirementTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ["requirement-templates", id],
    enabled: !!id,
    queryFn: async () => {
      const t = await apiJson<BackendTemplate>(`/tender-requirement-templates/${id}`);
      return {
        ...mapTemplate(t),
        items: (t.items ?? []).map(
          (i) => ({ id: i.id, template_id: i.templateId, title: i.title, category: i.category }) satisfies RequirementTemplateItemRow,
        ),
      };
    },
  });
}

export function useDeleteRequirementTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiJson(`/tender-requirement-templates/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requirement-templates"] }),
  });
}
