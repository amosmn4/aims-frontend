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

export function checklistProgress(html = "") {
  const items = html.match(/<li\b[^>]*data-type="taskItem"[^>]*>/gi) ?? [];
  return {
    total: items.length,
    done: items.filter((item) => /data-checked="true"/i.test(item)).length,
  };
}
export function checklistStatus<T extends string>(
  html: string,
  fallback: T,
): T | "To do" | "In progress" | "Done" {
  const { total, done } = checklistProgress(html);
  return !total ? fallback : done === total ? "Done" : done ? "In progress" : "To do";
}
export function taskDescription(description?: string | null, items: Deliverable[] = []) {
  const html = description ?? "";
  if (!items.length || /data-type="taskList"/i.test(html)) return html;
  const escape = (value: string) =>
    plainText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  return (
    html +
    '<ul data-type="taskList">' +
    items
      .map((item) => {
        const checked = item.status ? item.status === "completed" : item.done;
        return (
          '<li data-type="taskItem" data-checked="' +
          checked +
          '"><label><input type="checkbox"' +
          (checked ? " checked" : "") +
          "></label><div><p>" +
          escape(item.title) +
          "</p>" +
          (item.detail ?? "") +
          "</div></li>"
        );
      })
      .join("") +
    "</ul>"
  );
}
