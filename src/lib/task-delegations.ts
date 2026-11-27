import { useQuery } from "@tanstack/react-query";
import { api, isDemo } from "./api";
import { useAccount } from "./account";

export type TaskDelegation = {
  id: string;
  taskId: string;
  taskTitle: string;
  deliverableId?: string | null;
  deliverableTitle?: string | null;
  senderId: string;
  recipientId: string;
  weekStart: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  createdAt: string;
  respondedAt: string | null;
  sender: { id: string; name: string };
  recipient: { id: string; name: string };
};

export function useTaskDelegations() {
  const { account } = useAccount();
  return useQuery({
    queryKey: ["task-delegations", account?.id],
    queryFn: () => api<TaskDelegation[]>("/task-delegations"),
    enabled: !isDemo && account?.role === "staff",
    refetchInterval: 30000,
  });
}
