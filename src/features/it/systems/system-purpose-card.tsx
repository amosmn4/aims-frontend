import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { useUpdateItSystem, type ItSystemDetail } from "@/features/it/use-it-systems";
import { FormField } from "@/components/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** "What it does" in plain words, edited right where it's read. */
export function SystemPurposeCard({
  system,
  canManage,
}: {
  system: ItSystemDetail;
  canManage: boolean;
}) {
  const update = useUpdateItSystem(system.id);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(system.purpose ?? "");

  const dirty = editing && text !== (system.purpose ?? "");
  const { guardClose } = useUnsavedChanges(dirty);

  useEffect(() => {
    if (!editing) setText(system.purpose ?? "");
  }, [editing, system.purpose]);

  const submit = () =>
    update.mutate(
      { purpose: text },
      {
        onSuccess: () => {
          toast.success("What it does saved");
          setEditing(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save it"),
      },
    );

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">What it does</h2>
          <p className="text-xs text-muted-foreground">
            What this is for and who uses it, in plain words.
          </p>
        </div>
        {canManage && !editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            {system.purpose ? "Edit what it does" : "Add what it does"}
          </Button>
        )}
      </div>

      {editing ? (
        <form
          className="space-y-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <FormField id="system-purpose-inline" label="What it does">
            <Textarea
              id="system-purpose-inline"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="e.g. The company website where clients find our services and get in touch."
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={update.isPending}
              onClick={() => guardClose(() => setEditing(false))}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={update.isPending}>
              {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save what it does
            </Button>
          </div>
        </form>
      ) : system.purpose ? (
        <p className="whitespace-pre-line text-sm">{system.purpose}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing written down yet.</p>
      )}
    </section>
  );
}
