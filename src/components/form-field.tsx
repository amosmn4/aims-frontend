import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Label + control + hint, with the error message shown right under the field.
export function FormField({
  id,
  label,
  error,
  hint,
  required,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  /** Marks the field as required with a visible asterisk. */
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** One line under a form title: "Fields marked * are required." */
export function RequiredNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Fields marked <span className="text-destructive">*</span> are required.
    </p>
  );
}
