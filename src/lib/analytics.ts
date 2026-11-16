import type { Project, Status } from "./data";

export function projectHealth(items: Project[]) {
  const statuses: Status[] = ["on-track", "at-risk", "delayed", "completed"];
  return statuses.map((status) => ({
    status,
    count: items.filter((p) => p.status === status).length,
  }));
}
