import AddOutlined from "@mui/icons-material/AddOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import { RichTextEditor } from "@/production/features/marketing/rich-text-editor";
import { SafeHtml } from "@/production/components/safe-html";
import { deliverableStatus, deliverableStatuses, type Deliverable } from "@/lib/task-content";
import { plainText } from "@/lib/text";

export function TaskDeliverables({
  items,
  onChange,
  disabled = false,
  label = "Deliverables",
}: {
  items: Deliverable[];
  onChange?: ((items: Deliverable[]) => void) | undefined;
  disabled?: boolean;
  label?: string;
}) {
  const update = (id: string, value: Partial<Deliverable>) =>
    onChange?.(items.map((item) => (item.id === id ? { ...item, ...value } : item)));
  return (
    <fieldset className="min-w-0 space-y-3 rounded-lg border bg-background p-3">
      <legend className="px-1 text-sm font-semibold">{label}</legend>
      {items.map((item, index) => (
        <div key={item.id} className="min-w-0 space-y-3 rounded-md border p-3">
          <div className="flex flex-wrap items-center gap-2">
            {onChange ? (
              <input
                className="field-input min-w-0 flex-1"
                aria-label={`${label} ${index + 1} title`}
                value={item.title}
                required
                maxLength={200}
                disabled={disabled}
                placeholder="e.g. Create shortlist"
                onChange={(event) => update(item.id, { title: event.target.value })}
              />
            ) : (
              <strong className="min-w-0 flex-1">{plainText(item.title)}</strong>
            )}
            <select
              className="field-input w-auto"
              aria-label={`${label} ${index + 1} status`}
              value={deliverableStatus(item)}
              disabled={disabled || !onChange}
              onChange={(event) =>
                update(item.id, {
                  status: event.target.value as Deliverable["status"],
                  done: event.target.value === "completed",
                })
              }
            >
              {Object.entries(deliverableStatuses).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
            {onChange && (
              <button
                type="button"
                className="btn secondary sm inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                disabled={disabled}
                aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
                onClick={() => onChange(items.filter((row) => row.id !== item.id))}
              >
                <DeleteOutline fontSize="small" />
              </button>
            )}
          </div>
          {onChange ? (
            <RichTextEditor
              value={item.detail ?? ""}
              disabled={disabled}
              ariaLabel={`${label} ${index + 1} notes`}
              onChange={(detail) => update(item.id, { detail })}
            />
          ) : (
            item.detail && <SafeHtml html={item.detail} className="blog-content text-sm" />
          )}
        </div>
      ))}
      {onChange && (
        <>
          <p className="text-xs text-muted-foreground">
            Add a deliverable for each result. Use indented bullets in its notes for the steps
            underneath it.
          </p>
          <button
            type="button"
            className="btn secondary sm inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            disabled={disabled || items.length >= 100}
            onClick={() =>
              onChange([
                ...items,
                { id: crypto.randomUUID(), title: "", detail: "", done: false, status: "pending" },
              ])
            }
          >
            <AddOutlined fontSize="small" /> Add deliverable
          </button>
        </>
      )}
    </fieldset>
  );
}
