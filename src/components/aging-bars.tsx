import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export type AgingTone = "ok" | "watch" | "late" | "bad";

const BAR_TONE: Record<AgingTone, string> = {
  ok: "bg-success",
  watch: "bg-primary",
  late: "bg-warning",
  bad: "bg-destructive",
};

const TEXT_TONE: Record<AgingTone, string> = {
  ok: "text-success",
  watch: "text-foreground",
  late: "text-warning",
  bad: "text-destructive",
};

export interface AgingRow {
  /** How old, in plain words: "1–30 days late". */
  label: string;
  count: number;
  /** Money or any extra figure shown next to the count. */
  detail?: ReactNode;
  tone: AgingTone;
  to?: string;
  search?: Record<string, string | number | boolean>;
}

/** How long things have been waiting, oldest group worst. Used for unpaid bills and open tickets. */
export function AgingBars({
  rows,
  countLabel,
  emptyText,
}: {
  rows: AgingRow[];
  /** What one item is, for screen readers: "invoices" or "tickets". */
  countLabel: string;
  emptyText: string;
}) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  if (total === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2.5">
      {rows.map((row) => {
        const body = (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{row.label}</span>
              <span className="flex items-baseline gap-2">
                {row.detail && <span className="text-xs text-muted-foreground">{row.detail}</span>}
                <span className={cn("tabular-nums font-semibold", TEXT_TONE[row.tone])}>
                  {row.count}
                </span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn("h-full rounded-full", BAR_TONE[row.tone])}
                style={{ width: `${Math.max(row.count > 0 ? 4 : 0, (row.count / max) * 100)}%` }}
              />
            </div>
          </>
        );
        return (
          <li key={row.label}>
            {row.to ? (
              <Link
                to={row.to}
                search={row.search}
                aria-label={`${row.count} ${countLabel} ${row.label}`}
                className="block rounded px-1 py-0.5 -mx-1 hover:bg-secondary/40"
              >
                {body}
              </Link>
            ) : (
              <div className="px-1 py-0.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
