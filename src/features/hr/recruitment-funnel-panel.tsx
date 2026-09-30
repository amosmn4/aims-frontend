import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Loader2 } from "lucide-react";
import {
  useRecruitmentFunnel,
  useSaveRecruitmentFunnel,
  funnelError,
  FUNNEL_STAGE_LABELS,
  type FunnelStageKey,
  type RecruitmentFunnelRow,
} from "@/features/hr/use-recruitment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoadError } from "@/components/load-error";
import { formatDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";

export const FUNNEL_STAGES: FunnelStageKey[] = [
  "applications_received",
  "screened",
  "interviewed",
  "offered",
  "placed",
];

const SHORT_LABELS: Record<FunnelStageKey, string> = {
  applications_received: "Applied",
  screened: "Screened",
  interviewed: "Interviewed",
  offered: "Offered",
  placed: "Placed",
};

const toValues = (f: RecruitmentFunnelRow | null | undefined) =>
  Object.fromEntries(FUNNEL_STAGES.map((k) => [k, String(f?.[k] ?? 0)])) as Record<
    FunnelStageKey,
    string
  >;

/** Recruitment stage counts for one project, edited in place. */
export function RecruitmentFunnelPanel({
  projectId,
  canManage,
  onSaved,
  onDirtyChange,
}: {
  projectId: string;
  canManage: boolean;
  onSaved?: () => void;
  /** Lets a host dialog warn before closing with unsaved numbers. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const funnelQ = useRecruitmentFunnel(projectId);
  const save = useSaveRecruitmentFunnel(projectId);
  const [values, setValues] = useState(() => toValues(null));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (funnelQ.data !== undefined) {
      setValues(toValues(funnelQ.data));
      setNotes(funnelQ.data?.notes ?? "");
    }
  }, [funnelQ.data]);

  const numbers = Object.fromEntries(
    FUNNEL_STAGES.map((k) => [k, Math.max(0, Number(values[k]) || 0)]),
  ) as Record<FunnelStageKey, number>;
  const error = funnelError(numbers);
  const original = toValues(funnelQ.data);
  const dirty =
    FUNNEL_STAGES.some((k) => String(numbers[k]) !== original[k]) ||
    notes !== (funnelQ.data?.notes ?? "");

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const submit = () => {
    if (error) return;
    save.mutate(
      {
        applicationsReceived: numbers.applications_received,
        screened: numbers.screened,
        interviewed: numbers.interviewed,
        offered: numbers.offered,
        placed: numbers.placed,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Recruitment numbers saved");
          onSaved?.();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
      },
    );
  };

  if (funnelQ.isError) {
    return (
      <LoadError
        what="recruitment numbers"
        error={funnelQ.error}
        onRetry={() => funnelQ.refetch()}
      />
    );
  }

  if (funnelQ.isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Totals only, not individual candidates — add named placements below.
      </p>
      <div className="flex flex-wrap items-stretch gap-1.5">
        {FUNNEL_STAGES.map((k, i) => {
          const prev = i > 0 ? numbers[FUNNEL_STAGES[i - 1]] : null;
          const rate = prev ? Math.round((numbers[k] / prev) * 100) : null;
          const invalid = prev != null && numbers[k] > prev;
          return (
            <div key={k} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <label
                className={cn(
                  "flex w-24 flex-col rounded-lg border bg-background p-2 text-center",
                  invalid && "border-destructive",
                )}
              >
                <span className="text-xs font-medium text-muted-foreground">{SHORT_LABELS[k]}</span>
                {canManage ? (
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={values[k]}
                    onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
                    className="mt-1 h-8 border-0 p-0 text-center text-lg font-semibold tabular-nums shadow-none focus-visible:ring-0"
                    aria-label={FUNNEL_STAGE_LABELS[k]}
                  />
                ) : (
                  <span className="mt-1 text-lg font-semibold tabular-nums">{numbers[k]}</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {rate != null ? `${rate}% of previous` : " "}
                </span>
              </label>
            </div>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {canManage && (
        <>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notes (optional) — e.g. shortlist sent to client on 12 Sept"
            aria-label="Notes (optional)"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {funnelQ.data?.updated_at
                ? `Last updated ${formatDate(funnelQ.data.updated_at)}`
                : "Not updated yet"}
            </span>
            <Button size="sm" onClick={submit} disabled={!dirty || !!error || save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Save numbers
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
