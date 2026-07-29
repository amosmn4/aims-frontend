import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import type { InvoiceRow, PaymentRow } from "./finance";

export type Client = {
  id: string;
  name: string;
  code: string | null;
  country: string | null;
  currency_code: string;
  is_active: boolean;
};

export type ServiceLine = {
  id: string;
  code: string;
  name: string;
  is_recurring: boolean;
  is_active: boolean;
  sort_order: number;
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
};

function mapClient(c: BackendClient): Client {
  return {
    id: c.id,
    name: c.name,
    code: c.code,
    country: c.country,
    currency_code: c.currencyCode,
    is_active: c.isActive,
  };
}

type BackendServiceLine = {
  id: string;
  code: string;
  name: string;
  isRecurring: boolean;
  isActive: boolean;
  sortOrder: number;
};

function mapServiceLine(s: BackendServiceLine): ServiceLine {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    is_recurring: s.isRecurring,
    is_active: s.isActive,
    sort_order: s.sortOrder,
  };
}

type BackendInvoice = {
  id: string;
  invoiceNumber: string;
  clientId: string;
  serviceLineId: string | null;
  contractId: string | null;
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
  };
}

type BackendPayment = {
  id: string;
  invoiceId: string;
  paidOn: string;
  amount: number;
};

function mapPayment(p: BackendPayment): PaymentRow {
  return {
    id: p.id,
    invoice_id: p.invoiceId,
    paid_on: toDateOnly(p.paidOn),
    amount: Number(p.amount),
  };
}

export function useClients() {
  return useQuery({
    queryKey: ["finance", "clients"],
    queryFn: async () => (await apiJson<BackendClient[]>("/clients")).map(mapClient),
  });
}

export interface NewClientInput {
  name: string;
  code?: string;
  country?: string;
  currencyCode?: string;
  industry?: string;
  segment?: string;
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

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      invoiceNumber: string;
      clientId: string;
      serviceLineId?: string;
      contractId?: string;
      issueDate: string;
      dueDate: string;
      currencyCode?: string;
      subtotal: number;
      tax?: number;
      directCost?: number;
      status?: string;
      isRecurring?: boolean;
      notes?: string;
    }) => apiJson<BackendInvoice>("/invoices", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance", "invoices"] }),
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance", "payments"] });
      qc.invalidateQueries({ queryKey: ["finance", "invoices"] });
    },
  });
}

export type FollowUpType = "reminder_sent" | "promise_to_pay" | "escalated";

export type FollowUp = {
  id: string;
  invoice_id: string;
  type: FollowUpType;
  channel: string | null;
  promised_date: string | null;
  notes: string | null;
  created_at: string;
};

type BackendFollowUp = {
  id: string;
  invoiceId: string;
  type: FollowUpType;
  channel: string | null;
  promisedDate: string | null;
  notes: string | null;
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

export function useCreateFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      invoiceId,
      ...input
    }: {
      invoiceId: string;
      type: FollowUpType;
      channel?: string;
      promisedDate?: string;
      notes?: string;
    }) =>
      apiJson(`/invoices/${invoiceId}/follow-ups`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["finance", "follow-ups", vars.invoiceId] });
    },
  });
}
