import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { apiFetch, apiJson } from "@/lib/api-client";
import type { PaginatedResponse } from "@/hooks/use-pagination";

export type ContractStatus = "draft" | "active" | "on_hold" | "expired" | "terminated";
export type BillingFrequency = "one_off" | "monthly" | "quarterly" | "annual";

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: "Draft",
  active: "Active",
  on_hold: "On hold",
  expired: "Expired",
  terminated: "Terminated",
};

export const CONTRACT_STATUS_STYLES: Record<ContractStatus, string> = {
  draft: "bg-secondary text-secondary-foreground",
  active: "bg-success/15 text-success",
  on_hold: "bg-warning/15 text-warning",
  expired: "bg-muted text-muted-foreground",
  terminated: "bg-destructive/15 text-destructive",
};

export const BILLING_LABELS: Record<BillingFrequency, string> = {
  one_off: "One-off",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

export type DocumentCategory =
  "signed" | "amendment" | "invoice" | "proposal" | "correspondence" | "other";

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  "signed",
  "amendment",
  "invoice",
  "proposal",
  "correspondence",
  "other",
];

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  signed: "Signed contract",
  amendment: "Amendment",
  invoice: "Invoice",
  proposal: "Proposal",
  correspondence: "Correspondence",
  other: "Other",
};

export const DOCUMENT_CATEGORY_STYLES: Record<DocumentCategory, string> = {
  signed: "bg-success/15 text-success",
  amendment: "bg-primary/10 text-primary",
  invoice: "bg-warning/15 text-warning",
  proposal: "bg-accent/15 text-accent",
  correspondence: "bg-muted text-muted-foreground",
  other: "bg-secondary text-secondary-foreground",
};

export type RenewalStatus = "no_end" | "expired" | "critical" | "soon" | "ok";

