import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export type ExpenseCategory =
  | "salaries"
  | "rent"
  | "utilities"
  | "software"
  | "travel"
  | "marketing"
  | "subcontractors"
  | "equipment"
  | "professional_fees"
  | "taxes"
  | "other";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "salaries",
  "rent",
  "utilities",
  "software",
  "travel",
  "marketing",
  "subcontractors",
  "equipment",
  "professional_fees",
  "taxes",
  "other",
];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  salaries: "Salaries",
  rent: "Rent",
  utilities: "Utilities",
  software: "Software",
  travel: "Travel",
  marketing: "Marketing",
  subcontractors: "Subcontractors",
  equipment: "Equipment",
  professional_fees: "Professional fees",
  taxes: "Taxes",
  other: "Other",
};

export type ExpenseStatus = "paid" | "unpaid";

export type ExpenseRow = {
  id: string;
  expense_date: string;
  due_date: string | null;
  supplier: string | null;
  description: string;
  category: ExpenseCategory;
  amount: number;
  currency_code: string;
  department_id: string | null;
  service_line_id: string | null;
  project_id: string | null;
  status: ExpenseStatus;
  paid_on: string | null;
  reference: string | null;
  department_name: string | null;
  service_line_name: string | null;
  project_name: string | null;
};

type BackendExpense = {
  id: string;
  expenseDate: string;
  dueDate: string | null;
  supplier: string | null;
  description: string;
  category: ExpenseCategory;
  amount: number | string;
  currencyCode: string;
  departmentId: string | null;
  serviceLineId: string | null;
  projectId: string | null;
  status: ExpenseStatus;
  paidOn: string | null;
  reference: string | null;
  department: { id: string; name: string; code: string } | null;
  serviceLine: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
};

const toDateOnly = (iso: string) => iso.slice(0, 10);

function mapExpense(e: BackendExpense): ExpenseRow {
  return {
    id: e.id,
    expense_date: toDateOnly(e.expenseDate),
    due_date: e.dueDate ? toDateOnly(e.dueDate) : null,
    supplier: e.supplier,
    description: e.description,
    category: e.category,
    amount: Number(e.amount),
    currency_code: e.currencyCode,
    department_id: e.departmentId,
    service_line_id: e.serviceLineId,
    project_id: e.projectId,
    status: e.status,
    paid_on: e.paidOn ? toDateOnly(e.paidOn) : null,
    reference: e.reference,
    department_name: e.department?.name ?? null,
    service_line_name: e.serviceLine?.name ?? null,
    project_name: e.project?.name ?? null,
  };
}

export type ExpenseFilters = {
  from?: string;
  to?: string;
  status?: ExpenseStatus;
  departmentId?: string;
  q?: string;
};

export function useExpenses(filters: ExpenseFilters = {}) {
  return useQuery({
    queryKey: ["finance", "expenses", filters],
    // Keep the current list on screen while a new search loads.
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
      const qs = params.toString();
      return (await apiJson<BackendExpense[]>(`/expenses${qs ? `?${qs}` : ""}`)).map(mapExpense);
    },
  });
}

export type ExpenseInput = {
  expenseDate: string;
  dueDate?: string | null;
  supplier?: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  currencyCode?: string;
  departmentId?: string | null;
  serviceLineId?: string | null;
  projectId?: string | null;
  paidOn?: string | null;
  reference?: string;
};

export function useSaveExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: ExpenseInput & { id?: string }) =>
      mapExpense(
        await apiJson<BackendExpense>(id ? `/expenses/${id}` : "/expenses", {
          method: id ? "PATCH" : "POST",
          body: JSON.stringify(input),
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance", "expenses"] }),
  });
}

export function usePayExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; paidOn: string; reference?: string }) =>
      mapExpense(
        await apiJson<BackendExpense>(`/expenses/${id}/pay`, {
          method: "POST",
          body: JSON.stringify(input),
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance", "expenses"] }),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/expenses/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance", "expenses"] }),
  });
}
