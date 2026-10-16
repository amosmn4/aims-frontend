import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useUpdateProject,
  useProject,
  useDeleteProject,
  PROJECT_STATUS_LABELS,
  PROJECT_HEALTH_LABELS,
  type ProjectHealth,
  type Project,
  type ProjectStatus,
  type ProjectVisibility,
  type ProjectEngagementType,
  type ExtensionAttribution,
} from "@/features/projects/use-projects";
import { ProjectVisibilityPicker } from "@/features/projects/project-visibility-picker";
import { ExtensionPrompt, isExtension } from "@/features/projects/extension-prompt";
import { useServiceLines } from "@/features/finance/use-finance-data";
import { ClientPicker } from "@/features/clients/client-picker";
import { confirmDialog } from "@/components/confirm-dialog";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";

type ProjectErrors = Partial<Record<"name" | "budget" | "endDate" | "extensionReason", string>>;

export function EditProjectDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const initial = {
    name: project.name,
    description: project.description ?? "",
    clientId: project.client_id ?? "",
    status: project.status,
    health: project.health,
    budget: project.budget != null ? String(project.budget) : "",
    startDate: project.start_date?.slice(0, 10) ?? "",
    endDate: project.end_date?.slice(0, 10) ?? "",
    visibility: project.visibility,
    engagementType: project.engagement_type,
    serviceLineId: project.service_line_id ?? "",
  };
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [clientId, setClientId] = useState(initial.clientId);
  const [status, setStatus] = useState<ProjectStatus>(initial.status);
  const [health, setHealth] = useState<ProjectHealth>(initial.health);
  const [budget, setBudget] = useState(initial.budget);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [visibility, setVisibility] = useState<ProjectVisibility>(initial.visibility);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [engagementType, setEngagementType] = useState<ProjectEngagementType>(
    initial.engagementType,
  );
  const [serviceLineId, setServiceLineId] = useState(initial.serviceLineId);
  const serviceLines = (useServiceLines().data ?? []).filter(
    (l) => l.department_id === project.department_id && l.is_active,
  );
  const [extensionReason, setExtensionReason] = useState("");
  const [extensionAttribution, setExtensionAttribution] = useState<ExtensionAttribution>("client");
  const [errors, setErrors] = useState<ProjectErrors>({});
  const update = useUpdateProject();
  const extending = isExtension(project.end_date, endDate);

  const dirty =
    name !== initial.name ||
    description !== initial.description ||
    clientId !== initial.clientId ||
    status !== initial.status ||
    health !== initial.health ||
    budget !== initial.budget ||
    startDate !== initial.startDate ||
    endDate !== initial.endDate ||
    visibility !== initial.visibility ||
    engagementType !== initial.engagementType ||
    serviceLineId !== initial.serviceLineId ||
    memberIds.length > 0;
  const { guardClose } = useUnsavedChanges(dirty);

  const submit = () => {
    const found: ProjectErrors = {};
    if (!name.trim()) found.name = "The project needs a name.";
    if (budget && Number(budget) < 0) found.budget = "The budget can't be negative.";
    if (startDate && endDate && endDate < startDate)
      found.endDate = "The end date can't be before the start date.";
    if (extending && !extensionReason.trim())
      found.extensionReason = "Say why the end date is moving.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    update.mutate(
      {
        id: project.id,
        name: name.trim(),
        description: description || undefined,
        clientId: clientId || null,
        serviceLineId: serviceLineId || null,
        status,
        health,
        budget: budget ? Number(budget) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        visibility,
        engagementType,
        memberIds: visibility === "restricted" && memberIds.length ? memberIds : undefined,
        extensionReason: extending ? extensionReason.trim() : undefined,
        extensionAttribution: extending ? extensionAttribution : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Project updated");
          onClose();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && guardClose(onClose)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <RequiredNote />
          </DialogHeader>
          <div className="space-y-3">
            <FormField id="edit-project-name" label="Name" required error={errors.name}>
              <Input
                id="edit-project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!!errors.name}
              />
            </FormField>
            <FormField id="edit-project-description" label="Description">
              <Textarea
                id="edit-project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </FormField>
            {serviceLines.length > 0 && (
              <FormField id="edit-project-line" label="Service line">
                <Select value={serviceLineId} onValueChange={setServiceLineId}>
                  <SelectTrigger id="edit-project-line">
                    <SelectValue placeholder="Choose a service line" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceLines.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
            <FormField id="edit-project-client" label="Client (optional)">
              <ClientPicker
                id="edit-project-client"
                value={clientId}
                onChange={setClientId}
                allowNone
                departmentId={project.department_id}
                placeholder="No client"
              />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField id="edit-project-status" label="Status">
                <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                  <SelectTrigger id="edit-project-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROJECT_STATUS_LABELS).map(([v, label]) => (
                      <SelectItem key={v} value={v}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="edit-project-health" label="How is it going?">
                <Select value={health} onValueChange={(v) => setHealth(v as ProjectHealth)}>
                  <SelectTrigger id="edit-project-health">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PROJECT_HEALTH_LABELS) as ProjectHealth[]).map((v) => (
                      <SelectItem key={v} value={v}>
                        {PROJECT_HEALTH_LABELS[v]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="edit-project-budget" label="Budget" error={errors.budget}>
                <Input
                  id="edit-project-budget"
                  type="number"
                  min={0}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  aria-invalid={!!errors.budget}
                />
              </FormField>
              <FormField id="edit-project-type" label="Type of work">
                <Select
                  value={engagementType}
                  onValueChange={(v) => setEngagementType(v as ProjectEngagementType)}
                >
                  <SelectTrigger id="edit-project-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_off">One-off</SelectItem>
                    <SelectItem value="ongoing">Recurring</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="edit-project-start" label="Start date">
                <Input
                  id="edit-project-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </FormField>
              <FormField id="edit-project-end" label="End date" error={errors.endDate}>
                <Input
                  id="edit-project-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  aria-invalid={!!errors.endDate}
                />
              </FormField>
            </div>
            {extending && (
              <ExtensionPrompt
                reason={extensionReason}
                onReasonChange={setExtensionReason}
                attribution={extensionAttribution}
                onAttributionChange={setExtensionAttribution}
                reasonError={errors.extensionReason}
                idPrefix="edit-project-extension"
              />
            )}
            <ProjectVisibilityPicker
              departmentName={project.department_name}
              visibility={visibility}
              onVisibilityChange={setVisibility}
              memberIds={memberIds}
              onMemberIdsChange={setMemberIds}
            />
            {visibility === "restricted" && (
              <p className="text-xs text-muted-foreground">
                People picked here are added to the project&apos;s team. To take away someone&apos;s
                access, remove them on the Team tab.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => guardClose(onClose)}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Loads a project by id (e.g. from a board row) and opens the edit dialog once it's ready. */
export function EditProjectById({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const projectQ = useProject(projectId);
  if (projectQ.isError) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
          </DialogHeader>
          <LoadError
            what="this project"
            error={projectQ.error}
            onRetry={() => projectQ.refetch()}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  if (!projectQ.data) return null;
  return <EditProjectDialog project={projectQ.data} onClose={onClose} />;
}

/** Confirm-then-delete for any project, with toasts. */
export function useDeleteProjectAction() {
  const deleteProject = useDeleteProject();
  return async (project: { id: string; name: string }, onDeleted?: () => void) => {
    const ok = await confirmDialog({
      title: `Delete "${project.name}"?`,
      description:
        "This removes all its tasks, milestones and documents too. This can't be undone.",
      confirmLabel: "Delete project",
      destructive: true,
    });
    if (!ok) return;
    deleteProject.mutate(project.id, {
      onSuccess: () => {
        toast.success("Project deleted");
        onDeleted?.();
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
    });
  };
}
