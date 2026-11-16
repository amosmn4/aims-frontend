import { describe, expect, it } from "vitest";
import { projects, reports, type Project } from "@/lib/data";
import { createProjectPdf, latestProjectReports } from "@/lib/project-export";

describe("Selected project PDF", () => {
  it("includes only the selected project's reports, newest first", () => {
    expect(latestProjectReports("pr2", reports).map((r) => r.id)).toEqual(["r2", "r6"]);
  });
  it("includes concrete progress and report details in the PDF", () => {
    const selected = projects.find((p) => p.id === "pr2");
    if (!selected) throw new Error("Missing sample project");
    const output = createProjectPdf(selected, reports).output();
    expect(output).toContain(`${selected.progress}% complete`);
    expect(output).toContain("LATEST REPORTS");
    for (const r of latestProjectReports("pr2", reports)) expect(output).toContain(r.title);
    expect(output).not.toContain(reports.find((r) => r.id === "r1")?.title);
  });
  it("creates a PDF even when a project has no reports", () => {
    const selected: Project = {
      id: "empty",
      name: "Empty project",
      lead: "p1",
      depts: [],
      members: [],
      status: "on-track",
      stage: "Planning",
      progress: 0,
      due: "2026-11-01",
      summary: "No updates",
    };
    expect(createProjectPdf(selected, reports).output()).toContain("No reports submitted");
  });
});