export function getRenewalInfo(endDate: string | null): {
  status: RenewalStatus;
  daysRemaining: number | null;
  label: string;
  className: string;
} {
  if (!endDate) {
    return {
      status: "no_end",
      daysRemaining: null,
      label: "Open-ended",
      className: "bg-muted text-muted-foreground",
    };
  }
  const end = new Date(endDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((end.getTime() - today.getTime()) / 86400000);
  if (days < 0)
    return {
      status: "expired",
      daysRemaining: days,
      label: `Expired ${-days}d ago`,
      className: "bg-destructive/15 text-destructive",
    };
  if (days <= 30)
    return {
      status: "critical",
      daysRemaining: days,
      label: `Renews in ${days}d`,
      className: "bg-destructive/15 text-destructive",
    };
  if (days <= 90)
    return {
      status: "soon",
      daysRemaining: days,
      label: `Renews in ${days}d`,
      className: "bg-warning/15 text-warning",
    };
  return {
    status: "ok",
    daysRemaining: days,
    label: `${days}d remaining`,
    className: "bg-success/15 text-success",
  };
}

export interface ClientContactRow {
  id: string;
  client_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractRow {
  id: string;
  contract_number: string | null;
  title: string;
  description: string | null;
  client_id: string;
  department_id: string | null;
  service_line_id: string | null;
  account_manager_id: string | null;
  status: ContractStatus;
  billing_frequency: BillingFrequency;
  start_date: string;
  end_date: string | null;
  value: number;
  currency: string;
  next_invoice_date: string | null;
  auto_renew: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  tender_id: string | null;
  tender_title: string | null;
  client_request_id: string | null;
  client_request_title: string | null;
  project_ids: { id: string; name: string }[];
  invoice_count: number | null;
}

export interface ContractDocumentRow {
  id: string;
  contract_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  version: number;
  category: DocumentCategory;
  uploaded_by: string | null;
  created_at: string;
}

export interface DepartmentRow {
  id: string;
  name: string;
  code: string | null;
}
export interface OfficeRow {
  id: string;
  name: string;
}
export interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string;
}

type BackendContract = {
  id: string;
  contractNumber: string | null;
  title: string;
  description: string | null;
  clientId: string;
  departmentId: string | null;
  serviceLineId: string | null;
  accountManagerId: string | null;
  status: ContractStatus;
  billingFrequency: BillingFrequency;
  startDate: string;
  endDate: string | null;
  value: number;
  currency: string;
  nextInvoiceDate: string | null;
  autoRenew: boolean;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  tender?: { id: string; referenceNumber: string | null; title: string } | null;
  clientRequest?: { id: string; referenceNumber: string | null; title: string } | null;
  projects?: { id: string; name: string }[];
  _count?: { invoices: number };
};

const toDateOnly = (iso: string) => iso.slice(0, 10);

function mapContract(c: BackendContract): ContractRow {
  return {
    id: c.id,
    contract_number: c.contractNumber,
    title: c.title,
    description: c.description,
    client_id: c.clientId,
    department_id: c.departmentId,
    service_line_id: c.serviceLineId,
    account_manager_id: c.accountManagerId,
    status: c.status,
    billing_frequency: c.billingFrequency,
    start_date: toDateOnly(c.startDate),
    end_date: c.endDate ? toDateOnly(c.endDate) : null,
    value: Number(c.value),
    currency: c.currency,
    next_invoice_date: c.nextInvoiceDate ? toDateOnly(c.nextInvoiceDate) : null,
    auto_renew: c.autoRenew,
    notes: c.notes,
    created_by: c.createdBy,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
    tender_id: c.tender?.id ?? null,
    tender_title: c.tender ? (c.tender.referenceNumber ?? c.tender.title) : null,
    client_request_id: c.clientRequest?.id ?? null,
    client_request_title: c.clientRequest
      ? (c.clientRequest.referenceNumber ?? c.clientRequest.title)
      : null,
    project_ids: c.projects ?? [],
    invoice_count: c._count?.invoices ?? null,
  };
}

type BackendContact = {
  id: string;
  clientId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapContact(c: BackendContact): ClientContactRow {
  return {
    id: c.id,
    client_id: c.clientId,
    name: c.name,
    role: c.role,
    email: c.email,
    phone: c.phone,
    is_primary: c.isPrimary,
    notes: c.notes,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

type BackendDocument = {
  id: string;
  contractId: string;
  fileName: string;
  storagePath: string;
  mimeType: string | null;
  sizeBytes: string | number;
  version: number;
  category: DocumentCategory;
  uploadedBy: string | null;
  createdAt: string;
};

function mapDocument(d: BackendDocument): ContractDocumentRow {
  return {
    id: d.id,
    contract_id: d.contractId,
    file_name: d.fileName,
    storage_path: d.storagePath,
    mime_type: d.mimeType,
    size_bytes: d.sizeBytes != null ? Number(d.sizeBytes) : null,
    version: d.version,
    category: d.category,
    uploaded_by: d.uploadedBy,
    created_at: d.createdAt,
  };
}

/* ---------- Queries ---------- */

type ContractFilters = { departmentId?: string | null; status?: ContractStatus; q?: string };

// See useTenders' matching overload comment (features/tender/use-tender.ts) — same reasoning.
export function useContracts(filters?: ContractFilters): UseQueryResult<ContractRow[]>;
export function useContracts(
  filters: ContractFilters,
  pagination: { page: number; pageSize: number },
): UseQueryResult<ContractRow[] | PaginatedResponse<ContractRow>>;
export function useContracts(
  filters: ContractFilters = {},
  pagination: { page?: number; pageSize?: number } = {},
) {
  return useQuery({
    queryKey: ["contracts", filters, pagination],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.departmentId) params.set("departmentId", filters.departmentId);
      if (filters.status) params.set("status", filters.status);
      if (filters.q) params.set("q", filters.q);
      if (pagination.page) params.set("page", String(pagination.page));
      if (pagination.pageSize) params.set("pageSize", String(pagination.pageSize));
      const qs = params.toString();
      const raw = await apiJson<BackendContract[] | PaginatedResponse<BackendContract>>(
        `/contracts${qs ? `?${qs}` : ""}`,
      );
      return Array.isArray(raw)
        ? raw.map(mapContract)
        : { ...raw, data: raw.data.map(mapContract) };
    },
  });
}

export interface ContractsSummary {
  count: number;
  value: number;
  active_count: number;
  active_value: number;
}

export function useContractsSummary(
  filters: { departmentId?: string | null; status?: ContractStatus; q?: string } = {},
) {
  return useQuery({
    queryKey: ["contracts", "summary", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.departmentId) params.set("departmentId", filters.departmentId);
      if (filters.status) params.set("status", filters.status);
      if (filters.q) params.set("q", filters.q);
      const qs = params.toString();
      const raw = await apiJson<{
        count: number;
        value: number | string;
        activeCount: number;
        activeValue: number | string;
      }>(`/contracts/summary${qs ? `?${qs}` : ""}`);
      return {
        count: raw.count,
        value: Number(raw.value),
        active_count: raw.activeCount,
        active_value: Number(raw.activeValue),
      } satisfies ContractsSummary;
    },
  });
}

export function useContract(id: string | undefined) {
  return useQuery({
    queryKey: ["contracts", id],
    enabled: !!id,
    queryFn: async () => mapContract(await apiJson<BackendContract>(`/contracts/${id}`)),
  });
}

export function useClientContacts(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client-contacts", clientId],
    enabled: !!clientId,
    queryFn: async () =>
      (await apiJson<BackendContact[]>(`/clients/${clientId}/contacts`)).map(mapContact),
  });
}

