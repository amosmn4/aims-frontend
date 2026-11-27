import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SafeHtml } from "@/production/components/safe-html";
import {
  checklistProgress,
  checklistSummary,
  deliverableStatuses,
  ensureChecklistIds,
  taskDescription,
  type Deliverable,
  type DeliverableStatus,
} from "@/lib/task-content";
import { DeliverableControls } from "./DeliverableControls";
import { TaskStatusBadge } from "./TaskStatusBadge";

type ActionTarget = {
  host: HTMLElement;
  statusHost: HTMLElement;
  id: string;
  title: string;
  status: DeliverableStatus;
  date: string | null;
};

export function TaskDescription({
  description,
  items,
  onChange,
  disabled = false,
  week,
  onDelegate,
}: {
  description?: string | null | undefined;
  items?: Deliverable[] | undefined;
  onChange?: ((html: string) => void) | undefined;
  disabled?: boolean | undefined;
  week?: string | null | undefined;
  onDelegate?: ((id: string, html: string) => void) | undefined;
}) {
  const html = useMemo(
    () => ensureChecklistIds(taskDescription(description, items)),
    [description, items],
  );
  const progress = checklistProgress(html);
  const [targets, setTargets] = useState<ActionTarget[]>([]);
  const ready = useCallback((container: HTMLDivElement) => {
    const rows = Array.from(container.querySelectorAll<HTMLElement>('li[data-type="taskItem"]'));
    setTargets(
      rows.map((row) => {
        Array.from(row.children)
          .filter(
            (child) =>
              child.tagName === "LABEL" ||
              child.hasAttribute("data-deliverable-actions") ||
              child.hasAttribute("data-deliverable-status"),
          )
          .forEach((child) => child.remove());
        row.classList.add("deliverable-row");
        row.querySelector(":scope > div")?.classList.add("deliverable-content");
        const host = document.createElement("span");
        host.setAttribute("data-deliverable-actions", "");
        const statusHost = document.createElement("span");
        statusHost.setAttribute("data-deliverable-status", "");
        statusHost.className = "deliverable-status";
        row.append(statusHost, host);
        const raw = row.getAttribute("data-status");
        return {
          host,
          statusHost,
          id: row.getAttribute("data-did") ?? "",
          title: row.querySelector("p")?.textContent || "Deliverable",
          status:
            raw && Object.prototype.hasOwnProperty.call(deliverableStatuses, raw)
              ? (raw as DeliverableStatus)
              : row.getAttribute("data-checked") === "true"
                ? "completed"
                : "pending",
          date: row.getAttribute("data-target-date"),
        };
      }),
    );
  }, []);
  if (!html) return null;
  return (
    <div className="task-description space-y-2">
      <SafeHtml
        html={html}
        taskContent
        onContentReady={ready}
        className="blog-content text-sm font-normal"
      />
      {targets.flatMap((target) => [
        createPortal(
          <TaskStatusBadge status={target.status} />,
          target.statusHost,
          `${target.id}-status`,
        ),
        createPortal(
          <DeliverableControls
            title={target.title}
            status={target.status}
            targetDate={target.date}
            week={week}
            disabled={disabled}
            onDelegate={onDelegate ? () => onDelegate(target.id, html) : undefined}
            onChange={
              onChange
                ? (status, date) => {
                    const document = new DOMParser().parseFromString(html, "text/html");
                    const row = Array.from(
                      document.querySelectorAll('li[data-type="taskItem"]'),
                    ).find((item) => item.getAttribute("data-did") === target.id);
                    if (!row) return;
                    row.setAttribute("data-status", status);
                    row.setAttribute("data-checked", String(status === "completed"));
                    row.removeAttribute("data-carry-parent");
                    const undo =
                      status === "pending" && ["forwarded", "postponed"].includes(target.status);
                    if (status === "forwarded" || status === "postponed" || undo)
                      row.querySelectorAll('li[data-type="taskItem"]').forEach((child) => {
                        if (
                          child.getAttribute("data-checked") === "true" ||
                          ["cancelled", "delegated"].includes(
                            child.getAttribute("data-status") ?? "",
                          ) ||
                          (undo && child.getAttribute("data-carry-parent") !== target.id) ||
                          (!undo &&
                            ["forwarded", "postponed"].includes(
                              child.getAttribute("data-status") ?? "",
                            ) &&
                            child.getAttribute("data-carry-parent") !== target.id)
                        )
                          return;
                        child.setAttribute("data-status", status);
                        child.setAttribute("data-checked", "false");
                        if (date) child.setAttribute("data-target-date", date);
                        else child.removeAttribute("data-target-date");
                        if (undo) child.removeAttribute("data-carry-parent");
                        else child.setAttribute("data-carry-parent", target.id);
                      });
                    if (date) row.setAttribute("data-target-date", date);
                    else row.removeAttribute("data-target-date");
                    row
                      .querySelector(":scope > label > input")
                      ?.toggleAttribute("checked", status === "completed");
                    onChange(document.body.innerHTML);
                  }
                : undefined
            }
          />,
          target.host,
          target.id,
        ),
      ])}
      {progress.total > 0 && (
        <div className="text-xs text-muted-foreground">
          <p>
            {progress.done}/{progress.total} completed
          </p>
          <p>{checklistSummary(html)}</p>
        </div>
      )}
    </div>
  );
}
