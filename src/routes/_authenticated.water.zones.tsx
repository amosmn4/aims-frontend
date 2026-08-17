import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { confirmDialog } from "@/components/confirm-dialog";
import {
  useWaterZones,
  useWaterAllZones,
  useCreateWaterZone,
  useUpdateWaterZone,
  useDeleteWaterZone,
  type WaterZoneRow,
} from "@/features/water/use-water";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/pagination-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const { page, pageSize, setPage, setPageSize } = usePagination(25);
  const zonesQ = useWaterZones({ page, pageSize });
  const deleteZone = useDeleteWaterZone();
  const [editing, setEditing] = useState<WaterZoneRow | "new" | null>(null);

  const result = zonesQ.data;
  const zones = result ? (Array.isArray(result) ? result : result.data) : [];
  const total = result && !Array.isArray(result) ? result.total : zones.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Zones</h1>
          <p className="text-xs text-muted-foreground">
            Geographic areas the network is organized into — a zone can sit inside another zone
            (e.g. a sub-zone within a zone), nested as deep as needed.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4 mr-1" /> Create zone
        </Button>
      </div>

      {zonesQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : zones.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
          No zones yet.
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
                  <TableHead className="text-right">Meters</TableHead>
                  <TableHead className="text-right">Customers</TableHead>
                  <TableHead className="w-20" />
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
                      {z.meter_count}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {z.customer_count}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEditing(z)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            const ok = await confirmDialog({
                              title: `Remove zone "${z.name}"?`,
                              confirmLabel: "Remove",
                              destructive: true,
                              description: "This can't be undone.",
                            });
                            if (!ok) return;
                            deleteZone.mutate(z.id, {
                              onError: (err) =>
                                toast.error(
                                  err instanceof Error ? err.message : "Failed to delete",
                                ),
                            });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
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
  return (
    <Dialog open={!!value} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {value && <EditZoneForm value={value === "new" ? null : value} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function EditZoneForm({ value, onDone }: { value: WaterZoneRow | null; onDone: () => void }) {
  const create = useCreateWaterZone();
  const update = useUpdateWaterZone();
  const allZonesQ = useWaterAllZones();
  const [name, setName] = useState(value?.name ?? "");
  const [parentZoneId, setParentZoneId] = useState(value?.parent_zone_id ?? "");

  // A zone can't become its own parent, and — to keep this simple client-side — can't be
  // reparented under itself directly. The backend still enforces the full descendant check.
  const parentOptions = (allZonesQ.data ?? []).filter((z) => z.id !== value?.id);
  const isPending = create.isPending || update.isPending;

  const submit = () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    const onSettled = {
      onSuccess: () => {
        toast.success(value ? "Zone updated" : "Zone created");
        onDone();
      },
      onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed to save"),
    };
    if (value) {
      update.mutate(
        { id: value.id, name: name.trim(), parentZoneId: parentZoneId || undefined },
        onSettled,
      );
    } else {
      create.mutate({ name: name.trim(), parentZoneId: parentZoneId || undefined }, onSettled);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{value ? "Edit zone" : "Create zone"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Zone A" />
        </div>
        <div>
          <Label>Parent zone (optional)</Label>
          <Select
            value={parentZoneId || NONE}
            onValueChange={(v) => setParentZoneId(v === NONE ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="None — top-level zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None — top-level zone</SelectItem>
              {parentOptions.map((z) => (
                <SelectItem key={z.id} value={z.id}>
                  {z.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Leave unset for a top-level zone, or pick another zone to nest this one inside it.
          </p>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </>
  );
}
