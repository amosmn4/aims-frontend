import type { Workspace } from "./models";

export function departmentTasks(
  tasks: Workspace["tasks"],
  projects: Workspace["projects"],
  people: Workspace["people"],
  dept: string | null,
) {
  if (!dept) return [];
  const projectIds = new Set(
    projects.filter((row) => row.depts.includes(dept)).map((row) => row.id),
  );
  const staffIds = new Set(people.filter((row) => row.dept === dept).map((row) => row.id));
  return tasks.filter((row) =>
    row.project ? projectIds.has(row.project) : staffIds.has(row.assignee),
  );
}

export function departmentWorkspace(data: Workspace, dept: string) {
  const projects = data.projects.filter((row) => row.depts.includes(dept));
  const projectIds = new Set(projects.map((row) => row.id));
  return {
    projects,
    tasks: departmentTasks(data.tasks, data.projects, data.people, dept),
    requests: data.clientRequests.filter((row) => row.assignedDept === dept),
    reports: data.reports.filter((row) => row.dept === dept && row.status !== "draft"),
    documents: data.documents.filter(
      (row) =>
        !row.report &&
        !row.weeklyRef &&
        ((row.access === "department" && row.dept === dept) ||
          (row.access === "project" && !!row.project && projectIds.has(row.project))),
    ),
    people: data.people.filter((row) => row.dept === dept),
  };
}
