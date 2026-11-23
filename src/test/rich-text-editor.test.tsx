import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { RichTextEditor } from "@/production/features/marketing/rich-text-editor";
import { RecordDialog } from "@/components/RecordDialog";

afterEach(cleanup);
beforeAll(() => {
  Object.defineProperties(Range.prototype, {
    getClientRects: { configurable: true, value: () => [] },
    getBoundingClientRect: {
      configurable: true,
      value: () => document.createElement("div").getBoundingClientRect(),
    },
  });
});

describe("Rich text draft tracking", () => {
  it.each(["", "<p>Saved notes</p>"])(
    "renders %s without reporting changes on mount or editability changes",
    async (value) => {
      const changed = vi.fn();
      const editor = render(<RichTextEditor value={value} onChange={changed} />);
      await waitFor(() =>
        expect(editor.container.querySelector('[contenteditable="true"]')).not.toBeNull(),
      );
      expect(changed).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
      editor.rerender(<RichTextEditor value={value} onChange={changed} disabled />);
      await waitFor(() =>
        expect(editor.container.querySelector('[contenteditable="false"]')).not.toBeNull(),
      );
      expect(changed).not.toHaveBeenCalled();
    },
  );

  it("loads external content without adding an undo step or reporting a draft edit", async () => {
    const changed = vi.fn();
    const view = render(<RichTextEditor value="<p>Saved notes</p>" onChange={changed} />);
    await screen.findByRole("textbox");
    view.rerender(<RichTextEditor value="<p>Refreshed notes</p>" onChange={changed} />);
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent("Refreshed notes"));
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(changed).not.toHaveBeenCalled();
  });

  it("keeps the task editor outside a label that can activate Undo", async () => {
    render(
      <RecordDialog
        title="Edit task"
        initial={{ description: "<p>Saved notes</p>" }}
        fields={[
          {
            name: "description",
            label: "Description / deliverables",
            type: "richtext",
            checklist: true,
          },
        ]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const textbox = await screen.findByRole("textbox", { name: "Description / deliverables" });
    expect(textbox.closest("label")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Checklist" }));
    await waitFor(() => expect(textbox.querySelector('ul[data-type="taskList"]')).not.toBeNull());
    fireEvent.click(textbox.querySelector("p")!);
    expect(textbox).toHaveTextContent("Saved notes");
    expect(textbox.querySelector('ul[data-type="taskList"]')).not.toBeNull();
  });
});
