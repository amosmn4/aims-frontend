import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientForm, RequestForm } from "@/components/WorkspaceForms";
import type { ClientRequest } from "@/lib/data";

const state = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/lib/role", () => ({
  useRole: () => ({
    mode: "staff",
    me: { id: "staff", name: "Staff", title: "Consultant", dept: "hr" },
  }),
}));
vi.mock("@/lib/workspace", () => ({
  saveRecord: state.save,
  useWorkspace: () => ({
    people: [
      { id: "staff", name: "Staff", dept: "hr" },
      { id: "handler", name: "IT handler", dept: "it" },
    ],
    departments: [
      { id: "hr", name: "HR" },
      { id: "it", name: "IT" },
    ],
    clients: [{ id: "client", name: "Existing client" }],
    businesses: [{ id: "b0", name: "Amsol" }],
    businessAccess: [],
    staffBusiness: [],
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.save.mockResolvedValue(undefined);
});
afterEach(cleanup);

function fillRequest() {
  fireEvent.change(screen.getByLabelText("Request title"), {
    target: { value: "Payroll support" },
  });
}

describe("Client request forms", () => {
  it.each(["existing", "prospective"])("saves a request for an %s client", async (mode) => {
    const close = vi.fn();
    render(<RequestForm onClose={close} />);
    fillRequest();
    fireEvent.change(screen.getByLabelText("Client", { exact: true }), {
      target: { value: mode },
    });
    if (mode === "prospective")
      fireEvent.change(screen.getByLabelText("Prospective client name"), {
        target: { value: "New prospect" },
      });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    expect(state.save).toHaveBeenCalledWith(
      "clientRequests",
      expect.objectContaining({
        title: "Payroll support",
        handler: "staff",
        source: "operations",
        client: mode === "existing" ? "client" : undefined,
        prospectClientName: mode === "prospective" ? "New prospect" : undefined,
      }),
    );
    expect(state.save.mock.calls[0]![1]).not.toHaveProperty("clientMode");
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  });

  it("preserves a saved handler and department outside the editor's department", () => {
    const record: ClientRequest = {
      id: "request",
      title: "Assigned request",
      client: "client",
      source: "marketing",
      received: "2026-11-20",
      handler: "handler",
      assignedDept: "it",
      status: "In progress",
    };
    render(<RequestForm record={record} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Handler")).toHaveValue("handler");
    expect(screen.getByLabelText("Assigned department")).toHaveValue("it");
  });

  it("keeps the request and error visible when the API rejects a save", async () => {
    state.save.mockRejectedValue(new Error("The workspace changed. Reload and try again."));
    const close = vi.fn();
    render(<RequestForm onClose={close} />);
    fillRequest();
    fireEvent.change(screen.getByLabelText("Prospective client name"), {
      target: { value: "New prospect" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The workspace changed");
    expect(screen.getByLabelText("Request title")).toHaveValue("Payroll support");
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });
});

describe("Client forms", () => {
  it("locks the form and prevents duplicate submissions while saving", async () => {
    let finish!: () => void;
    state.save.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const close = vi.fn();
    render(<ClientForm onClose={close} />);
    fireEvent.change(screen.getByLabelText("Client name"), { target: { value: "New client" } });
    fireEvent.change(screen.getByLabelText("Contact person"), { target: { value: "Contact" } });
    fireEvent.change(screen.getByLabelText("Services (comma separated)"), {
      target: { value: "Payroll" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByLabelText("Client name")).toBeDisabled();
    expect(screen.getByLabelText("Business")).toBeDisabled();
    expect(screen.getByLabelText("Staff")).toBeDisabled();
    const saving = screen.getByRole("button", { name: "Saving..." });
    expect(saving).toBeDisabled();
    fireEvent.submit(saving.closest("form")!);
    expect(state.save).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  });

  it("saves trimmed, unique services and default staff assignment", async () => {
    render(<ClientForm onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Client name"), { target: { value: "New client" } });
    fireEvent.change(screen.getByLabelText("Contact person"), { target: { value: "Contact" } });
    fireEvent.change(screen.getByLabelText("Services (comma separated)"), {
      target: { value: " Payroll, Training, Payroll, " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    expect(state.save).toHaveBeenCalledWith(
      "clients",
      expect.objectContaining({ services: ["Payroll", "Training"], assignees: ["staff"] }),
    );
  });

  it("preserves an existing client department when an assigned staff member edits it", () => {
    render(
      <ClientForm
        record={{
          id: "client",
          name: "Client",
          contact: "Contact",
          services: ["Payroll"],
          assignees: ["staff"],
          assignedDept: "it",
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Assigned department")).toHaveValue("it");
  });
});
