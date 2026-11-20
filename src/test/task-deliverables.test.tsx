import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TaskDeliverables } from "@/components/TaskDeliverables";
import type { Deliverable } from "@/lib/task-content";

afterEach(cleanup);

describe("Deliverable editing", () => {
  it("keeps the deliverable identity, nested notes and typed spaces while its status changes", async () => {
    const detail = "<ul><li>Review candidates<ul><li>Check references</li></ul></li></ul>";
    function Form() {
      const [items, setItems] = useState<Deliverable[]>([
        { id: "stable-shortlist-id", title: "Shortlist", done: false, detail },
      ]);
      return (
        <>
          <TaskDeliverables items={items} onChange={setItems} />
          <output data-testid="saved">{JSON.stringify(items)}</output>
        </>
      );
    }
    render(<Form />);
    const editor = await screen.findByRole("textbox", { name: "Deliverables 1 notes" });
    expect(editor.querySelector("ul li ul li")).toHaveTextContent("Check references");
    expect(editor).not.toHaveTextContent("<ul>");
    fireEvent.change(screen.getByLabelText("Deliverables 1 title"), {
      target: { value: "Create shortlist " },
    });
    expect(screen.getByLabelText("Deliverables 1 title")).toHaveValue("Create shortlist ");
    fireEvent.change(screen.getByLabelText("Deliverables 1 status"), {
      target: { value: "completed" },
    });
    await waitFor(() =>
      expect(JSON.parse(screen.getByTestId("saved").textContent!)[0]).toEqual({
        id: "stable-shortlist-id",
        title: "Create shortlist ",
        done: true,
        status: "completed",
        detail,
      }),
    );
  });
});
