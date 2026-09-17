import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatTone = "default" | "positive" | "warning" | "danger";

const TONE: Record<StatTone, string> = {
  default: "text-foreground",
  positive: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

/** A KPI tile. With `emptyText` it shows "—" in neutral colours so no data never looks healthy. */
export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  icon: Icon,
  emptyText,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatTone;
  icon?: ComponentType<{ className?: string }>;
  emptyText?: string;
  className?: string;
}) {
  const empty = !!emptyText;
  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold text-muted-foreground">{label}</div>
        {Icon && (
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary",
              empty ? "text-muted-foreground" : tone === "default" ? "text-primary" : TONE[tone],
            )}
            aria-hidden="true"
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div
        className={cn(
          "mt-2 text-xl font-semibold tabular-nums",
          empty ? "text-muted-foreground" : TONE[tone],
        )}
      >
        {empty ? "—" : value}
      </div>
      {(empty || hint) && (
        <div className="mt-1 text-xs text-muted-foreground">{empty ? emptyText : hint}</div>
      )}
    </div>
  );
}
