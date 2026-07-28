import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/it/systems-sites")({
  head: () => ({ meta: [{ title: "Systems & Sites — AIMS" }] }),
  component: SystemsSites,
});

function SystemsSites() {
  const { isAdminOrCeo, hasRole } = useAuth();
  const canManage = isAdminOrCeo || hasRole("it");
  const systemsQ = useItSystems();
  const deleteSystem = useDeleteItSystem();
  const [editing, setEditing] = useState<ItSystemRow | "new" | null>(null);
  const systems = systemsQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Systems & Sites</h1>
          <p className="text-xs text-muted-foreground">
            What IT builds and maintains — websites, internal systems and integrations.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4 mr-1" /> New entry
          </Button>
        )}
      </div>

      {systemsQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : systems.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
          Nothing registered yet.
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {systems.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    {s.notes && <div className="text-xs text-muted-foreground line-clamp-1">{s.notes}</div>}
                  </TableCell>
                  <TableCell className="text-sm">{IT_SYSTEM_TYPE_LABELS[s.type]}</TableCell>
                  <TableCell>
                    <Badge className={IT_SYSTEM_STATUS_STYLES[s.status]} variant="secondary">
                      {IT_SYSTEM_STATUS_LABELS[s.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.owner ?? "—"}</TableCell>
                  <TableCell>
                    {canManage && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEditing(s)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (!window.confirm(`Remove "${s.name}"?`)) return;
                            deleteSystem.mutate(s.id, {
                              onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete"),
                            });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <EditSystemDialog value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function EditSystemDialog({
  value,
  onClose,
}: {
  value: ItSystemRow | "new" | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!value} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {value && <EditSystemForm value={value === "new" ? null : value} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function EditSystemForm({ value, onDone }: { value: ItSystemRow | null; onDone: () => void }) {
  const save = useSaveItSystem();
  const [name, setName] = useState(value?.name ?? "");
  const [type, setType] = useState<ItSystemType>(value?.type ?? "website");
  const [status, setStatus] = useState<ItSystemStatus>(value?.status ?? "active");
  const [owner, setOwner] = useState(value?.owner ?? "");
  const [notes, setNotes] = useState(value?.notes ?? "");

  const submit = () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    save.mutate(
      { id: value?.id, name: name.trim(), type, status, owner: owner || undefined, notes: notes || undefined },
      {
        onSuccess: () => {
          toast.success(value ? "Updated" : "Added");
          onDone();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{value ? "Edit entry" : "New entry"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. amsol.com" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ItSystemType)}>
              <SelectTrigger>
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
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ItSystemStatus)}>
              <SelectTrigger>
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
          </div>
        </div>
        <div>
          <Label>Owner (optional)</Label>
          <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Who's responsible for this" />
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </>
  );
}
