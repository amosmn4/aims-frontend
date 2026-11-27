import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { deliverableDates } from "@/lib/task-content";
import { TaskDescription } from "@/components/TaskDescription";
import { checklistProgress, checklistStatus, taskDescription } from "@/lib/task-content";

afterEach(cleanup);
const html =
  '<p>Recruitment <strong>for Client A</strong></p><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Create shortlist</p><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div><p>Check references</p></div></li></ul></div></li><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked></label><div><p>Run campaign</p></div></li></ul>';

describe("Single task description", () => {
  it("checks and unchecks nested todos without losing content or changing other todos", async () => {
    function Form() {
      const [description, setDescription] = useState(html);
      return (
        <>
          <TaskDescription description={description} onChange={setDescription} />
          <output data-testid="saved">{description}</output>
        </>
      );
    }
    render(<Form />);
    const checkbox = await screen.findByRole("checkbox", { name: "Check references" });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Check references" })).toBeChecked(),
    );
    expect(screen.getByText("2/3 completed")).toBeVisible();
    const saved = screen.getByTestId("saved").textContent!;
    expect(saved).toContain("<strong>for Client A</strong>");
    expect(checklistStatus(saved, "To do")).toBe("In progress");
    expect(document.querySelector("ul li ul li")).toHaveTextContent("Check references");
    fireEvent.click(screen.getByRole("checkbox", { name: "Check references" }));
    await waitFor(() => expect(screen.getByText("1/3 completed")).toBeVisible());
    expect(screen.getByRole("checkbox", { name: "Run campaign" })).toBeChecked();
  });
  it("shows saved checkboxes as read only in submissions and CEO views", async () => {
    render(<TaskDescription description={html} />);
    expect(await screen.findByRole("checkbox", { name: "Run campaign" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Run campaign" })).toBeDisabled();
  });
  it("carries legacy deliverables into the one field once and keeps manual status without todos", () => {
    const description = taskDescription("<p>Recruitment</p>", [
      { id: "old", title: "Shortlist", done: true, detail: "<ul><li>References</li></ul>" },
    ]);
    expect(checklistProgress(description)).toEqual({ total: 1, done: 1 });
    expect(checklistStatus(description, "To do")).toBe("Done");
    expect(taskDescription(description, [{ id: "old", title: "Shortlist", done: true }])).toBe(
      description,
    );
    expect(checklistStatus("", "Done")).toBe("Done");
    expect(checklistStatus("", "Blocked")).toBe("Blocked");
  });

  it("stores independent outcomes and only carries the selected deliverable", async () => {
    function Form() {
      const [description, setDescription] = useState(html);
      return (
        <>
          <TaskDescription description={description} onChange={setDescription} />
          <output data-testid="saved">{description}</output>
        </>
      );
    }
    render(<Form />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Blocked: Check references" }));
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Blocked: Check references" })).toBeChecked(),
    );
    expect(screen.getByRole("checkbox", { name: "Check references" })).not.toBeChecked();
    let saved = screen.getByTestId("saved").textContent!;
    expect(checklistStatus(saved, "To do")).toBe("Blocked");
    fireEvent.click(screen.getByRole("checkbox", { name: "Forward: Check references" }));
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Forward: Check references" })).toBeChecked(),
    );
    expect(screen.getByRole("checkbox", { name: "Blocked: Check references" })).not.toBeChecked();
    saved = screen.getByTestId("saved").textContent!;
    const document = new DOMParser().parseFromString(saved, "text/html");
    const rows = document.querySelectorAll('li[data-type="taskItem"]');
    expect(rows[0]!.getAttribute("data-status")).toBeNull();
    expect(rows[1]!.getAttribute("data-status")).toBe("forwarded");
    expect(rows[1]!.getAttribute("data-target-date")).toBe(deliverableDates().forward);
    expect(rows[2]!.getAttribute("data-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Undo forward: Check references" }));
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Forward: Check references" })).not.toBeChecked(),
    );
    expect(screen.getByRole("checkbox", { name: "Run campaign" })).toBeChecked();
    expect(screen.getByTestId("saved").textContent).not.toContain("data-target-date");
    fireEvent.click(screen.getByRole("checkbox", { name: "Postpone: Check references" }));
    const date = deliverableDates().forward;
    fireEvent.change(await screen.findByLabelText("New due date"), { target: { value: date } });
    fireEvent.click(screen.getByRole("button", { name: "Postpone deliverable" }));
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Postpone: Check references" })).toBeChecked(),
    );
    expect(screen.getByRole("checkbox", { name: "Forward: Check references" })).not.toBeChecked();
    expect(screen.getByTestId("saved")).toHaveTextContent('data-status="postponed"');
    fireEvent.click(screen.getByRole("button", { name: "Undo postpone: Check references" }));
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: "Postpone: Check references" }),
      ).not.toBeChecked(),
    );
    expect(screen.getByTestId("saved").textContent).not.toContain("data-target-date");
  });
});
