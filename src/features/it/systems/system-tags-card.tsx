import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { useUpdateItSystem } from "@/features/it/use-it-systems";
import { FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MAX_NAMES = 40;
const MAX_LENGTH = 60;

/** A named list of things, e.g. the tech stack or the tools the team uses. */
export function SystemTagsCard({
  systemId,
  field,
  title,
  hint,
  names,
  placeholder,
  addLabel,
  emptyText,
  canManage,
}: {
  systemId: string;
  field: "techStack" | "tools";
  title: string;
  hint: string;
  names: string[];
  placeholder: string;
  /** Names the thing being added, e.g. "Add tool". */
  addLabel: string;
  emptyText: string;
  canManage: boolean;
}) {
  const update = useUpdateItSystem(systemId);
  const [entry, setEntry] = useState("");
  const [error, setError] = useState<string>();
  const inputId = `${field}-entry`;

  const save = (next: string[], message: string) =>
    update.mutate(
      { [field]: next },
      {
        onSuccess: () => toast.success(message),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : `Couldn't save ${title.toLowerCase()}`),
      },
    );

  const add = () => {
    const name = entry.trim();
    if (!name) {
      setError(`Type a name first, then click ${addLabel}`);
      return;
    }
    if (name.length > MAX_LENGTH) {
      setError(`Keep it under ${MAX_LENGTH} characters`);
      return;
    }
    if (names.some((n) => n.toLowerCase() === name.toLowerCase())) {
      setError(`${name} is already in the list`);
      return;
    }
    if (names.length >= MAX_NAMES) {
      setError(`You can list up to ${MAX_NAMES}`);
      return;
    }
    setEntry("");
    setError(undefined);
    save([...names, name], `${name} added`);
  };

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>

      {names.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {names.map((name) => (
            <li key={name}>
              <Badge variant="secondary" className="gap-1 pr-1 font-normal">
                {name}
                {canManage && (
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    disabled={update.isPending}
                    onClick={() =>
                      save(
                        names.filter((n) => n !== name),
                        `${name} removed`,
                      )
                    }
                    className="rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <form
          className="flex items-start gap-2"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <FormField id={inputId} label={addLabel} className="flex-1" error={error}>
            <Input
              id={inputId}
              value={entry}
              onChange={(e) => {
                setEntry(e.target.value);
                setError(undefined);
              }}
              placeholder={placeholder}
              aria-invalid={!!error}
              aria-describedby={error ? `${inputId}-error` : undefined}
            />
          </FormField>
          <Button type="submit" size="sm" className="mt-6" disabled={update.isPending}>
            {update.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-1 h-4 w-4" />
            )}
            {addLabel}
          </Button>
        </form>
      )}
    </section>
  );
}
