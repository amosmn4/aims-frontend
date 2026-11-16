import { describe, expect, it } from "vitest";
import {
  financeForBusiness,
  financeTimeline,
  previousDateRange,
  rangeForPeriod,
  tasksDueInRange,
  totalsForRange,
  type DateRange,
} from "./ceo-dashboard";
import type { BusinessFinance, Task } from "./data";

const finance: BusinessFinance[] = [
  {
    id: "jan",
    business: "b0",
    month: "2026-01",
    date: "2026-01-31",
    description: "January",
    revenue: 100,
    expenses: 40,
  },
  {
    id: "feb",
    business: "b0",
    month: "2026-02",
    date: "2026-02-28",
    description: "February",
    revenue: 200,
    expenses: 60,
  },
  {
    id: "outside",
    business: "b0",
    month: "2025-12",
    date: "2025-12-31",
    description: "Outside period",
    revenue: 900,
    expenses: 100,
  },
];

const tasks: Task[] = [
  {
    id: "inside",
    title: "In range",
    project: "pr1",
    assignee: "p1",
    due: "2026-02-01",
    priority: "Low",
    status: "Done",
  },
  {
    id: "outside",
    title: "Out of range",
    project: "pr1",
    assignee: "p1",
    due: "2026-03-01",
    priority: "Low",
    status: "To do",
  },
];

describe("CEO dashboard data helpers", () => {
  it("calculates month, quarter, and year-to-date ranges", () => {
    const now = new Date("2026-11-15T12:00:00");
    expect(rangeForPeriod("month", now)).toEqual({ from: "2026-11-01", to: "2026-11-15" });
    expect(rangeForPeriod("quarter", now)).toEqual({ from: "2026-10-01", to: "2026-11-15" });
    expect(rangeForPeriod("year", now)).toEqual({ from: "2026-01-01", to: "2026-11-15" });
  });

  it("compares against the preceding period with the same number of days", () => {
    const range: DateRange = { from: "2026-02-01", to: "2026-02-28" };
    expect(previousDateRange(range)).toEqual({ from: "2026-01-04", to: "2026-01-31" });
  });

  it("aggregates only finance records dated within the selected range", () => {
    expect(totalsForRange(finance, { from: "2026-01-01", to: "2026-02-28" })).toEqual({
      revenue: 300,
      expenses: 100,
      profit: 200,
    });
  });

  it("scopes finance records to the selected business or keeps all businesses", () => {
    expect(financeForBusiness(finance, "b0")).toEqual(finance);
    expect(financeForBusiness(finance, "b1")).toEqual([]);
    expect(financeForBusiness(finance, "all")).toEqual(finance);
  });

  it("builds real monthly chart values and filters task due dates", () => {
    const range = { from: "2026-01-01", to: "2026-02-28" };
    expect(financeTimeline(finance, range)).toEqual([
      { key: "2026-01", label: "Jan", revenue: 100, expenses: 40 },
      { key: "2026-02", label: "Feb", revenue: 200, expenses: 60 },
    ]);
    expect(tasksDueInRange(tasks, range).map((task) => task.id)).toEqual(["inside"]);
  });
});
