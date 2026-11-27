import { TaskItem } from "@tiptap/extension-list";
import { useContext } from "react";
import { Plugin } from "@tiptap/pm/state";
import {
  ReactNodeViewRenderer,
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { DeliverableControls } from "@/components/DeliverableControls";
import { TaskStatusBadge } from "@/components/TaskStatusBadge";
import { deliverableStatuses, type DeliverableStatus } from "@/lib/task-content";
import { DeliverableWeek, DeliverableDelegate } from "./deliverable-week";

function DeliverableItemView({ node, editor, updateAttributes, getPos }: NodeViewProps) {
  const week = useContext(DeliverableWeek);
  const delegate = useContext(DeliverableDelegate);
  const raw = node.attrs["status"] as string | null;
  const status: DeliverableStatus =
    raw && Object.prototype.hasOwnProperty.call(deliverableStatuses, raw)
      ? (raw as DeliverableStatus)
      : node.attrs["checked"]
        ? "completed"
        : "pending";
  const title = node.firstChild?.textContent || "Deliverable";
  return (
    <NodeViewWrapper
      as="li"
      className="deliverable-row"
      data-type="taskItem"
      data-did={node.attrs["deliverableId"]}
      data-status={status}
      data-checked={String(status === "completed")}
    >
      <NodeViewContent className="deliverable-content" />
      <TaskStatusBadge status={status} className="deliverable-status" />
      <DeliverableControls
        title={title}
        status={status}
        targetDate={node.attrs["targetDate"]}
        week={week}
        disabled={!editor.isEditable}
        onDelegate={delegate ? () => delegate(node.attrs["deliverableId"]) : undefined}
        onChange={(next, date) => {
          const position = getPos();
          const undo = next === "pending" && ["forwarded", "postponed"].includes(status);
          if (
            (next === "forwarded" || next === "postponed" || undo) &&
            typeof position === "number"
          ) {
            const transaction = editor.state.tr;
            transaction.setNodeMarkup(position, undefined, {
              ...node.attrs,
              status: next,
              checked: false,
              targetDate: date ?? null,
              carryParent: null,
            });
            node.descendants((child, offset) => {
              if (
                child.type.name === "taskItem" &&
                !child.attrs["checked"] &&
                !["cancelled", "delegated"].includes(child.attrs["status"]) &&
                (undo
                  ? child.attrs["carryParent"] === node.attrs["deliverableId"]
                  : !["forwarded", "postponed"].includes(child.attrs["status"]) ||
                    child.attrs["carryParent"] === node.attrs["deliverableId"])
              )
                transaction.setNodeMarkup(position + 1 + offset, undefined, {
                  ...child.attrs,
                  status: next,
                  checked: false,
                  targetDate: date ?? null,
                  carryParent: undo ? null : node.attrs["deliverableId"],
                });
            });
            editor.view.dispatch(transaction);
          } else
            updateAttributes({
              status: next,
              checked: next === "completed",
              targetDate: date ?? null,
              carryParent: null,
            });
        }}
      />
    </NodeViewWrapper>
  );
}

export const DeliverableItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      deliverableId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-did"),
        renderHTML: (attributes) =>
          attributes["deliverableId"] ? { "data-did": attributes["deliverableId"] } : {},
      },
      status: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-status"),
        renderHTML: (attributes) =>
          attributes["status"] ? { "data-status": attributes["status"] } : {},
      },
      targetDate: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-target-date"),
        renderHTML: (attributes) =>
          attributes["targetDate"] ? { "data-target-date": attributes["targetDate"] } : {},
      },
      carryKey: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-carry-key"),
        renderHTML: (attributes) =>
          attributes["carryKey"] ? { "data-carry-key": attributes["carryKey"] } : {},
      },
      carryParent: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-carry-parent"),
        renderHTML: (attributes) =>
          attributes["carryParent"] ? { "data-carry-parent": attributes["carryParent"] } : {},
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(DeliverableItemView);
  },
  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        appendTransaction: (_transactions, _old, state) => {
          const seen = new Set<string>();
          const transaction = state.tr;
          state.doc.descendants((node, pos) => {
            if (node.type.name !== "taskItem") return;
            const id = node.attrs["deliverableId"] as string | null;
            if (!id || seen.has(id)) {
              const next = crypto.randomUUID();
              transaction.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                deliverableId: next,
                ...(id
                  ? {
                      checked: false,
                      status: "pending",
                      targetDate: null,
                      carryKey: null,
                      carryParent: null,
                    }
                  : {}),
              });
              seen.add(next);
            } else seen.add(id);
          });
          return transaction.docChanged ? transaction.setMeta("addToHistory", false) : null;
        },
      }),
    ];
  },
});
