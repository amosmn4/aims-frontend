import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/production/lib/api-client";
import { useAccount } from "@/lib/account";
import { useModuleAccess } from "@/lib/modules";
export type LedgerAccess = {
  read: boolean;
  write: boolean;
  manageAccess: boolean;
};
export type LedgerRow = {
  id: string;
  receipt: string;
  paybill: string;
  reference: string;
  amount: string | null;
  currency: string;
  direction: string;
  channel: string;
  paymentStatus: string;
  processingStatus: string;
  destination: string;
  systemName: string;
  payerName: string;
  receivedAt: string;
  transactionAt: string | null;
  requiresReview: boolean;
};
export type LedgerApplication = {
  id: string;
  name: string;
  code: string;
  paybill: string;
  reference_prefix: string;
  callback_url: string;
  is_active: boolean;
};
export function useLedgerData<T>(path: string, enabled = true) {
  const { account } = useAccount();
  const access = useModuleAccess("ledger");
  return useQuery({
    queryKey: ["payment-ledger", account?.id, access, path],
    enabled: !!account && !!access && enabled,
    queryFn: () => apiJson<T>(`/payment-ledger/${path}`),
    refetchInterval: 30000,
  });
}
export function useLedgerAccess() {
  return useLedgerData<LedgerAccess>("access");
}
export function useLedgerMutation<T = unknown>() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      path,
      data,
      method = "POST",
    }: {
      path: string;
      data?: unknown | undefined;
      method?: string | undefined;
    }) =>
      apiJson<T>(`/payment-ledger/${path}`, {
        method,
        ...(data !== undefined && { body: JSON.stringify(data) }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payment-ledger"] }),
  });
}
export function ledgerDate(value: string | null | undefined) {
  return value
    ? new Date(value).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })
    : "Unavailable";
}
export function ledgerMoney(value: string | null | undefined, currency = "KES") {
  return value == null
    ? "No monetary amount"
    : `${currency} ${Number(value).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
