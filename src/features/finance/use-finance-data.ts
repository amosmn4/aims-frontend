import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import type { PaginatedResponse } from "@/hooks/use-pagination";
import type { InvoiceRow, PaymentRow } from "./finance";

export type ClientLifecycle = "active" | "past" | "prospect";
export type ClientRelationship = "recurring" | "one_off" | "none";

export type Client = {
  id: string;
  name: string;
  code: string | null;
  country: string | null;
  currency_code: string;
  is_active: boolean;
  industry: string | null;
  segment: string | null;
  account_manager_id: string | null;
  department_id: string | null;
  department_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  lifecycle: ClientLifecycle | null;
  relationship: ClientRelationship | null;
  contract_count: number;
  project_count: number;
};

export type ServiceLine = {
  id: string;
  code: string;
  name: string;
  department_id: string;
  department_name: string;
  is_recurring: boolean;
  is_active: boolean;
  sort_order: number;
  monthly_target: number | null;
};

// Backend dates come back as full ISO datetimes; the UI throughout expects plain
// YYYY-MM-DD strings (for display and for `new Date(x)` comparisons), matching what
// Postgres/Supabase used to hand back directly.
const toDateOnly = (iso: string) => iso.slice(0, 10);

type BackendClient = {
  id: string;
  name: string;
  code: string | null;
  country: string | null;
  currencyCode: string;
  isActive: boolean;
  industry: string | null;
  segment: string | null;
  accountManagerId: string | null;
  departmentId?: string | null;
  department?: { id: string; name: string; code: string } | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  lifecycle?: ClientLifecycle;
  relationship?: ClientRelationship;
  contractCount?: number;
  projectCount?: number;
};

function mapClient(c: BackendClient): Client {
  return {
    id: c.id,
    name: c.name,
    code: c.code,
    country: c.country,
    currency_code: c.currencyCode,
    is_active: c.isActive,
    industry: c.industry,
    segment: c.segment,
    account_manager_id: c.accountManagerId,
    department_id: c.departmentId ?? null,
    department_name: c.department?.name ?? null,
    contact_email: c.contactEmail ?? null,
    contact_phone: c.contactPhone ?? null,
    lifecycle: c.lifecycle ?? null,
    relationship: c.relationship ?? null,
    contract_count: c.contractCount ?? 0,
    project_count: c.projectCount ?? 0,
  };
}

type BackendServiceLine = {
  id: string;
  code: string;
  name: string;
  department: { id: string; code: string; name: string };
  isRecurring: boolean;
  isActive: boolean;
  sortOrder: number;
  monthlyTarget?: number | string | null;
};

function mapServiceLine(s: BackendServiceLine): ServiceLine {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    department_id: s.department.id,
    department_name: s.department.name,
    is_recurring: s.isRecurring,
    is_active: s.isActive,
    sort_order: s.sortOrder,
    monthly_target: s.monthlyTarget == null ? null : Number(s.monthlyTarget),
  };
}

type BackendInvoice = {
  id: string;
  invoiceNumber: string;
  clientId: string;
  serviceLineId: string | null;
  contractId: string | null;
  projectId?: string | null;
  issueDate: string;
  dueDate: string;
  currencyCode: string;
  subtotal: number;
  tax: number;
  total: number;
  directCost: number;
  status: string;
  isRecurring: boolean;
  notes: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
};

function mapInvoice(i: BackendInvoice): InvoiceRow {
  return {
    id: i.id,
    invoice_number: i.invoiceNumber,
    client_id: i.clientId,
    service_line_id: i.serviceLineId,
    contract_id: i.contractId,
    issue_date: toDateOnly(i.issueDate),
    due_date: toDateOnly(i.dueDate),
    currency_code: i.currencyCode,
    subtotal: Number(i.subtotal),
    tax: Number(i.tax),
    total: Number(i.total),
    direct_cost: Number(i.directCost),
    status: i.status,
    is_recurring: i.isRecurring,
    notes: i.notes,
    project_id: i.projectId ?? null,
    voided_at: i.voidedAt ?? null,
    void_reason: i.voidReason ?? null,
  };
}

