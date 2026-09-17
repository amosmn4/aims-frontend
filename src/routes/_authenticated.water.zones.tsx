import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Search } from "lucide-react";
import {
  useWaterZones,
  useWaterAllZones,
  useCreateWaterZone,
  useUpdateWaterZone,
  useDeleteWaterZone,
  useCanManageWater,
  type WaterZoneRow,
} from "@/features/water/use-water";
import { ListEmpty, ListNoMatches, WithTerm } from "@/features/water/water-ui";
import { RowActions } from "@/components/row-actions";
import { confirmDeleteZone, deleteErrorToast } from "@/features/water/water-delete";
import { PageHeader } from "@/components/app-shell";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/pagination-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/_authenticated/water/zones")({
  head: () => ({ meta: [{ title: "Water Project — Zones — AIMS" }] }),
  component: WaterZonesPage,
});

const NONE = "__none__";

function WaterZonesPage() {
  const canManage = useCanManageWater();
  const [q, setQ] = useState("");
  const { page, pageSize, setPage, setPageSize } = usePagination(25);
  const zonesQ = useWaterZones({ q: q.trim() || undefined }, { page, pageSize });
  const deleteZone = useDeleteWaterZone();
  const [editing, setEditing] = useState<WaterZoneRow | "new" | null>(null);

  const result = zonesQ.data;
  const zones = result ? (Array.isArray(result) ? result : result.data) : [];
  const total = result && !Array.isArray(result) ? result.total : zones.length;

  const handleDelete = async (z: WaterZoneRow) => {
    if (!(await confirmDeleteZone(z))) return;
    deleteZone.mutate(z.id, {
      onSuccess: () => toast.success(`Zone "${z.name}" deleted`),
      onError: deleteErrorToast,
    });
  };

  const addButton = (
    <Button size="sm" onClick={() => setEditing("new")}>
      <Plus className="h-4 w-4 mr-1" /> Add zone
    </Button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Zones"
        description="The areas the water network is split into. A zone can sit inside another zone as a sub-zone."
        actions={canManage ? addButton : undefined}
      />
      {!canManage && <ViewOnlyBanner area="the Water Project" />}
      <p className="text-xs text-muted-foreground">
        Each zone&apos;s <WithTerm term="bulk">bulk meter</WithTerm> is compared with its{" "}
        <WithTerm term="household">household meters</WithTerm> to find where water is lost.
      </p>

      <div className="rounded-lg border bg-card p-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search zones by name…"
            aria-label="Search zones"
            className="pl-7"
          />
        </div>
      </div>

      {zonesQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : zonesQ.isError ? (
        <LoadError what="zones" error={zonesQ.error} onRetry={() => zonesQ.refetch()} />
      ) : zones.length === 0 ? (
        <div className="rounded-lg border bg-card">
          {q.trim() ? (
            <ListNoMatches
              onClear={() => {
                setQ("");
                setPage(1);
              }}
            />
          ) : (
            <ListEmpty message="No zones yet" action={canManage ? addButton : undefined} />
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Parent zone</TableHead>
                  <TableHead className="text-right">Sub-zones</TableHead>
                  <TableHead className="text-right">Active meters</TableHead>
                  <TableHead className="text-right">Customers</TableHead>
                  {canManage && (
                    <TableHead className="w-20">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map((z) => (
                  <TableRow key={z.id}>
                    <TableCell className="font-medium">{z.name}</TableCell>
                    <TableCell className="text-sm">
                      {z.parent_zone_name ?? <Badge variant="secondary">Top-level</Badge>}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {z.child_count}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {z.active_meter_count}
                      {z.meter_count > z.active_meter_count && (
                        <span className="block text-xs text-muted-foreground">
                          +{z.meter_count - z.active_meter_count} inactive
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {z.customer_count}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <RowActions
                          label={`zone ${z.name}`}
                          onEdit={() => setEditing(z)}
                          onDelete={() => handleDelete(z)}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      <EditZoneDialog value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function EditZoneDialog({
  value,
  onClose,
}: {
  value: WaterZoneRow | "new" | null;
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
          <EditZoneForm
            value={value === "new" ? null : value}
            onDirtyChange={setDirty}
            onCancel={() => guardClose(close)}
            onDone={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditZoneForm({
  value,
  onDirtyChange,
  onCancel,
  onDone,
}: {
  value: WaterZoneRow | null;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const create = useCreateWaterZone();
  const update = useUpdateWaterZone();
  const allZonesQ = useWaterAllZones();
  const [name, setName] = useState(value?.name ?? "");
  const [parentZoneId, setParentZoneId] = useState(value?.parent_zone_id ?? "");
  const [nameError, setNameError] = useState<string>();

  const dirty = name !== (value?.name ?? "") || parentZoneId !== (value?.parent_zone_id ?? "");
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  // Excludes only the zone itself; the backend rejects moving a zone under its own sub-zones.
  const parentOptions = (allZonesQ.data ?? []).filter((z) => z.id !== value?.id);
  const isPending = create.isPending || update.isPending;

  const submit = () => {
    if (!name.trim()) {
      setNameError("Enter a zone name");
      return;
    }
    const callbacks = {
      onSuccess: () => {
        toast.success(value ? `Zone "${name.trim()}" updated` : `Zone "${name.trim()}" added`);
        onDone();
      },
      onError: (err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Couldn't save zone"),
    };
    if (value) {
      update.mutate(
        { id: value.id, name: name.trim(), parentZoneId: parentZoneId || null },
        callbacks,
      );
    } else {
      create.mutate({ name: name.trim(), parentZoneId: parentZoneId || undefined }, callbacks);
    }
  };

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>{value ? `Edit zone ${value.name}` : "Add zone"}</DialogTitle>
        <DialogDescription>
          Leave the parent empty for a top-level zone, or pick a zone to put this one inside it.
        </DialogDescription>
      </DialogHeader>
      <RequiredNote />
      <div className="space-y-3">
        <FormField id="zone-name" label="Name" required error={nameError}>
          <Input
            id="zone-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(undefined);
            }}
            placeholder="e.g. Zone A"
            aria-invalid={!!nameError}
            aria-describedby={nameError ? "zone-name-error" : undefined}
          />
        </FormField>
        <FormField
          id="zone-parent"
          label="Parent zone (optional)"
          error={
            allZonesQ.isError ? "Couldn't load the zone list. Close and try again." : undefined
          }
        >
          <Select
            value={parentZoneId || NONE}
            onValueChange={(v) => setParentZoneId(v === NONE ? "" : v)}
          >
            <SelectTrigger id="zone-parent">
              <SelectValue placeholder="None — top-level zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None — top-level zone</SelectItem>
              {parentOptions.map((z) => (
                <SelectItem key={z.id} value={z.id}>
                  {z.parent_zone_id ? `↳ ${z.name}` : z.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {value ? "Save zone" : "Add zone"}
        </Button>
      </DialogFooter>
    </form>
  );
}
