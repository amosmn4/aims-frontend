import { describe, expect, it } from "vitest";
import { departmentTasks, departmentWorkspace } from "@/lib/department";
import { seedWorkspace, getWorkspace } from "@/lib/workspace";

describe("Department workspace scope", () => {
  it("includes shared-project tasks across teams and excludes unrelated projects and private drafts", () => {
    seedWorkspace();
    const data = getWorkspace();
    data.people = [
      { id: "hr", name: "HR", dept: "hr", title: "Consultant" },
      { id: "it", name: "IT", dept: "it", title: "Engineer" },
    ];
    data.projects = [
      { ...data.projects[0]!, id: "shared", depts: ["hr"], members: ["hr", "it"] },
      { ...data.projects[0]!, id: "other", depts: ["it"], members: ["hr"] },
    ];
    const task = {
      title: "Task",
      due: "2026-11-20",
      priority: "Medium" as const,
      status: "To do" as const,
    };
    data.tasks = [
      { ...task, id: "shared-task", project: "shared", assignee: "it" },
      { ...task, id: "other-task", project: "other", assignee: "hr" },
      { ...task, id: "weekly", project: "", assignee: "hr" },
      { ...task, id: "private-it", project: "", assignee: "it" },
    ];
    data.reports = [
      { ...data.reports[0]!, id: "submitted", dept: "hr", status: "submitted" },
      { ...data.reports[0]!, id: "draft", dept: "hr", status: "draft" },
    ];
    const scope = departmentWorkspace(data, "hr");
    expect(scope.projects.map((row) => row.id)).toEqual(["shared"]);
    expect(scope.tasks.map((row) => row.id)).toEqual(["shared-task", "weekly"]);
    expect(scope.reports.map((row) => row.id)).toEqual(["submitted"]);
    expect(departmentTasks(data.tasks, data.projects, data.people, null)).toEqual([]);
  });

  it("requires department assignment for requests and department/project sharing for documents", () => {
    seedWorkspace();
    const data = getWorkspace();
    data.clientRequests = [
      { ...data.clientRequests[0]!, id: "assigned", assignedDept: "hr" },
      { ...data.clientRequests[0]!, id: "other", assignedDept: "it" },
    ];
    data.documents = [
      { ...data.documents[0]!, id: "department", access: "department", dept: "hr" },
      { ...data.documents[0]!, id: "private", access: "restricted", dept: "hr" },
      {
        ...data.documents[0]!,
        id: "report-file",
        access: "department",
        dept: "hr",
        report: "private-report",
      },
    ];
    const scope = departmentWorkspace(data, "hr");
    expect(scope.requests.map((row) => row.id)).toEqual(["assigned"]);
    expect(scope.documents.map((row) => row.id)).toEqual(["department"]);
  });
});
