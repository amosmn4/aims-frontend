import { z } from "zod";
import { plainText } from "./text";

export const deliverableStatuses = {
  pending: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  blocked: "Blocked",
  cancelled: "Cancelled",
} as const;
export const deliverableSchema = z.object({
  id: z.string().min(1),
  title: z.string().transform(plainText).pipe(z.string().trim().min(1).max(200)),
  done: z.boolean(),
  detail: z.string().max(10000).optional(),
  status: z.enum(["pending", "in_progress", "completed", "blocked", "cancelled"]).optional(),
});
export type Deliverable = z.infer<typeof deliverableSchema>;
export function deliverableStatus(item: Deliverable) {
  return item.status ?? (item.done ? "completed" : "pending");
}
export function taskOutcome(status?: string): keyof typeof deliverableStatuses {
  return status === "Done"
    ? "completed"
    : status === "In progress"
      ? "in_progress"
      : status === "Blocked"
        ? "blocked"
        : status === "Cancelled"
          ? "cancelled"
          : "pending";
}
