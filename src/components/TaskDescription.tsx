import { SafeHtml } from "@/production/components/safe-html";
import { checklistProgress, taskDescription, type Deliverable } from "@/lib/task-content";

export function TaskDescription({
  description,
  items,
  onChange,
  disabled = false,
}: {
  description?: string | null | undefined;
  items?: Deliverable[] | undefined;
  onChange?: ((html: string) => void) | undefined;
  disabled?: boolean | undefined;
}) {
  const html = taskDescription(description, items);
  const progress = checklistProgress(html);
  if (!html) return null;
  return (
    <div
      className="task-description space-y-2"
      onClick={(event) => {
        if (!onChange || disabled || !(event.target instanceof HTMLInputElement)) return;
        const inputs = Array.from(
          event.currentTarget.querySelectorAll('li[data-type="taskItem"] > label > input'),
        );
        const index = inputs.indexOf(event.target);
        const document = new DOMParser().parseFromString(html, "text/html");
        const item = document.querySelectorAll('li[data-type="taskItem"]')[index];
        if (!item) return;
        item.setAttribute("data-checked", String(event.target.checked));
        item.querySelector("input")?.toggleAttribute("checked", event.target.checked);
        onChange(document.body.innerHTML);
      }}
    >
      <SafeHtml
        html={html}
        taskContent
        checkboxEditable={!!onChange && !disabled}
        className="blog-content text-sm font-normal"
      />
      {progress.total > 0 && (
        <p className="text-xs text-muted-foreground">
          {progress.done}/{progress.total} completed
        </p>
      )}
    </div>
  );
}
