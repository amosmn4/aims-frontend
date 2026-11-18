import { useState } from "react";
import type { Task } from "@/lib/data";
import { perform, saveRecord } from "@/lib/workspace";

export function SubtaskChecklist({ task, editable }: { task: Task; editable: boolean }) {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ id: string; done: boolean } | null>(null);
  const isDone = (item: { id: string; done: boolean }) =>
    pending?.id === item.id ? pending.done : item.done;
  if (!task.subtasks?.length) return null;
  return (
    <fieldset className="mt-3 space-y-2 border-t pt-3 text-sm" aria-busy={busy}>
      <legend className="text-xs font-medium text-muted-foreground">
        Subtasks {task.subtasks.filter(isDone).length}/{task.subtasks.length}
      </legend>
      {task.subtasks.map((item) => (
        <label key={item.id} className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-1"
            checked={isDone(item)}
            disabled={!editable || busy}
            onChange={async (event) => {
              const done = event.target.checked;
              setPending({ id: item.id, done });
              setBusy(true);
              const saved = await perform(
                () =>
                  saveRecord("tasks", {
                    ...task,
                    subtasks: task.subtasks!.map((subtask) =>
                      subtask.id === item.id ? { ...subtask, done } : subtask,
                    ),
                  }),
                "Subtask updated",
              );
              if (!saved) setPending(null);
              setBusy(false);
            }}
          />
          <span className={isDone(item) ? "text-muted-foreground line-through" : ""}>
            {item.title}
          </span>
        </label>
      ))}
      {busy && (
        <p role="status" className="text-xs text-muted-foreground">
          Saving checklist...
        </p>
      )}
    </fieldset>
  );
}
