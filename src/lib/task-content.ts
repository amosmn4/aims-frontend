import { z } from "zod";
import { plainText } from "./text";

export const deliverableStatuses = {
  pending: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  blocked: "Blocked",
  cancelled: "Cancelled",
  forwarded: "Forwarded",
  postponed: "Postponed",
  delegated: "Delegated",
} as const;
export const deliverableSchema = z.object({
  id: z.string().min(1),
  title: z.string().transform(plainText).pipe(z.string().trim().min(1).max(200)),
  done: z.boolean(),
  detail: z.string().max(10000).optional(),
  status: z
    .enum([
      "pending",
      "in_progress",
      "completed",
      "blocked",
      "cancelled",
      "forwarded",
      "postponed",
      "delegated",
    ])
    .optional(),
  targetDate: z.string().optional(),
});
export type Deliverable = z.infer<typeof deliverableSchema>;
export function deliverableStatus(item: Deliverable) {
  return item.status ?? (item.done ? "completed" : "pending");
}
export function taskOutcome(
  status?: string,
): Exclude<keyof typeof deliverableStatuses, "forwarded" | "postponed" | "delegated"> {
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
export type DeliverableStatus = keyof typeof deliverableStatuses;
export function taskStatusKey(status: string): DeliverableStatus {
  const key = status.toLowerCase().replaceAll(" ", "_");
  if (key === "done") return "completed";
  return Object.prototype.hasOwnProperty.call(deliverableStatuses, key)
    ? (key as DeliverableStatus)
    : "pending";
}
export function deliverableDates(week?: string | null) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const add = (day: string, count: number) =>
    new Date(new Date(`${day}T12:00:00Z`).getTime() + count * 86400000).toISOString().slice(0, 10);
  const monday = (day: string) => add(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
  const current = monday(today);
  const source = week ? monday(week) : current;
  const tomorrow = add(today, 1);
  return {
    forward: add(source > current ? source : current, 11),
    min: source > tomorrow ? source : tomorrow,
    max: add(current, 370),
  };
}
export function checklistOutcomes(html = "") {
  const counts = {
    pending: 0,
    in_progress: 0,
    completed: 0,
    blocked: 0,
    cancelled: 0,
    forwarded: 0,
    postponed: 0,
    delegated: 0,
  };
  for (const tag of html.match(/<li\b[^>]*data-type="taskItem"[^>]*>/gi) ?? []) {
    const status = tag.match(/data-status="([a-z_]+)"/i)?.[1];
    const key =
      status && Object.prototype.hasOwnProperty.call(counts, status)
        ? (status as DeliverableStatus)
        : /data-checked="true"/i.test(tag)
          ? "completed"
          : "pending";
    counts[key]++;
  }
  return counts;
}
export function checklistSummary(html = "") {
  const counts = checklistOutcomes(html);
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(
      ([status, count]) =>
        `${count} ${status === "pending" ? "pending" : deliverableStatuses[status as DeliverableStatus].toLowerCase()}`,
    )
    .join(" | ");
}
export function hasDeliverables(html = "") {
  const document = new DOMParser().parseFromString(html, "text/html");
  const rows = Array.from(document.querySelectorAll('li[data-type="taskItem"]'));
  return rows.length > 0 && rows.every((row) => !!row.querySelector("p")?.textContent?.trim());
}
export function reportTaskComplete(html = "") {
  const counts = checklistOutcomes(html);
  return checklistProgress(html).total > 0 && !counts.pending && !counts.in_progress;
}
export function checklistStatus<T extends string>(
  html: string,
  fallback: T,
): T | "To do" | "In progress" | "Done" | "Blocked" | "Cancelled" {
  const { total, done } = checklistProgress(html);
  const counts = checklistOutcomes(html);
  return !total
    ? fallback
    : counts.completed === total
      ? "Done"
      : counts.cancelled === total
        ? "Cancelled"
        : counts.blocked > 0
          ? "Blocked"
          : done ||
              counts.forwarded ||
              counts.postponed ||
              counts.cancelled ||
              counts.in_progress ||
              counts.delegated
            ? "In progress"
            : "To do";
}
export function ensureChecklistIds(html: string) {
  if (!/data-type="taskItem"/.test(html)) return html;
  const document = new DOMParser().parseFromString(html, "text/html");
  const ids = new Set<string>();
  document.querySelectorAll('li[data-type="taskItem"]').forEach((item) => {
    let id = item.getAttribute("data-did") ?? "";
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || ids.has(id)) id = crypto.randomUUID();
    ids.add(id);
    item.setAttribute("data-did", id);
  });
  return document.body.innerHTML;
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
          '<li data-type="taskItem" data-did="' +
          escape(item.id) +
          '" data-status="' +
          deliverableStatus(item) +
          '"' +
          (item.targetDate ? ' data-target-date="' + escape(item.targetDate) + '"' : "") +
          ' data-checked="' +
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
