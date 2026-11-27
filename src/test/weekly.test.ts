import { describe, expect, it } from "vitest";
import {
  reportingWeek,
  forwardTaskPeriod,
  reportItems,
  planItems,
  weeklyTitle,
  weeklyStatus,
  type WeeklyEntry,
  type WeeklyDetail,
} from "@/lib/weekly";

describe("Weekly reporting", () => {
  it("preserves saved plan and report draft edits when linked tasks have different content", () => {
    const item = {
      id: "item",
      taskId: "task",
      title: "Edited draft title",
      detail: "<p>Edited draft instructions</p>",
      outcome: "Saved outcome",
      due: "2026-11-20",
      priority: "High",
      status: "completed",
      subtasks: [],
    };
    const detail = {
      weekStart: "2026-11-16",
      weekEnd: "2026-11-22",
      plan: { submittedAt: null, submission: { items: [item] } },
      report: { submittedAt: null, submission: { items: [item] } },
      tasks: [
        {
          id: "task",
          title: "Original task",
          description: "Original instructions",
          status: "To do",
          weekStart: "2026-11-16",
          due: "2026-11-19",
          priority: "Low",
        },
      ],
    } as unknown as WeeklyDetail;
    expect(planItems(detail)).toEqual([item]);
    expect(reportItems(detail)).toEqual([item]);
  });
  it("names plans and reports using the selected ISO week, including year boundaries", () => {
    expect(weeklyTitle("plan", "2026-11-16")).toBe("Weekly Work Plan \u2013 Week 47");
    expect(weeklyTitle("plan", "2026-11-23")).toBe("Weekly Work Plan \u2013 Week 48");
    expect(weeklyTitle("report", "2025-12-29")).toBe("Weekly Progress Report \u2013 Week 1");
  });
  it("imports tasks assigned to a plan period without duplicates or tasks from other periods", () => {
    const detail = {
      weekStart: "2026-11-16",
      plan: {
        submission: {
          items: [
            { id: "item", taskId: "known", title: "Saved task", status: "planned", detail: "" },
          ],
        },
      },
      tasks: [
        { id: "known", title: "Saved task", weekStart: "2026-11-16" },
        { id: "pending", title: "Waiting for a plan", weekStart: "2026-11-16" },
        { id: "none", title: "No period", due: "2026-11-20" },
        { id: "other", title: "Other week", weekStart: "2026-11-23" },
      ],
    } as unknown as WeeklyDetail;
    expect(planItems(detail).map((item) => item.taskId)).toEqual(["known", "pending"]);
    expect(planItems(detail)[1]?.status).toBe("planned");
  });
  it("changes reporting week at Nairobi midnight", () => {
    expect(reportingWeek(new Date("2026-11-15T20:59:59Z"))).toBe("2026-11-09");
    expect(reportingWeek(new Date("2026-11-15T21:00:00Z"))).toBe("2026-11-16");
  });
  it("forwards overdue work to next week's plan and keeps its due weekday", () => {
    expect(
      forwardTaskPeriod(
        { weekStart: "2026-11-09", due: "2026-11-13" },
        new Date("2026-11-27T10:00:00Z"),
      ),
    ).toEqual({ weekStart: "2026-11-30", due: "2026-12-04" });
    expect(
      forwardTaskPeriod(
        { weekStart: "2026-12-07", due: "2026-12-09" },
        new Date("2026-11-27T10:00:00Z"),
      ),
    ).toEqual({ weekStart: "2026-12-14", due: "2026-12-16" });
  });
  it("keeps task descriptions, deliverable statuses and saved outcomes when work changes during the week", () => {
    const part = {
      id: "shortlist",
      title: "Create shortlist",
      done: false,
      status: "in_progress",
      detail: "<ul><li>Review candidates<ul><li>Check references</li></ul></li></ul>",
    };
    const item = {
      id: "task",
      title: "Recruitment",
      detail: "Old instructions",
      status: "planned",
      subtasks: [],
    };
    const detail = {
      weekStart: "2026-11-16",
      weekEnd: "2026-11-22",
      plan: { submittedAt: "2026-11-16", submission: { items: [item] } },
      report: {
        submittedAt: "2026-11-20",
        submission: { items: [{ ...item, outcome: "<p>Campaign launched</p>" }] },
      },
      tasks: [
        {
          id: "task",
          title: "Recruitment for Client A",
          description: "<p>Run campaign</p>",
          weekStart: "2026-11-16",
          due: "2026-11-20",
          status: "Blocked",
          subtasks: [part],
        },
      ],
    } as unknown as WeeklyDetail;
    for (const rows of [planItems(detail), reportItems(detail)]) {
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        title: "Recruitment for Client A",
        detail: "<p>Run campaign</p>",
        status: "blocked",
        subtasks: [part],
      });
    }
    expect(reportItems(detail)[0]?.outcome).toBe("<p>Campaign launched</p>");
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
    expect(items[0]).toMatchObject({
      taskId: "task",
      status: "blocked",
      detail: "",
      outcome: "Saved notes",
    });
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
