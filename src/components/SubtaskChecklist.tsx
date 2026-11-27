import { useState } from "react";
import type { Task } from "@/lib/data";
import { perform, saveRecord } from "@/lib/workspace";
import { checklistStatus } from "@/lib/task-content";
import { TaskDescription } from "./TaskDescription";
import { useQueryClient } from "@tanstack/react-query";

export function SubtaskChecklist({ task, editable }: { task: Task; editable: boolean }) {
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  return (
    <div className="mt-3" aria-busy={busy}>
      <TaskDescription
        description={task.description}
        items={task.subtasks}
        week={task.weekStart}
        disabled={busy}
        onChange={
          editable
            ? async (description) => {
                setBusy(true);
                const saved = await perform(
                  () =>
                    saveRecord("tasks", {
                      ...task,
                      description,
                      subtasks: [],
                      status: checklistStatus(description, task.status),
                    }),
                  "Progress updated",
                );
                if (saved) await client.invalidateQueries({ queryKey: ["weekly"] });
                setBusy(false);
              }
            : undefined
        }
      />
      {busy && (
        <p role="status" className="text-xs text-muted-foreground">
          Saving progress...
        </p>
      )}
    </div>
  );
}
