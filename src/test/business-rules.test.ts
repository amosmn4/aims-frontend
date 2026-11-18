import { describe, expect, it } from "vitest";
import {
  businessTotals,
  canReadBusinessFinance,
  canManageBusinessFinance,
  canSeeBusinesses,
  latestMonth,
  monthLabel,
  revenueByBusiness,
  visibleRequests,
  visibleTenders,
} from "@/lib/business";
import { businessFinance } from "@/lib/data";

describe("business access rules", () => {
  it("shows all businesses to the CEO", () => {
    expect(canSeeBusinesses("ceo", "p1", null)).toBe(true);
  });
  it("does not grant Finance access to an unassigned sister business", () => {
    expect(
      canSeeBusinesses(
        "department",
        "p4",
        "finance",
        [{ id: "private", name: "Private", sector: "x" }],
        { home: null, granted: [] },
      ),
    ).toBe(false);
  });
  it("hides business finances from staff without permission", () => {
    expect(canReadBusinessFinance("staff", "b0", { home: null, granted: [] })).toBe(false);
    expect(
      canReadBusinessFinance("staff", "b1", {
        home: null,
        granted: ["b1"],
        permissions: [{ person: "p2", business: "b1", manage: true }],
      }),
    ).toBe(false);
    expect(
      canManageBusinessFinance("staff", "b1", {
        home: null,
        granted: ["b1"],
        permissions: [{ person: "p2", business: "b1", finance: "view" }],
      }),
    ).toBe(false);
  });
  it("shows businesses to a person granted permission on at least one", () => {
    expect(
      canSeeBusinesses(
        "staff",
        "p6",
        "it",
        [
          { id: "b0", name: "Amsol (core)", sector: "x" },
          { id: "b1", name: "Water project", sector: "x" },
        ],
        { home: null, granted: ["b1"] },
      ),
    ).toBe(true);
  });
});

describe("business finance aggregation", () => {
  it("shows a clear label when no monthly entries exist", () => {
    expect(latestMonth([])).toBe("");
    expect(monthLabel("")).toBe("No entries");
  });
  it("totals every group finance row exactly", () => {
    const t = businessTotals(businessFinance);
    expect(t.revenue).toBe(29090000);
    expect(t.expenses).toBe(20303000);
    expect(t.profit).toBe(8787000);
  });
  it("uses the newest month as the latest month", () => {
    expect(latestMonth(businessFinance)).toBe("2026-10");
    expect(monthLabel("2026-10")).toBe("Oct 2026");
  });
  it("compares revenue per business per month", () => {
    const october = revenueByBusiness(businessFinance).map((r) => r["2026-10"]);
    expect(october).toEqual([4900000, 905000, 1280000, 2400000, 705000]);
  });
});

describe("tender visibility", () => {
  it("shows the CEO the whole pipeline", () => {
    expect(visibleTenders("ceo", "p1").length).toBe(6);
  });
  it("shows staff only tenders they are assigned to", () => {
    const mine = visibleTenders("staff", "p4");
    expect(mine.map((t) => t.id)).toEqual(["tn2", "tn6"]);
  });
});

describe("client request visibility", () => {
  it("shows the CEO every request and Operations its assigned work", () => {
    expect(visibleRequests("ceo", "p1", null).length).toBe(6);
    expect(visibleRequests("department", "p8", "operations").map((r) => r.id)).toEqual([
      "cr2",
      "cr3",
    ]);
  });
  it("does not infer department assignment from another handler", () => {
    expect(visibleRequests("department", "p4", "finance").map((r) => r.id)).toEqual(["cr1"]);
  });
  it("shows staff only requests they personally handle", () => {
    expect(visibleRequests("staff", "p4", "finance").map((r) => r.id)).toEqual(["cr1"]);
  });
});