type BackendPayment = {
  id: string;
  invoiceId: string;
  paidOn: string;
  amount: number;
  method?: string | null;
  reference?: string | null;
};

function mapPayment(p: BackendPayment): PaymentRow {
  return {
    id: p.id,
    invoice_id: p.invoiceId,
    paid_on: toDateOnly(p.paidOn),
    amount: Number(p.amount),
    method: p.method ?? null,
    reference: p.reference ?? null,
  };
}

type ClientFilters = { industry?: string; segment?: string; q?: string };

// See useTenders' matching overload comment (features/tender/use-tender.ts) — same reasoning.
// This hook in particular has ~15 call sites across the app that only ever call it bare (picker
// dropdowns) — the overload is what keeps every one of them type-checking as a plain `Client[]`.
export function useClients(filters?: ClientFilters): UseQueryResult<Client[]>;
export function useClients(
  filters: ClientFilters,
  pagination: { page: number; pageSize: number },
): UseQueryResult<Client[] | PaginatedResponse<Client>>;
export function useClients(
  filters: ClientFilters = {},
  pagination: { page?: number; pageSize?: number } = {},
) {
  return useQuery({
    queryKey: ["finance", "clients", filters, pagination],
    // Paged lists keep showing the last page while the next search loads.
    placeholderData: pagination.page ? keepPreviousData : undefined,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.industry) params.set("industry", filters.industry);
      if (filters.segment) params.set("segment", filters.segment);
      if (filters.q) params.set("q", filters.q);
      if (pagination.page) params.set("page", String(pagination.page));
      if (pagination.pageSize) params.set("pageSize", String(pagination.pageSize));
      const qs = params.toString();
      const raw = await apiJson<BackendClient[] | PaginatedResponse<BackendClient>>(
        `/clients${qs ? `?${qs}` : ""}`,
      );
      return Array.isArray(raw) ? raw.map(mapClient) : { ...raw, data: raw.data.map(mapClient) };
    },
  });
}

export function useClientFacets() {
  return useQuery({
    queryKey: ["finance", "clients", "facets"],
    queryFn: () => apiJson<{ industries: string[]; segments: string[] }>("/clients/facets"),
  });
}

export interface NewClientInput {
  name: string;
  code?: string;
  country?: string;
  currencyCode?: string;
  industry?: string;
  segment?: string;
  departmentId?: string;
}

export function useServiceLines() {
  return useQuery({
    queryKey: ["finance", "service_lines"],
    queryFn: async () =>
      (await apiJson<BackendServiceLine[]>("/service-lines")).map(mapServiceLine),
  });
}

export function useInvoices(filters: { departmentId?: string } = {}) {
  const qs = filters.departmentId ? `?departmentId=${filters.departmentId}` : "";
  return useQuery({
    queryKey: ["finance", "invoices", filters.departmentId ?? "all"],
    queryFn: async () => (await apiJson<BackendInvoice[]>(`/invoices${qs}`)).map(mapInvoice),
  });
}

export function usePayments() {
  return useQuery({
    queryKey: ["finance", "payments"],
    queryFn: async () => (await apiJson<BackendPayment[]>("/invoice-payments")).map(mapPayment),
  });
}

export function paymentsByInvoice(payments: PaymentRow[]) {
  const m = new Map<string, number>();
  for (const p of payments) {
    m.set(p.invoice_id, (m.get(p.invoice_id) ?? 0) + Number(p.amount));
  }
  return m;
}

// Lets any of the departments onboarding a won request/tender/lead create the Client record
// inline instead of forcing a context-switch to the Clients module first — backend role gate
// relaxed to match (clients.controller.ts).
export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewClientInput) =>
      mapClient(
        await apiJson<BackendClient>("/clients", { method: "POST", body: JSON.stringify(input) }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance", "clients"] }),
  });
}

