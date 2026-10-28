import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import type { PaginatedResponse } from "@/hooks/use-pagination";
import type { WaterExpenseInput, WaterExpenseRow, WaterExpenseTotals } from "./water-expense-types";

export function useWaterExpenses(
  filters: { month: string; category?: string; status?: string; q?: string },
  pagination: { page: number; pageSize: number },
) {
  const query = new URLSearchParams({
    month: filters.month,
    page: String(pagination.page),
    pageSize: String(pagination.pageSize),
  });
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  return useQuery({
    queryKey: ["water", "expenses", filters, pagination],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await apiJson<
        PaginatedResponse<Omit<WaterExpenseRow, "amount"> & { amount: string | number }>
      >(`/water/expenses?${query}`);
      return {
        ...result,
        data: result.data.map((row): WaterExpenseRow => ({
          ...row,
          amount: Number(row.amount),
          expenseDate: row.expenseDate.slice(0, 10),
          paidOn: row.paidOn?.slice(0, 10) ?? null,
        })),
      };
    },
  });
}

export function useWaterExpenseSummary(month: string) {
  return useQuery({
    queryKey: ["water", "expenses", "summary", month],
    queryFn: () =>
      apiJson<{
        month: string;
        collections: number;
        cashAfterExpenses: number;
        expenses: WaterExpenseTotals;
      }>(`/water/expenses/summary?month=${encodeURIComponent(month)}`),
  });
}

function useRefreshExpenseViews() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["water"] }),
      queryClient.invalidateQueries({ queryKey: ["finance", "expenses"] }),
    ]);
}

export function useSaveWaterExpense() {
  const refresh = useRefreshExpenseViews();
  return useMutation({
    mutationFn: ({ id, ...input }: WaterExpenseInput & { id?: string }) =>
      apiJson(id ? `/water/expenses/${id}` : "/water/expenses", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: refresh,
  });
}

export function usePayWaterExpense() {
  const refresh = useRefreshExpenseViews();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; paidOn: string; reference?: string }) =>
      apiJson(`/water/expenses/${id}/pay`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: refresh,
  });
}
