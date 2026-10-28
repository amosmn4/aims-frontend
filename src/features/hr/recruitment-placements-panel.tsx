import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { confirmDialog } from "@/components/confirm-dialog";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { formatDate } from "@/lib/format-date";
import {
  usePlacements,
  useAddPlacement,
  useRemovePlacement,
  type PlacementRow,
} from "@/features/hr/use-placements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const formatPlacedDate = (iso: string) => formatDate(iso.slice(0, 10));

const todayValue = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const placedCountLabel = (n: number) =>
  n === 1 ? "1 person placed" : `${n.toLocaleString()} people placed`;

/** Named list of people placed on a recruitment project. */
export function RecruitmentPlacementsPanel({
  projectId,
  canManage,
}: {
  projectId: string;
  canManage: boolean;
}) {
  const placementsQ = usePlacements(projectId);
  const remove = useRemovePlacement(projectId);
  const [adding, setAdding] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const { guardClose } = useUnsavedChanges(adding && formDirty);
  const placements = placementsQ.data ?? [];
  const closeForm = () => {
    setFormDirty(false);
    setAdding(false);
  };

  const confirmRemove = async (p: PlacementRow) => {
    const ok = await confirmDialog({
      title: `Remove ${p.candidateName}?`,
      description:
        "They'll be taken off this project's placed list, and the placed number goes down by one.",
      confirmLabel: "Remove placement",
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(p.id, {
      onSuccess: () => toast.success(`${p.candidateName} removed`),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to remove"),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">People placed</h3>
          <p className="text-sm text-muted-foreground">
            {placementsQ.isLoading
              ? "Loading…"
              : placementsQ.isError
                ? "Couldn’t load the list"
                : placedCountLabel(placements.length)}
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Add placement
          </Button>
        )}
      </div>

      {placementsQ.isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : placementsQ.isError ? (
        <LoadError
          what="placements"
          error={placementsQ.error}
          onRetry={() => placementsQ.refetch()}
        />
      ) : placements.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          {canManage ? "No one added yet. Add each person as they're placed." : "No one added yet."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Date placed</TableHead>
                <TableHead>Notes</TableHead>
                {canManage && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {placements.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.candidateName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.position ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap tabular-nums">
                    {formatPlacedDate(p.placedAt)}
                  </TableCell>
                  <TableCell className="max-w-56 text-sm text-muted-foreground">
                    <span className="line-clamp-2">{p.notes ?? "—"}</span>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label={`Remove placement for ${p.candidateName}`}
                        disabled={remove.isPending}
                        onClick={() => confirmRemove(p)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {canManage && (
        <Dialog open={adding} onOpenChange={(o) => (o ? setAdding(true) : guardClose(closeForm))}>
          <DialogContent>
            {adding && (
              <AddPlacementForm
                projectId={projectId}
                onDone={closeForm}
                onCancel={() => guardClose(closeForm)}
                onDirtyChange={setFormDirty}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

type PlacementErrors = Partial<Record<"name" | "position" | "placedAt", string>>;

function AddPlacementForm({
  projectId,
  onDone,
  onCancel,
  onDirtyChange,
}: {
  projectId: string;
  onDone: () => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const add = useAddPlacement(projectId);
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [placedAt, setPlacedAt] = useState(todayValue);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<PlacementErrors>({});
  const dirty = !!(name.trim() || position.trim() || notes.trim()) || placedAt !== todayValue();
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const submit = () => {
    const found: PlacementErrors = {};
    if (name.trim().length < 2) found.name = "Enter the person's name";
    if (position.trim().length > 160) found.position = "Keep the position under 160 characters";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(placedAt)) found.placedAt = "Choose the date they were placed";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const candidateName = name.trim();
    add.mutate(
      {
        candidateName,
        position: position.trim() || undefined,
        placedAt,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`${candidateName} added as placed`);
          onDone();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add"),
      },
    );
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
      className="space-y-4"
    >
      <DialogHeader>
        <DialogTitle>Add placement</DialogTitle>
        <DialogDescription>Someone this project has placed in a job.</DialogDescription>
        <RequiredNote />
      </DialogHeader>
      <div className="space-y-3">
        <FormField id="placement-name" label="Name" required error={errors.name}>
          <Input
            id="placement-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jane Wanjiru"
            autoFocus
            aria-invalid={!!errors.name}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField id="placement-position" label="Position (optional)" error={errors.position}>
            <Input
              id="placement-position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="e.g. Accountant"
              aria-invalid={!!errors.position}
            />
          </FormField>
          <FormField id="placement-date" label="Date placed" required error={errors.placedAt}>
            <Input
              id="placement-date"
              type="date"
              value={placedAt}
              onChange={(e) => setPlacedAt(e.target.value)}
              aria-invalid={!!errors.placedAt}
            />
          </FormField>
        </div>
        <FormField id="placement-notes" label="Notes (optional)">
          <Textarea
            id="placement-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Starts on 1 October"
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4 mr-2" />
          )}
          Add placement
        </Button>
      </DialogFooter>
    </form>
  );
}