export type InvoiceInput = {
  invoiceNumber: string;
  clientId?: string;
  serviceLineId?: string | null;
  contractId?: string | null;
  projectId?: string | null;
  issueDate: string;
  dueDate: string;
  currencyCode?: string;
  subtotal: number;
  tax?: number;
  directCost?: number;
  status?: "draft" | "sent";
  isRecurring?: boolean;
  notes?: string;
};

// Invoices feed payments, debtors and contract totals, so refresh all three together.
function invalidateInvoiceData(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["finance", "invoices"] });
  qc.invalidateQueries({ queryKey: ["finance", "payments"] });
  qc.invalidateQueries({ queryKey: ["contracts"] });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InvoiceInput) =>
      apiJson<BackendInvoice>("/invoices", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => invalidateInvoiceData(qc),
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<InvoiceInput> & { id: string }) =>
      apiJson<BackendInvoice>(`/invoices/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => invalidateInvoiceData(qc),
  });
}

export function useVoidInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiJson<BackendInvoice>(`/invoices/${id}/void`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => invalidateInvoiceData(qc),
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/invoices/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateInvoiceData(qc),
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      invoiceId,
      ...input
    }: {
      invoiceId: string;
      amount: number;
      paidOn: string;
      method?: string;
      reference?: string;
    }) =>
      apiJson(`/invoices/${invoiceId}/payments`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => invalidateInvoiceData(qc),
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) =>
      apiJson(`/invoices/payments/${paymentId}`, { method: "DELETE" }),
    onSuccess: () => invalidateInvoiceData(qc),
  });
}

export type FollowUpType = "reminder_sent" | "promise_to_pay" | "escalated" | "note";

export type FollowUp = {
  id: string;
  invoice_id: string;
  type: FollowUpType;
  channel: string | null;
  promised_date: string | null;
  notes: string | null;
  parent_id: string | null;
  creator_name: string | null;
  created_by: string | null;
  created_at: string;
};

type BackendFollowUp = {
  id: string;
  invoiceId: string;
  type: FollowUpType;
  channel: string | null;
  promisedDate: string | null;
  notes: string | null;
  parentId?: string | null;
  creator?: { id: string; fullName: string | null; email: string } | null;
  createdAt: string;
};

function mapFollowUp(f: BackendFollowUp): FollowUp {
  return {
    id: f.id,
    invoice_id: f.invoiceId,
    type: f.type,
    channel: f.channel,
    promised_date: f.promisedDate ? toDateOnly(f.promisedDate) : null,
    notes: f.notes,
    parent_id: f.parentId ?? null,
    creator_name: f.creator?.fullName || f.creator?.email || null,
    created_by: f.creator?.id ?? null,
    created_at: f.createdAt,
  };
}

export function useFollowUps(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["finance", "follow-ups", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () =>
      (await apiJson<BackendFollowUp[]>(`/invoices/${invoiceId}/follow-ups`)).map(mapFollowUp),
  });
}

/** Deletes a follow-up the person logged (the CEO may delete any); replies go with it. */
export function useDeleteFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; invoiceId: string }) =>
      apiJson(`/invoices/follow-ups/${id}`, { method: "DELETE" }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["finance", "follow-ups", vars.invoiceId] });
    },
  });
}

/** Logs a new follow-up (needs a type) or replies to one (parentId + notes). */
export function useCreateFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      invoiceId,
      ...input
    }: {
      invoiceId: string;
      type?: FollowUpType;
      channel?: string;
      promisedDate?: string;
      notes?: string;
      parentId?: string;
    }) =>
      apiJson(`/invoices/${invoiceId}/follow-ups`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["finance", "follow-ups", vars.invoiceId] });
    },
  });
}
