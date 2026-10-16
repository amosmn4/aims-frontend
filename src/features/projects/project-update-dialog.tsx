import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useLogRecordActivity } from "@/features/activity/use-activity";
import { companyRole, type Project } from "@/features/projects/use-projects";
import { useProjectAccess } from "@/features/projects/use-project-sharing";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useAuth } from "@/lib/auth";
import { FormField, RequiredNote } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export function ProjectUpdateDialog({
  project,
  projects = [],
  onSaved,
}: {
  project?: Project;
  projects?: Project[];
  onSaved?: () => void;
}) {
  const navigate = useNavigate();
  const { profile, isAdminOrCeo } = useAuth();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [summary, setSummary] = useState("");
  const [occurredOn, setOccurredOn] = useState(localToday);
  const [blocker, setBlocker] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState("");
  const choices = projects.filter((p) => p.status !== "completed" && p.status !== "cancelled");
  const selected =
    project ??
    choices.find((p) => p.id === projectId) ??
    (choices.length === 1 ? choices[0] : undefined);
  const isHr = selected?.department_code === "hr";
  const access = useProjectAccess(
    selected?.scope === "department" ? selected.id : undefined,
    selected?.department_code,
  );
  const role =
    selected?.scope === "company" ? companyRole(selected, profile?.id, isAdminOrCeo) : null;
  const canLog =
    selected?.scope === "company"
      ? role === "admin" || role === "lead" || role === "member"
      : access.canEdit;
  const log = useLogRecordActivity({ kind: "project", id: selected?.id ?? "" });
  const dirty = open && (!!summary.trim() || !!blocker.trim() || !!nextStep.trim());
  const { guardClose } = useUnsavedChanges(dirty);

  const reset = () => {
    setOpen(false);
    setProjectId("");
    setSummary("");
    setOccurredOn(localToday());
    setBlocker("");
    setNextStep("");
    setShowMore(false);
    setError("");
  };

  const submit = async () => {
    if (!selected || !canLog) {
      setError("Choose a project you can update.");
      return;
    }
    if (!summary.trim()) {
      setError("Write a short update about the work you handled.");
      return;
    }
    if (!occurredOn || occurredOn > localToday()) {
      setError("Choose the date the work happened, up to today.");
      return;
    }
    setError("");
    try {
      await log.mutateAsync({
        type: "note",
        summary: [
          summary.trim(),
          blocker.trim() ? `Blocker: ${blocker.trim()}` : "",
          nextStep.trim() ? `Next step: ${nextStep.trim()}` : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
        occurredAt: new Date(`${occurredOn}T12:00:00`).toISOString(),
      });
      const savedProjectId = selected.id;
      toast.success(`Work update saved to ${selected.name}`, {
        action: {
          label: "View updates",
          onClick: () =>
            navigate({
              to: "/projects/$projectId",
              params: { projectId: savedProjectId },
              search: { view: "discussions" },
            }),
        },
      });
      reset();
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the update. Try again.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (log.isPending) return;
        if (next) setOpen(true);
        else guardClose(reset);
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={!project && choices.length === 0}>Log work update</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!log.isPending) void submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Log work update</DialogTitle>
            <DialogDescription>
              Record what you handled and how it is progressing. Your update stays with the project
              and can be included in reports.
            </DialogDescription>
            <RequiredNote />
          </DialogHeader>
          <div className="space-y-4 py-4">
            {project ? (
              <div className="rounded-md border bg-secondary/40 px-3 py-2 text-sm">
                <p className="font-medium">{project.name}</p>
                {project.client_name && (
                  <p className="text-muted-foreground">{project.client_name}</p>
                )}
              </div>
            ) : (
              <FormField id="work-update-project" label="Project" required>
                <select
                  id="work-update-project"
                  value={selected?.id ?? ""}
                  onChange={(event) => {
                    setProjectId(event.target.value);
                    setError("");
                  }}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Choose the work you are updating</option>
                  {choices.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.name}
                      {choice.client_name ? ` (${choice.client_name})` : ""}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
            <FormField id="work-update-summary" label="What did you handle?" required>
              <Textarea
                id="work-update-summary"
                rows={4}
                value={summary}
                maxLength={4000}
                onChange={(event) => {
                  setSummary(event.target.value);
                  setError("");
                }}
                placeholder={
                  isHr
                    ? "For example: Screened 18 applications and sent a shortlist of 5 to the client."
                    : "For example: Finished the handover plan and shared it with the project team."
                }
              />
            </FormField>
            <FormField id="work-update-date" label="Date of work" required>
              <Input
                id="work-update-date"
                type="date"
                value={occurredOn}
                max={localToday()}
                onChange={(event) => {
                  setOccurredOn(event.target.value);
                  setError("");
                }}
              />
            </FormField>
            <Button
              type="button"
              variant="ghost"
              className="px-0"
              aria-expanded={showMore}
              onClick={() => setShowMore((current) => !current)}
            >
              {showMore ? "Hide extra details" : "Add a blocker or next step"}
            </Button>
            {showMore && (
              <div className="space-y-3">
                <FormField id="work-update-blocker" label="What is blocking progress?">
                  <Textarea
                    id="work-update-blocker"
                    rows={2}
                    value={blocker}
                    maxLength={1000}
                    onChange={(event) => setBlocker(event.target.value)}
                    placeholder={
                      isHr
                        ? "For example: Waiting for the client to confirm interview dates."
                        : "For example: Waiting for approval of the handover date."
                    }
                  />
                </FormField>
                <FormField id="work-update-next" label="What happens next?">
                  <Textarea
                    id="work-update-next"
                    rows={2}
                    value={nextStep}
                    maxLength={1000}
                    onChange={(event) => setNextStep(event.target.value)}
                    placeholder={
                      isHr
                        ? "For example: Arrange interviews once the client confirms."
                        : "For example: Confirm responsibilities once the plan is approved."
                    }
                  />
                </FormField>
              </div>
            )}
            {selected && access.isResolved && !canLog && (
              <p className="text-sm text-muted-foreground">
                You can view this project. Ask its lead or department to give you access to add
                updates.
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={log.isPending}
              onClick={() => guardClose(reset)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={log.isPending || !selected || !canLog}>
              {log.isPending ? "Saving update..." : "Save update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
