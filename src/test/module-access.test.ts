import { describe, expect, it, vi } from "vitest";
import { accountSchema } from "@/lib/models";
import { moduleAccess } from "@/lib/modules";
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  isDemo: false,
}));
const owner = accountSchema.parse({
  id: "owner",
  personId: "owner",
  email: "owner@ops.test",
  role: "ceo",
  active: true,
});
describe("Individual production module visibility", () => {
  it("hides modules from unassigned CEO and signed-out accounts", () => {
    expect(moduleAccess(owner, "water")).toBeUndefined();
    expect(moduleAccess(owner, "blog")).toBeUndefined();
    expect(moduleAccess(owner, "ledger")).toBeUndefined();
    expect(moduleAccess(null, "water")).toBeUndefined();
  });
  it("keeps modules and access levels independent", () => {
    const staff = {
      ...owner,
      role: "staff" as const,
      modules: { water: "view" as const, blog: "manage" as const, ledger: "view" as const },
    };
    expect(moduleAccess(staff, "water")).toBe("view");
    expect(moduleAccess(staff, "blog")).toBe("manage");
    expect(moduleAccess(staff, "ledger")).toBe("view");
  });
});
