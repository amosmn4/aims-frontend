import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export type Budget = {
  id: string;
  department_id: string | null;
  department_name: string | null;
  contract_id: string | null;
  contract_title: string | null;
  period_start: string;
  period_end: string;
  budgeted_amount: number;
  actual: number;
  currency: string;
  notes: string | null;
};

type BackendBudget = {
  id: string;
  departmentId: string | null;
  department: { name: string } | null;
  contractId: string | null;
  contract: { title: string } | null;
  periodStart: string;
  periodEnd: string;
  budgetedAmount: number;
  actual: number;
  currency: string;
  notes: string | null;
};

function mapBudget(b: BackendBudget): Budget {
  return {
    id: b.id,
    department_id: b.departmentId,
    department_name: b.department?.name ?? null,
    contract_id: b.contractId,
    contract_title: b.contract?.title ?? null,
    period_start: b.periodStart.slice(0, 10),
    period_end: b.periodEnd.slice(0, 10),
    budgeted_amount: Number(b.budgetedAmount),
    actual: Number(b.actual),
    currency: b.currency,
    notes: b.notes,
  };
}

export function useBudgets() {
  return useQuery({
    queryKey: ["finance", "budgets"],
    queryFn: async () => (await apiJson<BackendBudget[]>("/budgets")).map(mapBudget),
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      departmentId?: string;
      contractId?: string;
      periodStart: string;
      periodEnd: string;
      budgetedAmount: number;
      currency?: string;
      notes?: string;
    }) => apiJson("/budgets", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance", "budgets"] }),
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/budgets/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance", "budgets"] }),
  });
}
