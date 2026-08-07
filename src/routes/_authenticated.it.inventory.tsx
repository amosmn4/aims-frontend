import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  useInventoryItems,
  useSaveInventoryItem,
  useDeleteInventoryItem,
  INVENTORY_CATEGORY_LABELS,
  INVENTORY_STATUS_LABELS,
  INVENTORY_STATUS_STYLES,
  type InventoryItemRow,
  type InventoryCategory,
  type InventoryStatus,
} from "@/features/it/use-inventory";
import { apiJson } from "@/lib/api-client";
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
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/it/inventory")({
  head: () => ({ meta: [{ title: "Inventory — AIMS" }] }),
  component: InventoryPage,
});

type Office = { id: string; name: string };

const NONE_OFFICE = "__none__";

function InventoryPage() {
  const { isAdminOrCeo, hasRole } = useAuth();
  const canManage = isAdminOrCeo || hasRole("it");
  const itemsQ = useInventoryItems();
  const deleteItem = useDeleteInventoryItem();
  const [editing, setEditing] = useState<InventoryItemRow | "new" | null>(null);
  const items = itemsQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Inventory</h1>
          <p className="text-xs text-muted-foreground">
            Computers and related hardware across Amsol's offices — asset tags, assignment and
            status.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4 mr-1" /> New item
          </Button>
        )}
      </div>

      {itemsQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
          No inventory recorded yet.
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset tag</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead>Office</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.asset_tag}</TableCell>
                  <TableCell>
                    <div className="font-medium">{item.device_name}</div>
                    {(item.brand || item.model) && (
                      <div className="text-xs text-muted-foreground">
                        {[item.brand, item.model].filter(Boolean).join(" ")}
                      </div>
                    )}
                    {item.description && (
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {item.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {INVENTORY_CATEGORY_LABELS[item.category]}
                  </TableCell>
                  <TableCell>
                    <Badge className={INVENTORY_STATUS_STYLES[item.status]} variant="secondary">
                      {INVENTORY_STATUS_LABELS[item.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.assigned_to ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.office_name ?? "—"}
                  </TableCell>
                  <TableCell>
                    {canManage && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEditing(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            const ok = await confirmDialog({
                              title: `Remove "${item.device_name}"?`,
                              confirmLabel: "Remove",
                              destructive: true,
                              description: "This can't be undone.",
                            });
                            if (!ok) return;
                            deleteItem.mutate(item.id, {
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
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <EditItemDialog value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function EditItemDialog({
  value,
  onClose,
}: {
  value: InventoryItemRow | "new" | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!value} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {value && <EditItemForm value={value === "new" ? null : value} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function EditItemForm({ value, onDone }: { value: InventoryItemRow | null; onDone: () => void }) {
  const save = useSaveInventoryItem();
  const officesQ = useQuery({
    queryKey: ["offices", "admin"],
    queryFn: () => apiJson<Office[]>("/offices"),
  });
  const [assetTag, setAssetTag] = useState(value?.asset_tag ?? "");
  const [deviceName, setDeviceName] = useState(value?.device_name ?? "");
  const [description, setDescription] = useState(value?.description ?? "");
  const [category, setCategory] = useState<InventoryCategory>(value?.category ?? "laptop");
  const [status, setStatus] = useState<InventoryStatus>(value?.status ?? "in_use");
  const [brand, setBrand] = useState(value?.brand ?? "");
  const [model, setModel] = useState(value?.model ?? "");
  const [serialNumber, setSerialNumber] = useState(value?.serial_number ?? "");
  const [assignedTo, setAssignedTo] = useState(value?.assigned_to ?? "");
  const [officeId, setOfficeId] = useState(value?.office_id ?? "");
  const [purchaseDate, setPurchaseDate] = useState(value?.purchase_date?.slice(0, 10) ?? "");
  const [warrantyExpiry, setWarrantyExpiry] = useState(value?.warranty_expiry?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(value?.notes ?? "");

  const submit = () => {
    if (!assetTag.trim() || !deviceName.trim()) {
      toast.error("Asset tag and device name are required");
      return;
    }
    save.mutate(
      {
        id: value?.id,
        assetTag: assetTag.trim(),
        deviceName: deviceName.trim(),
        description: description || undefined,
        category,
        status,
        brand: brand || undefined,
        model: model || undefined,
        serialNumber: serialNumber || undefined,
        assignedTo: assignedTo || undefined,
        officeId: officeId || undefined,
        purchaseDate: purchaseDate || undefined,
        warrantyExpiry: warrantyExpiry || undefined,
        notes: notes || undefined,
      },
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
        <DialogTitle>{value ? "Edit inventory item" : "New inventory item"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Asset tag</Label>
            <Input
              value={assetTag}
              onChange={(e) => setAssetTag(e.target.value)}
              placeholder="AMS-LT-001"
            />
          </div>
          <div>
            <Label>Device name</Label>
            <Input
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="Dell Latitude 5420"
            />
          </div>
        </div>
        <div>
          <Label>Description (optional)</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Silver, 16GB RAM, 512GB SSD…"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as InventoryCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INVENTORY_CATEGORY_LABELS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as InventoryStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INVENTORY_STATUS_LABELS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Brand (optional)</Label>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Dell" />
          </div>
          <div>
            <Label>Model (optional)</Label>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Latitude 5420"
            />
          </div>
        </div>
        <div>
          <Label>Serial number (optional)</Label>
          <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Assigned to (optional)</Label>
            <Input
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="Who's using this"
            />
          </div>
          <div>
            <Label>Office</Label>
            <Select
              value={officeId || NONE_OFFICE}
              onValueChange={(v) => setOfficeId(v === NONE_OFFICE ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_OFFICE}>Unassigned</SelectItem>
                {(officesQ.data ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Purchase date (optional)</Label>
            <Input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>
          <div>
            <Label>Warranty expiry (optional)</Label>
            <Input
              type="date"
              value={warrantyExpiry}
              onChange={(e) => setWarrantyExpiry(e.target.value)}
            />
          </div>
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
