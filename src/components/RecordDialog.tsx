import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Delete, Edit } from "./icons";
import { perform, removeRecord } from "@/lib/workspace";
import type { Collection } from "@/lib/models";
import { RichTextEditor } from "@/production/features/marketing/rich-text-editor";

export type Option = { value: string; label: string };
type Values = Record<string, string | number | string[]>;
export type Field<T extends Values> = {
  name: keyof T & string;
  label: string;
  type?:
    "text" | "email" | "number" | "date" | "month" | "textarea" | "richtext" | "select" | "multi";
  options?: Option[];
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  help?: string;
};

export function RecordDialog<T extends Values>({
  title,
  description = "Complete the fields below and save your changes.",
  initial,
  fields,
  extra,
  onSave,
  onClose,
}: {
  title: string;
  description?: string;
  initial: T;
  fields: Field<T>[] | ((values: T) => Field<T>[]);
  extra?: React.ReactNode;
  onSave: (values: T) => void | boolean | Promise<void | boolean>;
  onClose: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            setBusy(true);
            try {
              const saved = await onSave(values);
              if (saved !== false) {
                toast.success("Changes saved");
                onClose();
              }
            } catch (error) {
              setError(
                error instanceof z.ZodError
                  ? error.issues
                      .map((issue) => `${issue.path.join(" ")}: ${issue.message}`)
                      .join(". ")
                  : error instanceof Error
                    ? error.message
                    : "Unable to save your changes.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {extra}
          {(typeof fields === "function" ? fields(values) : fields).map((field) => {
            const value = values[field.name];
            const change = (value: string | number | string[]) =>
              setValues((previous) => ({ ...previous, [field.name]: value }));
            if (field.type === "multi")
              return (
                <fieldset key={field.name} className="rounded-lg border p-3">
                  <legend className="px-1 text-sm font-medium">
                    {field.label}
                    {field.required ? " *" : ""}
                  </legend>
                  <div className="grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">
                    {field.options?.map((option) => (
                      <label key={option.value} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Array.isArray(value) && value.includes(option.value)}
                          onChange={(event) =>
                            change(
                              event.target.checked
                                ? [...(Array.isArray(value) ? value : []), option.value]
                                : (Array.isArray(value) ? value : []).filter(
                                    (item) => item !== option.value,
                                  ),
                            )
                          }
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                  {field.help && <p className="mt-2 text-xs text-muted-foreground">{field.help}</p>}
                </fieldset>
              );
            return (
              <label className="field-label" key={field.name}>
                {field.label}
                {field.required ? " *" : ""}
                {field.type === "richtext" ? (
                  <RichTextEditor value={String(value ?? "")} onChange={(next) => change(next)} />
                ) : field.type === "textarea" ? (
                  <textarea
                    aria-label={field.label}
                    className="field-input"
                    rows={3}
                    required={field.required}
                    maxLength={10000}
                    value={String(value ?? "")}
                    onChange={(event) => change(event.target.value)}
                  />
                ) : field.type === "select" ? (
                  <select
                    aria-label={field.label}
                    className="field-input"
                    required={field.required}
                    value={String(value ?? "")}
                    onChange={(event) => change(event.target.value)}
                  >
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    aria-label={field.label}
                    className="field-input"
                    type={field.type ?? "text"}
                    required={field.required}
                    min={field.min}
                    max={field.max}
                    step={field.type === "number" ? (field.step ?? "any") : undefined}
                    maxLength={field.type === "email" ? 200 : 500}
                    value={String(value ?? "")}
                    onChange={(event) =>
                      change(
                        field.type === "number" && event.target.value !== ""
                          ? Number(event.target.value)
                          : event.target.value,
                      )
                    }
                  />
                )}
                {field.help && (
                  <span className="text-xs font-normal text-muted-foreground">{field.help}</span>
                )}
              </label>
            );
          })}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RecordActions({
  collection,
  id,
  label,
  onEdit,
  onDelete,
}: {
  collection: Collection;
  id: string;
  label: string;
  onEdit: () => void;
  onDelete?: (() => void | Promise<void>) | undefined;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex shrink-0 gap-1">
      <Button size="sm" variant="ghost" aria-label={`Edit ${label}`} title="Edit" onClick={onEdit}>
        <Edit className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Delete ${label}`}
        title="Delete"
        onClick={() => setConfirm(true)}
      >
        <Delete className="h-4 w-4" />
      </Button>
      {confirm && (
        <Dialog open onOpenChange={setConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {label}-</DialogTitle>
              <DialogDescription>
                Records linked elsewhere must be unlinked before deletion.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirm(false)} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    if (onDelete) {
                      await onDelete();
                      toast.success("Record deleted");
                      setConfirm(false);
                    } else if (await perform(() => removeRecord(collection, id), "Record deleted"))
                      setConfirm(false);
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "The record could not be deleted.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = "Search records",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="search"
      aria-label={placeholder}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="field-input mb-5 max-w-sm"
    />
  );
}

export function EmptyState({
  children = "No records match your selection.",
}: {
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
