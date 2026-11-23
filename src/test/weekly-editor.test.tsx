import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WeeklyEditor } from "@/components/weekly/WeeklyEditor";
import type { WeeklyDetail } from "@/lib/weekly";

vi.mock("@tanstack/react-router", () => ({ useBlocker: vi.fn() }));
vi.mock("@/lib/workspace", () => ({ useWorkspace: () => ({ documents: [] }) }));
afterEach(cleanup);

const detail: WeeklyDetail = {
  person: { id: "staff", name: "Staff", dept: "hr" },
  weekStart: "2026-11-16",
  weekEnd: "2026-11-22",
  now: "2026-11-20T16:00:00Z",
  configured: true,
  reportOpensAt: "2026-11-20T12:00:00Z",
  deadlines: { plan: "2026-11-16T12:00:00Z", report: "2026-11-20T17:00:00Z" },
  plan: null,
  report: null,
  tasks: [],
};

describe("Weekly description fields", () => {
  it.each(["plan", "report"] as const)(
    "opens a %s task editor without wrapping its toolbar in an activating label",
    async (phase) => {
      render(
        <QueryClientProvider client={new QueryClient()}>
          <WeeklyEditor detail={detail} phase={phase} inline onClose={vi.fn()} />
        </QueryClientProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Add task" }));
      const textbox = await screen.findByRole("textbox", { name: "Description for task 1" });
      expect(textbox.closest("label")).toBeNull();
      expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
      fireEvent.click(textbox);
      expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled();
    },
  );
});
