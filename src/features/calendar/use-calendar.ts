import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export type DeadlineType = "tender_submission" | "bond_expiry" | "contract_renewal" | "task_due";

export const DEADLINE_TYPE_LABELS: Record<DeadlineType, string> = {
  tender_submission: "Tender submission",
  bond_expiry: "Bond expiry",
  contract_renewal: "Contract renewal",
  task_due: "Task due",
};

export const DEADLINE_TYPE_STYLES: Record<DeadlineType, string> = {
  tender_submission: "bg-primary/15 text-primary",
  bond_expiry: "bg-warning/15 text-warning",
  contract_renewal: "bg-accent/15 text-accent",
  task_due: "bg-secondary text-secondary-foreground",
};

export interface DeadlineItem {
  date: string;
  type: DeadlineType;
  title: string;
  to: string;
}

export function useDeadlines(from: string, to: string, departmentId?: string) {
  return useQuery({
    queryKey: ["calendar", "deadlines", from, to, departmentId ?? "all"],
    queryFn: () =>
      apiJson<DeadlineItem[]>(
        `/calendar/deadlines?from=${from}&to=${to}${departmentId ? `&departmentId=${departmentId}` : ""}`,
      ),
  });
}
