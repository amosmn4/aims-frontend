import { describe, expect, it } from "vitest";
import { reportingWeek, weeklyStatus, type WeeklyEntry } from "@/lib/weekly";

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
});
