import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Search, Trash2 } from "lucide-react";
import { confirmDialog } from "@/components/confirm-dialog";
import {
  useWaterCustomers,
  useSaveWaterCustomer,
  useDeleteWaterCustomer,
  useWaterAllZones,
  type WaterCustomerRow,
} from "@/features/water/use-water";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/pagination-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/_authenticated/water/customers")({
  head: () => ({ meta: [{ title: "Water Project — Customers — AIMS" }] }),
  component: WaterCustomersPage,
});

const ALL = "__all__";
const NONE = "__none__";

function WaterCustomersPage() {
  const [zoneId, setZoneId] = useState("");
  const [q, setQ] = useState("");
  const { page, pageSize, setPage, setPageSize } = usePagination(25);

  const allZonesQ = useWaterAllZones();
  const customersQ = useWaterCustomers(
    { zoneId: zoneId || undefined, q: q.trim() || undefined },
    { page, pageSize },
  );
  const deleteCustomer = useDeleteWaterCustomer();
  const [editing, setEditing] = useState<WaterCustomerRow | null>(null);

  const result = customersQ.data;
  const customers = result ? (Array.isArray(result) ? result : result.data) : [];
  const total = result && !Array.isArray(result) ? result.total : customers.length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Customers</h1>
        <p className="text-xs text-muted-foreground">
          Everyone assigned a water meter. Customers are created automatically when a meter is
          registered for them — see the Meters Registry to add a new one.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-3 flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search name…"
            className="pl-7"
          />
        </div>
        <div className="w-44">
          <Select
            value={zoneId || ALL}
            onValueChange={(v) => {
              setZoneId(v === ALL ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All zones</SelectItem>
              {(allZonesQ.data ?? []).map((z) => (
                <SelectItem key={z.id} value={z.id}>
                  {z.parent_zone_id ? `↳ ${z.name}` : z.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {customersQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : customers.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
          No customers match these filters.
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Meter(s)</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link
                        to="/water/customers/$customerId"
                        params={{ customerId: c.id }}
                        className="text-primary hover:underline"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{c.zone_name ?? "—"}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {c.meters.length > 0 ? c.meters.map((m) => m.meter_number).join(", ") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.phone ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          c.is_active
                            ? "bg-success/15 text-success"
                            : "bg-muted text-muted-foreground"
                        }
                        variant="secondary"
                      >
                        {c.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEditing(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            const ok = await confirmDialog({
                              title: `Remove "${c.name}"?`,
                              confirmLabel: "Remove",
                              destructive: true,
                              description: "This can't be undone.",
                            });
                            if (!ok) return;
                            deleteCustomer.mutate(c.id, {
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

      <EditCustomerDialog value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function EditCustomerDialog({
  value,
  onClose,
}: {
  value: WaterCustomerRow | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!value} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{value && <EditCustomerForm value={value} onDone={onClose} />}</DialogContent>
    </Dialog>
  );
}

function EditCustomerForm({ value, onDone }: { value: WaterCustomerRow; onDone: () => void }) {
  const save = useSaveWaterCustomer();
  const allZonesQ = useWaterAllZones();
  const [name, setName] = useState(value.name);
  const [phone, setPhone] = useState(value.phone ?? "");
  const [isActive, setIsActive] = useState(value.is_active);

  const allZones = allZonesQ.data ?? [];
  const currentZoneNode = allZones.find((z) => z.id === value.zone_id);
  const [zoneId, setZoneId] = useState(
    currentZoneNode?.parent_zone_id ? currentZoneNode.parent_zone_id : (value.zone_id ?? ""),
  );
  const [subzoneId, setSubzoneId] = useState(
    currentZoneNode?.parent_zone_id ? (value.zone_id ?? "") : "",
  );

  const topLevelZones = allZones.filter((z) => !z.parent_zone_id);
  const subzoneOptions = allZones.filter((z) => z.parent_zone_id === zoneId);

  const submit = () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    save.mutate(
      {
        id: value.id,
        name: name.trim(),
        zoneId: subzoneId || zoneId || undefined,
        phone: phone || undefined,
        isActive,
      },
      {
        onSuccess: () => {
          toast.success("Customer updated");
          onDone();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit customer</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Zone</Label>
            <Select
              value={zoneId || NONE}
              onValueChange={(v) => {
                setZoneId(v === NONE ? "" : v);
                setSubzoneId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {topLevelZones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Sub-zone</Label>
            <Select
              value={subzoneId || NONE}
              onValueChange={(v) => setSubzoneId(v === NONE ? "" : v)}
              disabled={!zoneId || subzoneOptions.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {subzoneOptions.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Phone (optional)</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <Label>Active</Label>
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
