import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  useAddSystemFeature,
  useDeleteSystemFeature,
  useUpdateSystemFeature,
  FEATURE_STATUSES,
  FEATURE_STATUS_LABELS,
  FEATURE_STATUS_STYLES,
  type ItSystemDetail,
  type ItSystemFeatureRow,
  type FeatureStatus,
} from "@/features/it/use-it-systems";
import { confirmDialog } from "@/components/confirm-dialog";
import { FormField, RequiredNote } from "@/components/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Filter = FeatureStatus | "all";

/** What the system does, what's being built now and what's still planned. */
export function SystemFeaturesCard({
  system,
  canManage,
}: {
  system: ItSystemDetail;
  canManage: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<ItSystemFeatureRow | "new" | null>(null);
  const remove = useDeleteSystemFeature(system.id);
  const features = system.features;
  const shown = filter === "all" ? features : features.filter((f) => f.status === filter);

  const count = (status: Filter) =>
    status === "all" ? features.length : features.filter((f) => f.status === status).length;

  const handleDelete = async (feature: ItSystemFeatureRow) => {
    const ok = await confirmDialog({
      title: `Delete "${feature.title}"?`,
      description: `It will be removed from ${system.name}'s feature list. This can't be undone.`,
      confirmLabel: "Delete feature",
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(feature.id, {
      onSuccess: () => toast.success(`"${feature.title}" deleted`),
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Couldn't delete the feature"),
    });
  };

  const addButton = (
    <Button size="sm" onClick={() => setEditing("new")}>
      <Plus className="mr-1 h-4 w-4" /> Add feature
    </Button>
  );

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Features and work</h2>
          <p className="text-xs text-muted-foreground">
            What it does today, what's being built now and what's still planned.
          </p>
        </div>
        {canManage && addButton}
      </div>

      {features.length > 0 && (
        <div role="group" aria-label="Show features" className="flex flex-wrap gap-1">
          {(["all", ...FEATURE_STATUSES] as Filter[]).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                filter === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "all" ? "All" : FEATURE_STATUS_LABELS[value]} ({count(value)})
            </button>
          ))}
        </div>
      )}

      {features.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-card py-8 text-sm text-muted-foreground">
          <span>No features listed yet</span>
          {canManage && addButton}
        </div>
      ) : shown.length === 0 ? (
        <p className="rounded-lg border bg-card py-8 text-center text-sm text-muted-foreground">
          Nothing in {FEATURE_STATUS_LABELS[filter as FeatureStatus]}.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {shown.map((feature) => (
            <li key={feature.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{feature.title}</span>
                  <Badge variant="secondary" className={FEATURE_STATUS_STYLES[feature.status]}>
                    {FEATURE_STATUS_LABELS[feature.status]}
                  </Badge>
                </div>
                {feature.description && (
                  <p className="whitespace-pre-line text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                )}
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    aria-label={`Edit ${feature.title}`}
                    onClick={() => setEditing(feature)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ${feature.title}`}
                    disabled={remove.isPending}
                    onClick={() => handleDelete(feature)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <FeatureDialog systemId={system.id} value={editing} onClose={() => setEditing(null)} />
    </section>
  );
}

function FeatureDialog({
  systemId,
  value,
  onClose,
}: {
  systemId: string;
  value: ItSystemFeatureRow | "new" | null;
  onClose: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const { guardClose } = useUnsavedChanges(dirty);
  const close = () => {
    setDirty(false);
    onClose();
  };
  return (
    <Dialog open={!!value} onOpenChange={(open) => !open && guardClose(close)}>
      <DialogContent>
        {value && (
          <FeatureForm
            key={value === "new" ? "new" : value.id}
            systemId={systemId}
            value={value === "new" ? null : value}
            onDirtyChange={setDirty}
            onCancel={() => guardClose(close)}
            onDone={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FeatureForm({
  systemId,
  value,
  onDirtyChange,
  onCancel,
  onDone,
}: {
  systemId: string;
  value: ItSystemFeatureRow | null;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const add = useAddSystemFeature(systemId);
  const update = useUpdateSystemFeature(systemId);
  const [title, setTitle] = useState(value?.title ?? "");
  const [description, setDescription] = useState(value?.description ?? "");
  const [status, setStatus] = useState<FeatureStatus>(value?.status ?? "planned");
  const [titleError, setTitleError] = useState<string>();
  const saving = add.isPending || update.isPending;

  const dirty =
    title !== (value?.title ?? "") ||
    description !== (value?.description ?? "") ||
    status !== (value?.status ?? "planned");
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const submit = () => {
    if (title.trim().length < 2) {
      setTitleError("Give the feature a name");
      return;
    }
    const input = {
      title: title.trim(),
      description: description.trim() || null,
      status,
    };
    const done = (message: string) => () => {
      toast.success(message);
      onDone();
    };
    const failed = (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Couldn't save the feature");

    if (value) {
      update.mutate(
        { id: value.id, ...input },
        { onSuccess: done(`"${input.title}" updated`), onError: failed },
      );
    } else {
      add.mutate(input, { onSuccess: done(`"${input.title}" added`), onError: failed });
    }
  };

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>{value ? `Edit ${value.title}` : "Add feature"}</DialogTitle>
        <DialogDescription>
          Something this system does, or a piece of work being built into it.
        </DialogDescription>
      </DialogHeader>
      <RequiredNote />

      <div className="space-y-3">
        <FormField id="feature-title" label="Feature" required error={titleError}>
          <Input
            id="feature-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleError(undefined);
            }}
            placeholder="e.g. Online booking form"
            aria-invalid={!!titleError}
            aria-describedby={titleError ? "feature-title-error" : undefined}
          />
        </FormField>
        <FormField
          id="feature-description"
          label="What it does (optional)"
          hint="Enough detail for someone else to pick it up"
        >
          <Textarea
            id="feature-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </FormField>
        <FormField id="feature-status" label="Where it is now" required>
          <Select value={status} onValueChange={(v) => setStatus(v as FeatureStatus)}>
            <SelectTrigger id="feature-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FEATURE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {FEATURE_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {value ? "Save feature" : "Add feature"}
        </Button>
      </DialogFooter>
    </form>
  );
}
