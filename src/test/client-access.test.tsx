import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentType } from "react";
import { Route } from "@/routes/clients";

const state = vi.hoisted(() => ({ manage: false }));
vi.mock("@/lib/role", () => ({
  useRole: () => ({ mode: "staff", me: { id: "staff", dept: "it" } }),
}));
vi.mock("@/lib/workspace", () => ({
  useWorkspace: () => ({
    clients: [
      {
        id: "client",
        name: "Managed client",
        contact: "Contact",
        services: ["Payroll"],
        business: "business",
        assignees: ["other"],
      },
    ],
    projects: [],
    businesses: [{ id: "business", name: "Managed business" }],
    businessAccess: [{ person: "staff", business: "business", manage: state.manage }],
    staffBusiness: [],
    deptName: (id: string) => id,
  }),
}));
afterEach(cleanup);

describe("Client management actions", () => {
  it.each([false, true])("respects the business manage permission %s", (manage) => {
    state.manage = manage;
    const Clients = Route.options.component as ComponentType;
    render(<Clients />);
    const edit = screen.queryByRole("button", { name: "Edit Managed client" });
    if (manage) expect(edit).toBeInTheDocument();
    else expect(edit).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Managed client" })).not.toBeInTheDocument();
  });
});