export function useContractDocuments(contractId: string | undefined) {
  return useQuery({
    queryKey: ["contract-documents", contractId],
    enabled: !!contractId,
    queryFn: async () =>
      (await apiJson<BackendDocument[]>(`/contracts/${contractId}/documents`)).map(mapDocument),
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ["departments-lite"],
    queryFn: async () => {
      const departments =
        await apiJson<{ id: string; name: string; code: string }[]>("/departments");
      return departments
        .map((d) => ({ id: d.id, name: d.name, code: d.code }) satisfies DepartmentRow)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

export function useOffices() {
  return useQuery({
    queryKey: ["offices-lite"],
    queryFn: async () => {
      const offices = await apiJson<{ id: string; name: string }[]>("/offices");
      return offices
        .map((o) => ({ id: o.id, name: o.name }) satisfies OfficeRow)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

export function useProfilesLite() {
  return useQuery({
    queryKey: ["profiles-lite"],
    queryFn: async () => {
      const users =
        await apiJson<{ id: string; email: string; fullName: string | null }[]>("/users/lite");
      return users.map(
        (u) => ({ id: u.id, full_name: u.fullName, email: u.email }) satisfies ProfileRow,
      );
    },
  });
}

/* ---------- Mutations ---------- */

export function useSaveClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      name: string;
      code?: string | null;
      country?: string | null;
      currency_code: string;
      is_active: boolean;
      industry?: string | null;
      segment?: string | null;
      account_manager_id?: string | null;
    }) => {
      const body = {
        name: input.name,
        code: input.code || undefined,
        country: input.country || undefined,
        currencyCode: input.currency_code,
        isActive: input.is_active,
        industry: input.industry || undefined,
        segment: input.segment || undefined,
        accountManagerId: input.account_manager_id || undefined,
      };
      if (input.id) {
        await apiJson(`/clients/${input.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiJson("/clients", { method: "POST", body: JSON.stringify(body) });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance", "clients"] }),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiJson(`/clients/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance", "clients"] }),
  });
}

export function useSaveContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ClientContactRow> & { client_id: string; name: string }) => {
      const body = {
        name: input.name,
        role: input.role ?? undefined,
        email: input.email ?? undefined,
        phone: input.phone ?? undefined,
        isPrimary: input.is_primary,
        notes: input.notes ?? undefined,
      };
      if (input.id) {
        await apiJson(`/clients/contacts/${input.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await apiJson(`/clients/${input.client_id}/contacts`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["client-contacts", vars.client_id] }),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; client_id: string }) => {
      await apiJson(`/clients/contacts/${id}`, { method: "DELETE" });
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["client-contacts", vars.client_id] }),
  });
}

export function useSaveContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<ContractRow> & { title: string; client_id: string; start_date: string },
    ) => {
      const body = {
        contractNumber: input.contract_number ?? undefined,
        title: input.title,
        description: input.description ?? undefined,
        clientId: input.client_id,
        departmentId: input.department_id ?? undefined,
        serviceLineId: input.service_line_id ?? undefined,
        accountManagerId: input.account_manager_id ?? undefined,
        status: input.status,
        billingFrequency: input.billing_frequency,
        startDate: input.start_date,
        endDate: input.end_date ?? undefined,
        value: input.value,
        currency: input.currency,
        nextInvoiceDate: input.next_invoice_date ?? undefined,
        autoRenew: input.auto_renew,
        notes: input.notes ?? undefined,
      };
      if (input.id) {
        await apiJson(`/contracts/${input.id}`, { method: "PATCH", body: JSON.stringify(body) });
        return input.id;
      }
      const created = await apiJson<BackendContract>("/contracts", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return created.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}

export function useDeleteContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiJson(`/contracts/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contracts"] }),
  });
}

/* ---------- Contract document helpers ---------- */

export async function uploadContractDocument(
  contractId: string,
  file: File,
  category: DocumentCategory = "other",
): Promise<ContractDocumentRow> {
  const form = new FormData();
  form.append("file", file);
  form.append("category", category);
  const res = await apiFetch(`/contracts/${contractId}/documents`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return mapDocument(await res.json());
}

/** Fetches the file as a blob (auth header required) and opens it via a local object URL. */
export async function openContractDocument(doc: ContractDocumentRow): Promise<void> {
  const res = await apiFetch(`/contracts/documents/${doc.id}/download`);
  if (!res.ok) throw new Error(`Could not open file (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function deleteContractDocument(doc: ContractDocumentRow): Promise<void> {
  await apiJson(`/contracts/documents/${doc.id}`, { method: "DELETE" });
}
