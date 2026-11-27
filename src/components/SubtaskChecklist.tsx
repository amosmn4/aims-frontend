import { useState } from "react";
import type { Task } from "@/lib/data";
import { perform, saveRecord } from "@/lib/workspace";
import { checklistStatus } from "@/lib/task-content";
import { TaskDescription } from "./TaskDescription";
import { useQueryClient } from "@tanstack/react-query";
import { TaskDelegateDialog } from "./TaskDelegations";
import { isDemo } from "@/lib/api";
import { useRole } from "@/lib/role";

export function SubtaskChecklist({ task, editable }: { task: Task; editable: boolean }) {
  const [busy, setBusy] = useState(false);
  const [delegating, setDelegating] = useState<{ id: string; description: string } | null>(null);
  const client = useQueryClient();
  const { mode, me } = useRole();
  return (
    <div className="mt-3" aria-busy={busy}>
      <TaskDescription
        description={task.description}
        items={task.subtasks}
        week={task.weekStart}
        disabled={busy}
        onDelegate={
          editable && mode === "staff" && me.id === task.assignee && !isDemo
            ? (id, description) => setDelegating({ id, description })
            : undefined
        }
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
      {delegating && (
        <TaskDelegateDialog
          task={{ ...task, description: delegating.description }}
          deliverableId={delegating.id}
          onClose={() => setDelegating(null)}
        />
      )}
      {busy && (
        <p role="status" className="text-xs text-muted-foreground">
          Saving progress...
        </p>
      )}
    </div>
  );
}
