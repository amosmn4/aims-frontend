import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { useAccount } from "@/lib/account";
import { mutateApi, perform } from "@/lib/workspace";
import { api, isDemo } from "@/lib/api";
import { useTaskDelegations, type TaskDelegation } from "@/lib/task-delegations";
import type { Task } from "@/lib/data";
import { plainText } from "@/lib/text";

export function DelegationActions({ request }: { request: TaskDelegation }) {
  const { account } = useAccount();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (request.status !== "pending") return null;
  const incoming = request.recipientId === account?.id;
  const respond = async (decision: "accepted" | "declined" | "cancelled") => {
    setBusy(true);
    try {
      await perform(async () => {
        await mutateApi(`/task-delegations/${request.id}/respond`, {
          method: "POST",
          body: JSON.stringify({ decision }),
        });
        await Promise.all([
          client.invalidateQueries({ queryKey: ["task-delegations"] }),
          client.invalidateQueries({ queryKey: ["weekly"] }),
        ]);
      }, `Delegation ${decision}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {incoming ? (
        <>
          <Button type="button" size="sm" disabled={busy} onClick={() => void respond("accepted")}>
            {request.deliverableId ? "Accept deliverable" : "Accept task"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void respond("declined")}
          >
            Decline
          </Button>
        </>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void respond("cancelled")}
        >
          Cancel request
        </Button>
      )}
    </div>
  );
}

export function TaskDelegationsPanel() {
  const { account } = useAccount();
  const query = useTaskDelegations();
  if (isDemo || account?.role !== "staff") return null;
  const requests = query.data ?? [];
  if (!requests.length && !query.error) return null;
  return (
    <details
      className="mb-5 rounded-lg border bg-background p-4"
      open={requests.some((row) => row.status === "pending" && row.recipientId === account.id)}
    >
      <summary className="cursor-pointer text-sm font-semibold">
        Task delegations ({requests.filter((row) => row.status === "pending").length} pending)
      </summary>
      {query.error && (
        <p role="alert" className="mt-3 text-sm">
          {query.error.message}
        </p>
      )}
      <div className="mt-3 divide-y">
        {requests.map((row) => (
          <div key={row.id} className="py-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <strong>{plainText(row.taskTitle)}</strong>
              <span className="capitalize">{row.status}</span>
            </div>
            {row.deliverableTitle && <p>Deliverable: {plainText(row.deliverableTitle)}</p>}
            <p className="text-muted-foreground">
              {row.senderId === account.id ? `To ${row.recipient.name}` : `From ${row.sender.name}`}{" "}
              | Week of {row.weekStart}
            </p>
            {row.status === "pending" && (
              <p className="mt-1 text-xs text-muted-foreground">
                The sender keeps the task until it is accepted.
              </p>
            )}
            <DelegationActions request={row} />
          </div>
        ))}
      </div>
    </details>
  );
}

export function TaskDelegateDialog({
  task,
  deliverableId,
  onClose,
}: {
  task: Task;
  deliverableId?: string;
  onClose: () => void;
}) {
  const { account } = useAccount();
  const recipients = useQuery({
    queryKey: ["task-delegation-recipients", account?.id, task.id, task.project, task.business],
    queryFn: () =>
      api<{ id: string; name: string }[]>(
        `/tasks/${task.id}/delegation-recipients${deliverableId ? `?${new URLSearchParams({ project: task.project, business: task.business ?? "b0" })}` : ""}`,
      ),
    enabled: !isDemo && account?.role === "staff",
  });
  const query = useTaskDelegations();
  const client = useQueryClient();
  const [assignee, setAssignee] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = query.data?.find(
    (row) =>
      row.taskId === task.id &&
      (row.deliverableId ?? undefined) === deliverableId &&
      row.status === "pending",
  );
  const accepted = deliverableId
    ? query.data?.find(
        (row) =>
          row.taskId === task.id &&
          row.deliverableId === deliverableId &&
          row.status === "accepted",
      )
    : undefined;
  const eligible = recipients.data ?? [];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{deliverableId ? "Delegate deliverable" : "Delegate task"}</DialogTitle>
          <DialogDescription>
            {deliverableId
              ? "Only the selected deliverable is offered. The parent task stays assigned to you."
              : `${plainText(task.title)} stays assigned to you until the selected staff member accepts.`}{" "}
            On acceptance it appears in their weekly plan.
          </DialogDescription>
        </DialogHeader>
        {accepted ? (
          <p className="text-sm">
            Accepted by {accepted.recipient.name}. This deliverable is in their plan.
          </p>
        ) : pending ? (
          <div className="text-sm">
            <p>Awaiting {pending.recipient.name}'s response.</p>
            <DelegationActions request={pending} />
          </div>
        ) : (
          <>
            <label className="field-label">
              Delegate to
              <select
                className="field-input"
                value={assignee}
                disabled={busy || recipients.isPending || recipients.isError}
                onChange={(event) => setAssignee(event.target.value)}
              >
                <option value="">Choose staff member</option>
                {eligible.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
            {!eligible.length && !recipients.isPending && !recipients.isError && (
              <p className="text-sm text-muted-foreground">
                No eligible staff members are available for this task.
              </p>
            )}
          </>
        )}
        {recipients.isPending && (
          <p role="status" className="text-sm">
            Loading staff members...
          </p>
        )}
        {recipients.error && (
          <p role="alert" className="text-sm">
            {recipients.error.message}
          </p>
        )}
        {query.error && (
          <p role="alert" className="text-sm">
            {query.error.message}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Close
          </Button>
          {!pending && !accepted && (
            <Button
              type="button"
              disabled={
                busy ||
                !assignee ||
                query.isPending ||
                !!query.error ||
                recipients.isPending ||
                recipients.isError
              }
              onClick={async () => {
                setBusy(true);
                try {
                  if (
                    await perform(async () => {
                      await mutateApi(`/tasks/${task.id}/delegate`, {
                        method: "POST",
                        body: JSON.stringify({
                          assignee,
                          ...(deliverableId
                            ? { deliverableId, weekStart: task.weekStart, source: task }
                            : {}),
                        }),
                      });
                      await client.invalidateQueries({ queryKey: ["task-delegations"] });
                      await client.invalidateQueries({ queryKey: ["weekly"] });
                    }, "Delegation request sent")
                  )
                    onClose();
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Sending..." : "Send request"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
