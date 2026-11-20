import { useState } from "react";
import type { Task } from "@/lib/data";
import { perform, saveRecord } from "@/lib/workspace";
import { deliverableStatus, deliverableStatuses, type Deliverable } from "@/lib/task-content";
import { SafeHtml } from "@/production/components/safe-html";
import { plainText } from "@/lib/text";
import { useQueryClient } from "@tanstack/react-query";

export function SubtaskChecklist({ task, editable }: { task: Task; editable: boolean }) {
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  if (!task.subtasks?.length) return null;
  return (
    <fieldset className="mt-3 space-y-2 border-t pt-3 text-sm" aria-busy={busy}>
      <legend className="text-xs font-medium text-muted-foreground">
        Deliverables{" "}
        {task.subtasks.filter((item) => deliverableStatus(item) === "completed").length}/
        {task.subtasks.length}
      </legend>
      {task.subtasks.map((item) => (
        <div key={item.id} className="space-y-2 border-t pt-2">
          <span
            className={
              deliverableStatus(item) === "completed" ? "text-muted-foreground line-through" : ""
            }
          >
            {plainText(item.title)}
          </span>
          <select
            aria-label={`Status for deliverable ${plainText(item.title)}`}
            className="field-input ml-2 w-auto"
            value={deliverableStatus(item)}
            disabled={!editable || busy}
            onChange={async (event) => {
              const status = event.target.value as NonNullable<Deliverable["status"]>;
              setBusy(true);
              const saved = await perform(
                () =>
                  saveRecord("tasks", {
                    ...task,
                    subtasks: task.subtasks!.map((subtask) =>
                      subtask.id === item.id
                        ? { ...subtask, status, done: status === "completed" }
                        : subtask,
                    ),
                  }),
                "Deliverable updated",
              );
              if (saved) await client.invalidateQueries({ queryKey: ["weekly"] });
              setBusy(false);
            }}
          >
            {Object.entries(deliverableStatuses).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {item.detail && <SafeHtml html={item.detail} className="blog-content text-sm" />}
        </div>
      ))}
      {busy && (
        <p role="status" className="text-xs text-muted-foreground">
          Saving checklist...
        </p>
      )}
    </fieldset>
  );
}
