import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  useSaveItSystem,
  IT_SYSTEM_TYPE_LABELS,
  IT_SYSTEM_STATUS_LABELS,
  SDLC_STEPS,
  SDLC_STEP_LABELS,
  type ItSystemRow,
  type ItSystemStatus,
  type ItSystemType,
  type SdlcStep,
} from "@/features/it/use-it-systems";
import { FormField, RequiredNote } from "@/components/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
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

const NO_STEP = "none";

/** Add or edit a system or site, including what it does and how far along it is. */
export function SystemFormDialog({
  value,
  onClose,
  onSaved,
}: {
  /** An existing system, "new" for a blank form, or null when closed. */
  value: ItSystemRow | "new" | null;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const [dirty, setDirty] = useState(false);
  const { guardClose } = useUnsavedChanges(dirty);
  const close = () => {
    setDirty(false);
    onClose();
  };
  return (
    <Dialog open={!!value} onOpenChange={(open) => !open && guardClose(close)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {value && (
          <SystemForm
            key={value === "new" ? "new" : value.id}
            value={value === "new" ? null : value}
            onDirtyChange={setDirty}
            onCancel={() => guardClose(close)}
            onDone={(id) => {
              close();
              onSaved?.(id);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type Errors = Partial<Record<"name" | "repoUrl" | "docsUrl" | "liveUrl" | "progress", string>>;

const isWebAddress = (v: string) => /^https?:\/\/\S+$/i.test(v.trim());

function SystemForm({
  value,
  onDirtyChange,
  onCancel,
  onDone,
}: {
  value: ItSystemRow | null;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onDone: (id: string) => void;
}) {
  const save = useSaveItSystem();
  const [name, setName] = useState(value?.name ?? "");
  const [type, setType] = useState<ItSystemType>(value?.type ?? "website");
  const [status, setStatus] = useState<ItSystemStatus>(value?.status ?? "active");
  const [owner, setOwner] = useState(value?.owner ?? "");
  const [purpose, setPurpose] = useState(value?.purpose ?? "");
  const [repoUrl, setRepoUrl] = useState(value?.repoUrl ?? "");
  const [docsUrl, setDocsUrl] = useState(value?.docsUrl ?? "");
  const [liveUrl, setLiveUrl] = useState(value?.liveUrl ?? "");
  const [step, setStep] = useState<SdlcStep | typeof NO_STEP>(value?.currentStage ?? NO_STEP);
  const [progress, setProgress] = useState(
    value?.progressPercent == null ? "" : String(value.progressPercent),
  );
  const [notes, setNotes] = useState(value?.notes ?? "");
  const [errors, setErrors] = useState<Errors>({});

  const dirty =
    name !== (value?.name ?? "") ||
    type !== (value?.type ?? "website") ||
    status !== (value?.status ?? "active") ||
    owner !== (value?.owner ?? "") ||
    purpose !== (value?.purpose ?? "") ||
    repoUrl !== (value?.repoUrl ?? "") ||
    docsUrl !== (value?.docsUrl ?? "") ||
    liveUrl !== (value?.liveUrl ?? "") ||
    step !== (value?.currentStage ?? NO_STEP) ||
    progress !== (value?.progressPercent == null ? "" : String(value.progressPercent)) ||
    notes !== (value?.notes ?? "");
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const submit = () => {
    const found: Errors = {};
    if (!name.trim()) found.name = "Enter the name of the system or site";
    const addressError = "Enter a full web address, starting with https://";
    if (repoUrl.trim() && !isWebAddress(repoUrl)) found.repoUrl = addressError;
    if (docsUrl.trim() && !isWebAddress(docsUrl)) found.docsUrl = addressError;
    if (liveUrl.trim() && !isWebAddress(liveUrl)) found.liveUrl = addressError;
    const percent = progress.trim() === "" ? null : Number(progress);
    if (percent !== null && (!Number.isInteger(percent) || percent < 0 || percent > 100)) {
      found.progress = "Enter a whole number from 0 to 100";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    save.mutate(
      {
        id: value?.id,
        name: name.trim(),
        type,
        status,
        owner,
        purpose,
        repoUrl,
        docsUrl,
        liveUrl,
        currentStage: step === NO_STEP ? null : step,
        progressPercent: percent,
        notes,
      },
      {
        onSuccess: (saved) => {
          toast.success(value ? `${saved.name} updated` : `${saved.name} added`);
          onDone(saved.id);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save it"),
      },
    );
  };

  const clearError = (field: keyof Errors) => setErrors((e) => ({ ...e, [field]: undefined }));

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
        <DialogTitle>{value ? `Edit ${value.name}` : "New system or site"}</DialogTitle>
        <DialogDescription>
          A website, internal system or integration that IT builds and looks after.
        </DialogDescription>
      </DialogHeader>
      <RequiredNote />

      <div className="space-y-3">
        <FormField id="system-name" label="Name" required error={errors.name}>
          <Input
            id="system-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearError("name");
            }}
            placeholder="e.g. amsol.com"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "system-name-error" : undefined}
          />
        </FormField>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField id="system-type" label="Type" required>
            <Select value={type} onValueChange={(v) => setType(v as ItSystemType)}>
              <SelectTrigger id="system-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(IT_SYSTEM_TYPE_LABELS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="system-status" label="Status" required>
            <Select value={status} onValueChange={(v) => setStatus(v as ItSystemStatus)}>
              <SelectTrigger id="system-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(IT_SYSTEM_STATUS_LABELS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <FormField id="system-owner" label="Owner (optional)" hint="Who's responsible for it">
          <Input
            id="system-owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="e.g. Amos Mwangi"
          />
        </FormField>

        <FormField
          id="system-purpose"
          label="What it does (optional)"
          hint="In plain words, what it's for and who uses it"
        >
          <Textarea
            id="system-purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={3}
            placeholder="e.g. The company website where clients find our services and get in touch."
          />
        </FormField>

        <FormField id="system-live-url" label="Live web address (optional)" error={errors.liveUrl}>
          <Input
            id="system-live-url"
            type="url"
            value={liveUrl}
            onChange={(e) => {
              setLiveUrl(e.target.value);
              clearError("liveUrl");
            }}
            placeholder="https://amsol.com"
            aria-invalid={!!errors.liveUrl}
            aria-describedby={errors.liveUrl ? "system-live-url-error" : undefined}
          />
        </FormField>
        <FormField
          id="system-repo-url"
          label="Code link (optional)"
          hint="Where the code lives, e.g. GitHub"
          error={errors.repoUrl}
        >
          <Input
            id="system-repo-url"
            type="url"
            value={repoUrl}
            onChange={(e) => {
              setRepoUrl(e.target.value);
              clearError("repoUrl");
            }}
            placeholder="https://github.com/…"
            aria-invalid={!!errors.repoUrl}
            aria-describedby={errors.repoUrl ? "system-repo-url-error" : undefined}
          />
        </FormField>
        <FormField
          id="system-docs-url"
          label="Documentation link (optional)"
          error={errors.docsUrl}
        >
          <Input
            id="system-docs-url"
            type="url"
            value={docsUrl}
            onChange={(e) => {
              setDocsUrl(e.target.value);
              clearError("docsUrl");
            }}
            placeholder="https://…"
            aria-invalid={!!errors.docsUrl}
            aria-describedby={errors.docsUrl ? "system-docs-url-error" : undefined}
          />
        </FormField>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            id="system-step"
            label="Step it's on (optional)"
            hint="Where the build has reached"
          >
            <Select value={step} onValueChange={(v) => setStep(v as SdlcStep | typeof NO_STEP)}>
              <SelectTrigger id="system-step">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_STEP}>Not being built</SelectItem>
                {SDLC_STEPS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SDLC_STEP_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            id="system-progress"
            label="How far along, % (optional)"
            hint="100 means finished"
            error={errors.progress}
          >
            <Input
              id="system-progress"
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="numeric"
              value={progress}
              onChange={(e) => {
                setProgress(e.target.value);
                clearError("progress");
              }}
              placeholder="e.g. 60"
              aria-invalid={!!errors.progress}
              aria-describedby={errors.progress ? "system-progress-error" : undefined}
            />
          </FormField>
        </div>

        <FormField id="system-notes" label="Notes (optional)">
          <Textarea
            id="system-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </FormField>
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {value ? "Save system" : "Add system or site"}
        </Button>
      </DialogFooter>
    </form>
  );
}
