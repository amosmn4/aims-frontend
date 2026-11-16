import { describe, expect, it } from "vitest";
import { people, projects } from "@/lib/data";
import { canViewDepartments, personas, myProjects, deptOtherProjects } from "@/lib/role";
import { projectHealth } from "@/lib/analytics";

describe("Amsol reporting structure", () => {
  it("hides Departments from Staff view", () => {
    expect(canViewDepartments("staff")).toBe(false);
  });
  it("hides Departments from My department view", () => {
    expect(canViewDepartments("department")).toBe(false);
  });
  it("keeps Departments available in CEO view", () => {
    expect(canViewDepartments("ceo")).toBe(true);
  });
  it("has no department-head personas or staff titles", () => {
    expect(personas.filter((p) => /head/i.test(p.label))).toHaveLength(0);
    expect(people.filter((p) => /head/i.test(p.title))).toHaveLength(0);
  });
  it("uses the same staff member for personal and shared department views", () => {
    expect(personas.find((p) => p.mode === "staff")?.personId).toBe("p4");
    expect(personas.find((p) => p.mode === "department")?.personId).toBe("p4");
  });
  it("shows staff their membership projects and department work in the department view", () => {
    expect(myProjects("staff", "p3", "hr").map((p) => p.id)).toEqual(["pr1", "pr4"]);
    expect(myProjects("department", "p3", "hr").map((p) => p.id)).toEqual([
      "pr1",
      "pr3",
      "pr4",
      "pr5",
      "pr7",
    ]);
    expect(deptOtherProjects("p3", "hr").map((p) => p.id)).toEqual(["pr3", "pr5", "pr7"]);
  });
  it("aggregates project outcomes without employee scores", () => {
    expect(projectHealth(projects)).toEqual([
      { status: "on-track", count: 4 },
      { status: "at-risk", count: 1 },
      { status: "delayed", count: 1 },
      { status: "completed", count: 1 },
    ]);
  });
});
