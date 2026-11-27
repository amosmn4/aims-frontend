import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WeeklyEditor } from "@/components/weekly/WeeklyEditor";
import { emptyWeeklySubmission, type WeeklyDetail, type WeeklyEntry } from "@/lib/weekly";

vi.mock("@tanstack/react-router", () => ({ useBlocker: vi.fn() }));
const mocks = vi.hoisted(() => ({ api: vi.fn(), loadWorkspace: vi.fn() }));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  api: mocks.api,
}));
vi.mock("@/lib/workspace", () => ({
  useWorkspace: () => ({ documents: [] }),
  loadWorkspace: mocks.loadWorkspace,
  perform: async (action: () => Promise<void>) => {
    await action();
    return true;
  },
}));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.api.mockResolvedValue({ version: 1 });
  mocks.loadWorkspace.mockResolvedValue(undefined);
});

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
  tasks: [
    {
      id: "10000000-0000-4000-8000-000000000001",
      title: "Existing staff task",
      description: "Existing task details",
      project: "Weekly work",
      due: "2026-11-10",
      weekStart: "2026-11-09",
      status: "To do",
      priority: "High",
      source: "planned",
    },
  ],
};

describe("Late weekly submissions", () => {
  it.each(["plan", "report"] as const)(
    "does not ask for a late reason when updating or resubmitting a recalled %s",
    async (phase) => {
      for (const recalled of [false, true]) {
        const entry: WeeklyEntry = {
          id: "entry",
          staffId: "staff",
          weekStart: detail.weekStart,
          phase,
          version: 1,
          submission: emptyWeeklySubmission(),
          submittedAt: recalled ? null : "2026-11-16T06:00:00Z",
          firstSubmittedAt: "2026-11-16T06:00:00Z",
          recalledAt: recalled ? "2026-11-20T18:00:00Z" : null,
          reviewedAt: null,
          reviewComment: null,
          returnedAt: null,
          returnComment: null,
          updatedAt: detail.now,
          late: false,
          counts: {},
        };
        const view = render(
          <QueryClientProvider client={new QueryClient()}>
            <WeeklyEditor
              detail={{ ...detail, [phase]: entry, now: "2026-11-20T18:00:00Z" }}
              phase={phase}
              inline
              onClose={vi.fn()}
            />
          </QueryClientProvider>,
        );
        fireEvent.click(
          screen.getByRole("button", {
            name: recalled ? `Submit ${phase} to CEO` : `Submit ${phase} update`,
          }),
        );
        await waitFor(() => expect(mocks.api).toHaveBeenCalled());
        expect(screen.queryByRole("dialog", { name: "Reason for late submission" })).toBeNull();
        expect(JSON.parse(mocks.api.mock.calls.at(-1)![1].body)).not.toHaveProperty("lateReason");
        view.unmount();
        vi.clearAllMocks();
      }
    },
  );
  it.each(["plan", "report"] as const)(
    "requires a late reason before submitting the %s",
    async (phase) => {
      render(
        <QueryClientProvider client={new QueryClient()}>
          <WeeklyEditor
            detail={{ ...detail, now: "2026-11-20T18:00:00Z" }}
            phase={phase}
            inline
            onClose={vi.fn()}
          />
        </QueryClientProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: `Submit ${phase} to CEO` }));
      const dialog = await screen.findByRole("dialog", { name: "Reason for late submission" });
      expect(mocks.api).not.toHaveBeenCalled();
      const submit = within(dialog).getByRole("button", { name: `Submit ${phase}` });
      expect(submit).toBeDisabled();
      fireEvent.change(within(dialog).getByLabelText("Reason"), {
        target: { value: "Client approval arrived late." },
      });
      fireEvent.click(submit);
      await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(1));
      const [path, options] = mocks.api.mock.calls[0]!;
      expect(path).toBe(`/weekly/reports/${detail.weekStart}/${phase}`);
      expect(JSON.parse(options.body)).toMatchObject({
        submit: true,
        lateReason: "Client approval arrived late.",
      });
    },
  );
});

describe("Weekly description fields", () => {
  it.each(["plan", "report"] as const)(
    "opens a %s task editor without wrapping its toolbar in an activating label",
    async (phase) => {
      render(
        <QueryClientProvider client={new QueryClient()}>
          <WeeklyEditor detail={detail} phase={phase} inline onClose={vi.fn()} />
        </QueryClientProvider>,
      );
      fireEvent.click(screen.getAllByRole("button", { name: "Add task" })[0]!);
      const textbox = await screen.findByRole("textbox", { name: "Description for task 1" });
      expect(textbox.closest("label")).toBeNull();
      expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
      fireEvent.click(textbox);
      expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
      fireEvent.change(screen.getByLabelText("Task 1"), { target: { value: "Prepared task" } });
      fireEvent.click(screen.getByRole("button", { name: "Save task" }));
      expect(textbox).toBeInTheDocument();
      act(() => {
        (textbox as HTMLElement & { editor: Editor }).editor.commands.setContent(
          '<ul data-type="taskList"><li data-type="taskItem" data-did="one" data-checked="false"><div><p>Prepared deliverable</p></div></li></ul>',
        );
      });
      await screen.findByRole("checkbox", { name: "Prepared deliverable" });
      fireEvent.click(screen.getByRole("button", { name: "Save task" }));
      expect(
        screen.queryByRole("textbox", { name: "Description for task 1" }),
      ).not.toBeInTheDocument();
      expect(screen.getByText("1. Prepared task")).toBeInTheDocument();
      await waitFor(() => expect(document.querySelector(".task-description input")).not.toBeNull());
      expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled();
      expect(screen.getAllByRole("button", { name: "Add task" })).toHaveLength(2);
      expect(document.querySelector("select button")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Edit task 1" }));
      expect(screen.getByLabelText("Task 1")).toHaveValue("Prepared task");
      fireEvent.change(screen.getByLabelText("Task 1"), { target: { value: "Unsaved edit" } });
      fireEvent.click(screen.getByRole("button", { name: "Cancel task" }));
      expect(screen.getByText("1. Prepared task")).toBeInTheDocument();
    },
    10000,
  );

  it("adds an existing Tasks record to the weekly plan without creating a duplicate", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WeeklyEditor detail={detail} phase="plan" inline onClose={vi.fn()} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Choose an existing task" }), {
      target: { value: detail.tasks[0]!.id },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add selected task" }));
    expect(await screen.findByDisplayValue("Existing staff task")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Choose an existing task" })).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Save task" }));
    expect(screen.getByText("1. Existing staff task")).toBeInTheDocument();
    expect(screen.queryByText(/^2\./)).not.toBeInTheDocument();
  });
});
