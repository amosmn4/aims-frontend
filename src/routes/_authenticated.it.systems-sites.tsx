import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Activity, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { confirmDialog } from "@/components/confirm-dialog";
import {
  useItSystems,
  useSaveItSystem,
  useDeleteItSystem,
  IT_SYSTEM_TYPE_LABELS,
  IT_SYSTEM_STATUS_LABELS,
  IT_SYSTEM_STATUS_STYLES,
  type ItSystemRow,
  type ItSystemType,
  type ItSystemStatus,
} from "@/features/it/use-it-systems";
import {
  useLatestUptimes,
  formatUptimeMonth,
  formatUptimePercent,
  type LatestUptime,
} from "@/features/it/use-uptime";
import { UptimeDialog } from "@/features/it/uptime-dialog";
import { PageHeader } from "@/components/app-shell";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export const Route = createFileRoute("/_authenticated/it/systems-sites")({
  head: () => ({ meta: [{ title: "Systems & Sites — AIMS" }] }),
  validateSearch: z.object({ new: z.literal(1).optional().catch(undefined) }),
  component: SystemsSites,
});

function SystemsSites() {
  const { isAdminOrCeo, hasRole } = useAuth();
  const canManage = isAdminOrCeo || hasRole("it");
  const systemsQ = useItSystems();
  const deleteSystem = useDeleteItSystem();
  const [editing, setEditing] = useState<ItSystemRow | "new" | null>(null);
  const [uptimeFor, setUptimeFor] = useState<ItSystemRow | null>(null);
  const { new: openNew } = Route.useSearch();
  const navigate = Route.useNavigate();
  const systems = systemsQ.data ?? [];

  // ?new=1 opens the add form once, then drops the flag from the URL.
  useEffect(() => {
    if (openNew !== 1) return;
    if (canManage) setEditing("new");
    navigate({ search: {}, replace: true });
  }, [openNew, canManage, navigate]);
  const latestUptime = useLatestUptimes(systems.map((s) => s.id));

  const handleDelete = async (s: ItSystemRow) => {
    const ok = await confirmDialog({
      title: `Delete "${s.name}"?`,
      description: `${s.name} and all of its recorded uptime will be removed from Systems & Sites. This can't be undone.`,
      confirmLabel: "Delete system",
      destructive: true,
    });
    if (!ok) return;
    deleteSystem.mutate(s.id, {
      onSuccess: () => toast.success(`${s.name} deleted`),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't delete it"),
    });
  };

  const addButton = (
    <Button size="sm" onClick={() => setEditing("new")}>
      <Plus className="h-4 w-4 mr-1" /> New system or site
    </Button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Systems & Sites"
        description="What IT builds and looks after — websites, internal systems and integrations — and how reliably each one runs."
        actions={canManage ? addButton : undefined}
      />
      {!canManage && <ViewOnlyBanner area="Systems & Sites" />}

      {systemsQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : systemsQ.isError ? (
        <LoadError
          what="systems and sites"
          error={systemsQ.error}
          onRetry={() => systemsQ.refetch()}
        />
      ) : systems.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <span>No systems or sites yet</span>
          {canManage && addButton}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Latest uptime</TableHead>
                  <TableHead className="w-44">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systems.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setEditing(s)}
                        className="text-left font-medium text-primary hover:underline"
                      >
                        {s.name}
                      </button>
                      {s.notes && (
                        <div className="text-xs text-muted-foreground line-clamp-1">{s.notes}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{IT_SYSTEM_TYPE_LABELS[s.type]}</TableCell>
                    <TableCell>
                      <Badge className={IT_SYSTEM_STATUS_STYLES[s.status]} variant="secondary">
                        {IT_SYSTEM_STATUS_LABELS[s.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.owner ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      <UptimeCell entry={latestUptime[s.id]} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant={canManage ? "outline" : "ghost"}
                          className="h-8"
                          onClick={() => setUptimeFor(s)}
                        >
                          <Activity className="h-3.5 w-3.5 mr-1" />
                          {canManage ? "Record uptime" : "Uptime history"}
                        </Button>
                        {canManage && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Edit ${s.name}`}
                              onClick={() => setEditing(s)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-muted-foreground hover:text-destructive"
                              aria-label={`Delete ${s.name}`}
                              disabled={deleteSystem.isPending}
                              onClick={() => handleDelete(s)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <EditSystemDialog value={editing} readOnly={!canManage} onClose={() => setEditing(null)} />
      <UptimeDialog system={uptimeFor} canManage={canManage} onClose={() => setUptimeFor(null)} />
    </div>
  );
}

function UptimeCell({ entry }: { entry?: LatestUptime }) {
  if (entry?.isLoading) {
    return (
      <Loader2
        className="h-3.5 w-3.5 animate-spin text-muted-foreground"
        aria-label="Loading uptime"
      />
    );
  }
  if (entry?.isError) return <span className="text-destructive">Couldn't load</span>;
  if (!entry?.record) return <span className="text-muted-foreground">Not recorded</span>;
  return (
    <span className="tabular-nums">
      {formatUptimePercent(entry.record.uptimePercent)}
      <span className="text-muted-foreground"> · {formatUptimeMonth(entry.record.month)}</span>
    </span>
  );
}

function EditSystemDialog({
  value,
  readOnly,
  onClose,
}: {
  value: ItSystemRow | "new" | null;
  readOnly: boolean;
  onClose: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const { guardClose } = useUnsavedChanges(dirty);
  const close = () => {
    setDirty(false);
    onClose();
  };
  return (
    <Dialog open={!!value} onOpenChange={(open) => !open && guardClose(close)}>
      <DialogContent>
        {value && (
          <EditSystemForm
            value={value === "new" ? null : value}
            readOnly={readOnly}
            onDirtyChange={setDirty}
            onCancel={() => guardClose(close)}
            onDone={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditSystemForm({
  value,
  readOnly,
  onDirtyChange,
  onCancel,
  onDone,
}: {
  value: ItSystemRow | null;
  readOnly: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const save = useSaveItSystem();
  const [name, setName] = useState(value?.name ?? "");
  const [type, setType] = useState<ItSystemType>(value?.type ?? "website");
  const [status, setStatus] = useState<ItSystemStatus>(value?.status ?? "active");
  const [owner, setOwner] = useState(value?.owner ?? "");
  const [notes, setNotes] = useState(value?.notes ?? "");
  const [nameError, setNameError] = useState<string>();

  const dirty =
    !readOnly &&
    (name !== (value?.name ?? "") ||
      type !== (value?.type ?? "website") ||
      status !== (value?.status ?? "active") ||
      owner !== (value?.owner ?? "") ||
      notes !== (value?.notes ?? ""));
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const submit = () => {
    if (!name.trim()) {
      setNameError("Enter the name of the system or site");
      return;
    }
    save.mutate(
      {
        id: value?.id,
        name: name.trim(),
        type,
        status,
        owner: owner || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success(value ? `${name.trim()} updated` : `${name.trim()} added`);
          onDone();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save it"),
      },
    );
  };

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!readOnly) submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {readOnly
            ? (value?.name ?? "System or site")
            : value
              ? `Edit ${value.name}`
              : "New system or site"}
        </DialogTitle>
        <DialogDescription>
          {readOnly
            ? "Details of this system or site."
            : "A website, internal system or integration that IT looks after."}
        </DialogDescription>
      </DialogHeader>
      {!readOnly && <RequiredNote />}
      <div className="space-y-3">
        <FormField id="system-name" label="Name" required={!readOnly} error={nameError}>
          <Input
            id="system-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(undefined);
            }}
            placeholder="e.g. amsol.com"
            disabled={readOnly}
            aria-invalid={!!nameError}
            aria-describedby={nameError ? "system-name-error" : undefined}
          />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField id="system-type" label="Type" required={!readOnly}>
            <Select
              value={type}
              onValueChange={(v) => setType(v as ItSystemType)}
              disabled={readOnly}
            >
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
          <FormField id="system-status" label="Status" required={!readOnly}>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as ItSystemStatus)}
              disabled={readOnly}
            >
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
        <FormField id="system-owner" label="Owner (optional)">
          <Input
            id="system-owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Who's responsible for this"
            disabled={readOnly}
          />
        </FormField>
        <FormField id="system-notes" label="Notes (optional)">
          <Textarea
            id="system-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            disabled={readOnly}
          />
        </FormField>
      </div>
      <DialogFooter className="gap-2">
        {readOnly ? (
          <Button type="button" variant="outline" onClick={onDone}>
            Close
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onCancel} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {value ? "Save system" : "Add system or site"}
            </Button>
          </>
        )}
      </DialogFooter>
    </form>
  );
}
