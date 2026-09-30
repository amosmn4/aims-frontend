import { useState } from "react";
import { Loader2, RotateCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DELTA_ARROW,
  DELTA_TONE,
  SOURCE_LABEL,
  SOURCE_TONE,
  figureDelta,
  formatFigure,
  formatSystemValue,
  isCorrected,
  movedALot,
} from "./report-format";
import type { FigureSource, ReportFigure } from "./use-reports";

/** Says where a value came from: AIMS, the person, or an AI draft. */
export function ProvenanceChip({
  source,
  label,
  className,
}: {
  source: FigureSource;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        SOURCE_TONE[source],
        className,
      )}
    >
      {label ?? SOURCE_LABEL[source]}
    </span>
  );
}

const applyValue = (f: ReportFigure, raw: string): ReportFigure => {
  const trimmed = raw.trim();
  let value: number | string | null;
  if (trimmed === "") {
    value = null;
  } else if (f.format === "text") {
    value = trimmed;
  } else {
    const n = Number(trimmed);
    value = Number.isFinite(n) ? n : f.value;
  }
  const hasSystem = f.systemValue !== null && f.systemValue !== undefined;
  const same = String(value ?? "") === String(f.systemValue ?? "");
  const source: FigureSource = hasSystem && same ? "aims" : "typed";
  return { ...f, value, source };
};

/**
 * The period's numbers: what they are, how they moved, where each came from, and
 * why anyone changed one.
 */
export function ReportFigures({
  figures,
  readOnly = false,
  previousLabel,
  onChange,
  aiEnabled = false,
  onExplain,
  explainingKey,
  onRefresh,
  refreshing = false,
}: {
  figures: ReportFigure[];
  readOnly?: boolean;
  /** The period these figures are compared against, e.g. "August". */
  previousLabel?: string;
  onChange?: (next: ReportFigure[]) => void;
  aiEnabled?: boolean;
  onExplain?: (figureKey: string) => void;
  explainingKey?: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const update = (key: string, next: (f: ReportFigure) => ReportFigure) =>
    onChange?.(figures.map((f) => (f.key === key ? next(f) : f)));

  if (figures.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm">
        <p className="font-medium">AIMS couldn't work out your figures</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The numbers didn't load, so nothing has been filled in. Try again, or write the report
          yourself — you won't lose anything either way.
        </p>
        {onRefresh && !readOnly && (
          <Button size="sm" variant="outline" className="mt-2" onClick={onRefresh}>
            {refreshing ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <RotateCw className="mr-1 h-4 w-4" />
            )}
            Get the figures again
          </Button>
        )}
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {figures.map((f) => {
        const delta = figureDelta(f);
        const corrected = isCorrected(f);
        const showNote = !readOnly && (corrected || !!f.note);
        const raw =
          drafts[f.key] ?? (f.value === null || f.value === undefined ? "" : String(f.value));
        return (
          <li
            key={f.key}
            className={cn(
              "rounded-md border bg-card p-3",
              corrected && "border-warning/40 bg-warning/5",
            )}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="min-w-[8rem] flex-1 text-sm">{f.label}</span>

              {readOnly ? (
                <span className="text-sm font-semibold tabular-nums">{formatFigure(f)}</span>
              ) : (
                <div className="flex items-center gap-1">
                  {f.format === "money" && (
                    <span className="text-xs text-muted-foreground">{f.unit ?? "KES"}</span>
                  )}
                  <Input
                    aria-label={f.label}
                    className="h-8 w-28 tabular-nums"
                    inputMode={f.format === "text" ? "text" : "decimal"}
                    value={raw}
                    onChange={(e) => {
                      const next = e.target.value;
                      setDrafts((d) => ({ ...d, [f.key]: next }));
                      update(f.key, (fig) => applyValue(fig, next));
                    }}
                  />
                  {f.format === "percent" && (
                    <span className="text-xs text-muted-foreground">%</span>
                  )}
                </div>
              )}

              {delta && (
                <span className={cn("text-xs tabular-nums", DELTA_TONE[delta.direction])}>
                  {DELTA_ARROW[delta.direction]} {delta.text}
                  {previousLabel && delta.direction !== "flat" ? ` vs ${previousLabel}` : ""}
                </span>
              )}

              <ProvenanceChip source={f.source} label={corrected ? "Corrected" : undefined} />

              {aiEnabled && !readOnly && movedALot(f) && onExplain && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => onExplain(f.key)}
                  disabled={explainingKey === f.key}
                >
                  {explainingKey === f.key ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1 h-3 w-3" />
                  )}
                  Explain this change
                </Button>
              )}
            </div>

            {corrected && (
              <p className="mt-1 text-xs text-muted-foreground">
                AIMS computed {formatSystemValue(f)}
                {readOnly && f.note ? ` · “${f.note}”` : ""}
              </p>
            )}
            {!corrected && readOnly && f.note && (
              <p className="mt-1 text-xs text-muted-foreground">“{f.note}”</p>
            )}

            {showNote && (
              <div className="mt-2">
                <label htmlFor={`note-${f.key}`} className="text-xs text-muted-foreground">
                  Why did you change it? The reviewer sees this beside the number.
                </label>
                <Input
                  id={`note-${f.key}`}
                  className="mt-1 h-8 text-sm"
                  placeholder="e.g. Four of them were duplicates"
                  value={f.note ?? ""}
                  onChange={(e) => {
                    const note = e.target.value;
                    update(f.key, (fig) => ({ ...fig, note }));
                  }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
