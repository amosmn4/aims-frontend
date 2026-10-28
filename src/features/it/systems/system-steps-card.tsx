import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import {
  useSaveSystemStage,
  stepsInOrder,
  SDLC_STEP_HINTS,
  SDLC_STEP_LABELS,
  STAGE_STATUSES,
  STAGE_STATUS_LABELS,
  STAGE_STATUS_STYLES,
  type ItSystemDetail,
  type ItSystemStageRow,
  type SdlcStep,
  type StageStatus,
} from "@/features/it/use-it-systems";
import { ActionHint } from "@/components/help-link";
import { FormField } from "@/components/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { formatDate } from "@/lib/format-date";
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

const dateValue = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

/** The six steps of building a system, each with its own notes and dates. */
export function SystemStepsCard({
  system,
  canManage,
}: {
  system: ItSystemDetail;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<SdlcStep | null>(null);
  const steps = stepsInOrder(system);

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Steps to build it</h2>
        <p className="text-xs text-muted-foreground">
          What was decided and done at each step, from first idea to keeping it running.
        </p>
      </div>

      <ol className="divide-y rounded-lg border">
        {steps.map(({ stage, saved }, index) => {
          const status = saved?.status ?? "not_started";
          return (
            <li key={stage} className="flex items-start gap-3 px-3 py-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{SDLC_STEP_LABELS[stage]}</span>
                  <Badge variant="secondary" className={STAGE_STATUS_STYLES[status]}>
                    {STAGE_STATUS_LABELS[status]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{SDLC_STEP_HINTS[stage]}</p>
                {saved?.notes && <p className="whitespace-pre-line text-sm">{saved.notes}</p>}
                {(saved?.startedAt || saved?.doneAt) && (
                  <p className="text-xs text-muted-foreground">
                    {saved?.startedAt && `Started ${formatDate(saved.startedAt)}`}
                    {saved?.startedAt && saved?.doneAt && " · "}
                    {saved?.doneAt && `Finished ${formatDate(saved.doneAt)}`}
                  </p>
                )}
              </div>
              {canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0"
                  onClick={() => setEditing(stage)}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Edit {SDLC_STEP_LABELS[stage]}
                </Button>
              )}
            </li>
          );
        })}
      </ol>

      {canManage && (
        <ActionHint>
          Fill in each step as the work happens, so anyone can see where the build has reached.
        </ActionHint>
      )}

      <StepDialog
        systemId={system.id}
        stage={editing}
        saved={steps.find((s) => s.stage === editing)?.saved ?? null}
        onClose={() => setEditing(null)}
      />
    </section>
  );
}

function StepDialog({
  systemId,
  stage,
  saved,
  onClose,
}: {
  systemId: string;
  stage: SdlcStep | null;
  saved: ItSystemStageRow | null;
  onClose: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const { guardClose } = useUnsavedChanges(dirty);
  const close = () => {
    setDirty(false);
    onClose();
  };
  return (
    <Dialog open={!!stage} onOpenChange={(open) => !open && guardClose(close)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {stage && (
          <StepForm
            key={stage}
            systemId={systemId}
            stage={stage}
            saved={saved}
            onDirtyChange={setDirty}
            onCancel={() => guardClose(close)}
            onDone={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function StepForm({
  systemId,
  stage,
  saved,
  onDirtyChange,
  onCancel,
  onDone,
}: {
  systemId: string;
  stage: SdlcStep;
  saved: ItSystemStageRow | null;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const save = useSaveSystemStage(systemId);
  const [status, setStatus] = useState<StageStatus>(saved?.status ?? "not_started");
  const [notes, setNotes] = useState(saved?.notes ?? "");
  const [startedAt, setStartedAt] = useState(dateValue(saved?.startedAt ?? null));
  const [doneAt, setDoneAt] = useState(dateValue(saved?.doneAt ?? null));
  const [dateError, setDateError] = useState<string>();
  const label = SDLC_STEP_LABELS[stage];

  const dirty =
    status !== (saved?.status ?? "not_started") ||
    notes !== (saved?.notes ?? "") ||
    startedAt !== dateValue(saved?.startedAt ?? null) ||
    doneAt !== dateValue(saved?.doneAt ?? null);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const submit = () => {
    if (startedAt && doneAt && doneAt < startedAt) {
      setDateError("The finish date can't be before the start date");
      return;
    }
    save.mutate(
      {
        stage,
        status,
        notes: notes.trim() || null,
        startedAt: startedAt || null,
        doneAt: doneAt || null,
      },
      {
        onSuccess: () => {
          toast.success(`${label} saved`);
          onDone();
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : `Couldn't save ${label}`),
      },
    );
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
        <DialogTitle>{label}</DialogTitle>
        <DialogDescription>{SDLC_STEP_HINTS[stage]}.</DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <FormField id="step-status" label="How far this step has got">
          <Select value={status} onValueChange={(v) => setStatus(v as StageStatus)}>
            <SelectTrigger id="step-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STAGE_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField
          id="step-notes"
          label="What was decided or done (optional)"
          hint="Anyone picking this up later should understand it from these notes"
        >
          <Textarea
            id="step-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            placeholder={`e.g. what ${label.toLowerCase()} covered, who was involved and what was agreed`}
          />
        </FormField>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField id="step-started" label="Started on (optional)" error={dateError}>
            <Input
              id="step-started"
              type="date"
              value={startedAt}
              onChange={(e) => {
                setStartedAt(e.target.value);
                setDateError(undefined);
              }}
              aria-invalid={!!dateError}
              aria-describedby={dateError ? "step-started-error" : undefined}
            />
          </FormField>
          <FormField id="step-done" label="Finished on (optional)">
            <Input
              id="step-done"
              type="date"
              value={doneAt}
              onChange={(e) => {
                setDoneAt(e.target.value);
                setDateError(undefined);
              }}
            />
          </FormField>
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save {label}
        </Button>
      </DialogFooter>
    </form>
  );
}
