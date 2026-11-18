import { useAccount } from "./account";
import { isDemo } from "./api";
import type { Account } from "./models";

export type ProductionModule = "water" | "blog" | "ledger" | "inventory" | "tender";
export function moduleAccess(account: Account | null, module: ProductionModule) {
  return isDemo
    ? undefined
    : account?.role === "ceo" && module !== "ledger"
      ? "manage"
      : account?.modules?.[module];
}
export function useModuleAccess(module: ProductionModule) {
  const { account } = useAccount();
  return moduleAccess(account, module);
}
