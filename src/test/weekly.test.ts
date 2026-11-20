import { describe, expect, it } from "vitest";
import {
  reportingWeek,
  reportItems,
  weeklyStatus,
  type WeeklyEntry,
  type WeeklyDetail,
} from "@/lib/weekly";

describe("Weekly reporting", () => {
  it("changes reporting week at Nairobi midnight", () => {
    expect(reportingWeek(new Date("2026-11-15T20:59:59Z"))).toBe("2026-11-09");
    expect(reportingWeek(new Date("2026-11-15T21:00:00Z"))).toBe("2026-11-16");
  });
  it("shows a missing submission consistently for every staff member", () => {
    expect(weeklyStatus(null, true)).toBe("Not submitted");
    expect(weeklyStatus(null, false)).toBe("Not submitted");
  });
  it("does not count a draft or correction as submitted", () => {
    expect(
      weeklyStatus({ submittedAt: null, returnedAt: null, reviewedAt: null } as WeeklyEntry),
    ).toBe("Draft, not submitted");
    expect(
      weeklyStatus({
        submittedAt: null,
        returnedAt: "2026-11-20",
        reviewedAt: null,
      } as WeeklyEntry),
    ).toBe("Returned for correction");
  });
  it("includes appended plan tasks in an existing report draft without duplicating linked tasks", () => {
    const original = {
      id: "original",
      taskId: "task",
      title: "Original",
      detail: "",
      status: "planned" as const,
    };
    const added = { id: "added", title: "Contingency", detail: "", status: "planned" as const };
    const detail = {
      weekStart: "2026-11-16",
      weekEnd: "2026-11-22",
      plan: { submittedAt: "2026-11-16", submission: { items: [original, added] } },
      report: {
        submission: {
          items: [
            { ...original, id: "different-item-id", detail: "Saved notes", status: "blocked" },
          ],
        },
      },
      tasks: [
        { id: "added", title: "Contingency", project: "", status: "Done", due: "2026-11-20" },
      ],
    } as unknown as WeeklyDetail;
    const items = reportItems(detail);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ taskId: "task", status: "blocked", detail: "Saved notes" });
    expect(items[1]).toMatchObject({ id: "added", status: "completed" });
  });
  it("scopes automatic task inclusion to the reporting week and excludes unsubmitted plan tasks", () => {
    const detail = {
      weekStart: "2026-11-16",
      weekEnd: "2026-11-22",
      plan: {
        submittedAt: null,
        submission: {
          items: [{ id: "draft", title: "Draft only", status: "planned", detail: "" }],
        },
      },
      report: null,
      tasks: [
        {
          id: "current",
          title: "This week",
          status: "Done",
          weekStart: "2026-11-16",
          due: "2026-12-01",
        },
        { id: "legacy", title: "Legacy dated task", status: "To do", due: "2026-11-20" },
        {
          id: "other",
          title: "Another week",
          status: "To do",
          weekStart: "2026-11-09",
          due: "2026-11-20",
        },
      ],
    } as unknown as WeeklyDetail;
    expect(reportItems(detail).map((item) => item.taskId)).toEqual(["current", "legacy"]);
  });
});
