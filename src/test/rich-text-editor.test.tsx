import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RichTextEditor } from "@/production/features/marketing/rich-text-editor";

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
      editor.rerender(<RichTextEditor value={value} onChange={changed} disabled />);
      await waitFor(() =>
        expect(editor.container.querySelector('[contenteditable="false"]')).not.toBeNull(),
      );
      expect(changed).not.toHaveBeenCalled();
    },
  );
});
