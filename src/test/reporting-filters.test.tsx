import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ReportingWorkspacePage } from "@/components/reporting/ReportingWorkspacePage";

const state = vi.hoisted(() => ({ role: "staff", paths: [] as string[] }));
vi.mock("@/lib/account", () => ({
  useAccount: () => ({ account: { id: "owner", role: state.role } }),
}));
vi.mock("@/lib/workspace", () => ({
  useWorkspace: () => ({
    departments: [{ id: "hr", name: "HR" }],
    deptName: (value: string) => value,
  }),
}));
vi.mock("@/lib/weekly", () => ({
  useWeekly: (path: string) => {
    state.paths.push(path);
    return { isPending: false, data: undefined, error: null };
  },
  weeklyTime: (value: string) => value,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/components/reporting/ReportingDetail", () => ({ ReportingDetail: () => null }));

beforeEach(() => {
  state.role = "staff";
  state.paths = [];
});
afterEach(cleanup);

describe("Reporting scope and dates", () => {
  const filters = {
    from: "2026-11-16",
    to: "2026-11-22",
    page: 1,
    type: "",
    status: "",
    department: "hr",
    search: "",
    staff: "someone-else",
  };
  it("shows only personal filters and waits for Apply before changing the period", () => {
    const change = vi.fn();
    render(<ReportingWorkspacePage view="submissions" filters={filters} onFilter={change} />);
    expect(screen.queryByLabelText("Department")).not.toBeInTheDocument();
    const original = state.paths[0];
    expect(original).not.toContain("department=");
    expect(original).not.toContain("staff=");
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "0002-11-16" } });
    expect(change).not.toHaveBeenCalled();
    expect(state.paths.every((path) => path === original)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a valid start and end date");
    expect(change).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-11-09" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(change).toHaveBeenCalledWith({ from: "2026-11-09", to: "2026-11-22", page: 1 });
  });
  it("keeps department and staff filtering available to the CEO", () => {
    state.role = "ceo";
    render(<ReportingWorkspacePage view="submissions" filters={filters} onFilter={vi.fn()} />);
    expect(screen.getByLabelText("Department")).toBeInTheDocument();
    expect(state.paths[0]).toContain("staff=someone-else");
    expect(state.paths[0]).toContain("department=hr");
  });
});
