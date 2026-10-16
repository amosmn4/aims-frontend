import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import {
  AlertTriangle,
  Banknote,
  Download,
  Loader2,
  Package,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  TrendingDown,
  X,
} from "lucide-react";
import {
  useInventoryItems,
  useSaveInventoryItem,
  useDeleteInventoryItem,
  INVENTORY_CATEGORY_LABELS,
  INVENTORY_STATUS_LABELS,
  INVENTORY_STATUS_STYLES,
  INVENTORY_CONDITION_LABELS,
  INVENTORY_CONDITION_STYLES,
  INVENTORY_CONDITION_ROW_STYLES,
  type InventoryItemRow,
  type InventoryCategory,
  type InventoryStatus,
  type InventoryCondition,
} from "@/features/it/use-inventory";
import { exportInventoryPdf } from "@/features/it/inventory-pdf";
import { useDepartments, useProfilesLite } from "@/features/clients/use-clients-contracts";
import { formatCurrency } from "@/features/finance/finance";
import { PageHeader } from "@/components/app-shell";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { apiJson } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { usePagination } from "@/hooks/use-pagination";
import { cn } from "@/lib/utils";
import { PaginationBar } from "@/components/pagination-bar";
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

export const Route = createFileRoute("/_authenticated/it/inventory")({
  head: () => ({ meta: [{ title: "Inventory — AIMS" }] }),
  component: InventoryPage,
});

type Office = { id: string; name: string };

const NONE = "__none__";
const ALL = "__all__";

// Counts items that need fixing: under repair, faulty or needing attention.
const needsRepair = (i: InventoryItemRow) =>
  i.status === "under_repair" || i.condition === "faulty" || i.condition === "needs_attention";

function useOffices() {
  return useQuery({
    queryKey: ["offices", "admin"],
    queryFn: () => apiJson<Office[]>("/offices"),
  });
}

function InventoryPage() {
  const { isAdminOrCeo, hasRole } = useAuth();
  const canManage = isAdminOrCeo || hasRole("it");
  const officesQ = useOffices();

  const [category, setCategory] = useState<InventoryCategory | "">("");
  const [status, setStatus] = useState<InventoryStatus | "">("");
  const [condition, setCondition] = useState<InventoryCondition | "">("");
  const [officeId, setOfficeId] = useState("");
  const [q, setQ] = useState("");
  const { page, pageSize, setPage, setPageSize } = usePagination(25);

  const activeFilters = {
    category: category || undefined,
    status: status || undefined,
    condition: condition || undefined,
    officeId: officeId || undefined,
    q: q.trim() || undefined,
  };
  const hasFilters = Object.values(activeFilters).some(Boolean);
  const itemsQ = useInventoryItems(activeFilters, { page, pageSize });
  const allMatchingQ = useInventoryItems(activeFilters);
  const deleteItem = useDeleteInventoryItem();
  const [editing, setEditing] = useState<InventoryItemRow | "new" | null>(null);
  const [exporting, setExporting] = useState(false);

  const result = itemsQ.data;
  const items = result ? (Array.isArray(result) ? result : result.data) : [];
  const total = result && !Array.isArray(result) ? result.total : items.length;
  const startIndex = (page - 1) * pageSize;

  const summary = useMemo(() => {
    const all = allMatchingQ.data ?? [];
    return {
      count: all.length,
      cost: all.reduce((sum, i) => sum + (i.purchase_cost ?? 0), 0),
      value: all.reduce((sum, i) => sum + (i.current_value ?? 0), 0),
      repair: all.filter(needsRepair).length,
    };
  }, [allMatchingQ.data]);
  const summaryReady = allMatchingQ.isSuccess;

  const clearFilters = () => {
    setCategory("");
    setStatus("");
    setCondition("");
    setOfficeId("");
    setQ("");
    setPage(1);
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const all = allMatchingQ.data ?? [];
      const bits = [
        category && INVENTORY_CATEGORY_LABELS[category],
        status && INVENTORY_STATUS_LABELS[status],
        condition && INVENTORY_CONDITION_LABELS[condition],
        officeId && officesQ.data?.find((o) => o.id === officeId)?.name,
        q.trim() && `“${q.trim()}”`,
      ].filter(Boolean);
      exportInventoryPdf(all, bits.length ? bits.join(" · ") : undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't export the PDF");
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (item: InventoryItemRow) => {
    const ok = await confirmDialog({
      title: `Delete "${item.device_name}"?`,
      description: `${item.device_name} (${item.asset_tag}) will be removed from Inventory. This can't be undone.`,
      confirmLabel: "Delete item",
      destructive: true,
    });
    if (!ok) return;
    deleteItem.mutate(item.id, {
      onSuccess: () => toast.success(`${item.device_name} deleted`),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't delete item"),
    });
  };

  const addButton = (
    <Button size="sm" onClick={() => setEditing("new")}>
      <Plus className="h-4 w-4 mr-1" /> New inventory item
    </Button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory"
        description="Computers and other hardware across Amsol's offices — who has what, its condition and its value."
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={exportPdf}
              disabled={exporting || !summaryReady || summary.count === 0}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Export PDF
            </Button>
            {canManage && addButton}
          </>
        }
      />
      {!canManage && <ViewOnlyBanner area="Inventory" action="add or change items" />}

      <div className="rounded-lg border bg-card p-3 flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, tag, serial, brand, model or person"
            aria-label="Search inventory"
            className="pl-7"
          />
        </div>
        <div className="w-full sm:w-40">
          <Select
            value={category || ALL}
            onValueChange={(v) => {
              setCategory(v === ALL ? "" : (v as InventoryCategory));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9" aria-label="Filter by category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {Object.entries(INVENTORY_CATEGORY_LABELS).map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-40">
          <Select
            value={status || ALL}
            onValueChange={(v) => {
              setStatus(v === ALL ? "" : (v as InventoryStatus));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {Object.entries(INVENTORY_STATUS_LABELS).map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-40">
          <Select
            value={condition || ALL}
            onValueChange={(v) => {
              setCondition(v === ALL ? "" : (v as InventoryCondition));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9" aria-label="Filter by condition">
              <SelectValue placeholder="Condition" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All conditions</SelectItem>
              {Object.entries(INVENTORY_CONDITION_LABELS).map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-44">
          <Select
            value={officeId || ALL}
            onValueChange={(v) => {
              setOfficeId(v === ALL ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9" aria-label="Filter by office">
              <SelectValue placeholder="Office" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All offices</SelectItem>
              {(officesQ.data ?? []).map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          icon={Package}
          label="Items"
          value={summaryReady ? summary.count.toLocaleString() : "—"}
        />
        <SummaryCard
          icon={Banknote}
          label="Total purchase cost"
          value={summaryReady ? formatCurrency(summary.cost) : "—"}
        />
        <SummaryCard
          icon={TrendingDown}
          label="Total current value"
          value={summaryReady ? formatCurrency(summary.value) : "—"}
          hint="After wear and age"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Needs repair / faulty"
          value={summaryReady ? summary.repair.toLocaleString() : "—"}
          hint="Under repair, faulty or needing attention"
          warn={summary.repair > 0}
        />
      </div>

      {itemsQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : itemsQ.isError ? (
        <LoadError what="inventory" error={itemsQ.error} onRetry={() => itemsQ.refetch()} />
      ) : items.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 flex flex-col items-center gap-3 text-sm text-muted-foreground">
          {hasFilters ? (
            <>
              <span>No matches</span>
              <Button size="sm" variant="outline" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" /> Clear filters
              </Button>
            </>
          ) : (
            <>
              <span>No inventory items yet</span>
              {canManage && addButton}
            </>
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Asset tag</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Assigned to</TableHead>
                  <TableHead>Office</TableHead>
                  <TableHead className="text-right">Purchase cost</TableHead>
                  <TableHead className="text-right">Current value</TableHead>
                  {canManage && (
                    <TableHead className="w-20">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, i) => (
                  <TableRow
                    key={item.id}
                    className={INVENTORY_CONDITION_ROW_STYLES[item.condition]}
                  >
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {startIndex + i + 1}
                    </TableCell>
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
                      <Badge
                        className={INVENTORY_CONDITION_STYLES[item.condition]}
                        variant="secondary"
                      >
                        {INVENTORY_CONDITION_LABELS[item.condition]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={INVENTORY_STATUS_STYLES[item.status]} variant="secondary">
                        {INVENTORY_STATUS_LABELS[item.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.department_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.assigned_user_name ? (
                        <>
                          <div className="text-foreground">{item.assigned_user_name}</div>
                          {item.assigned_to && <div className="text-xs">{item.assigned_to}</div>}
                        </>
                      ) : (
                        (item.assigned_to ?? "—")
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.office_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums whitespace-nowrap">
                      {item.purchase_cost != null ? formatCurrency(item.purchase_cost) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums whitespace-nowrap">
                      {item.current_value != null ? formatCurrency(item.current_value) : "—"}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditing(item)}
                            aria-label={`Edit ${item.device_name} (${item.asset_tag})`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Delete ${item.device_name} (${item.asset_tag})`}
                            disabled={deleteItem.isPending}
                            onClick={() => handleDelete(item)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
  const [dirty, setDirty] = useState(false);
  const { guardClose } = useUnsavedChanges(dirty);
  const close = () => {
    setDirty(false);
    onClose();
  };
  return (
    <Dialog open={!!value} onOpenChange={(open) => !open && guardClose(close)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {value && (
          <EditItemForm
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

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
  warn,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
      </div>
      <div className={cn("mt-1 text-xl font-semibold tabular-nums", warn && "text-warning")}>
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

type FormErrors = Partial<
  Record<"assetTag" | "deviceName" | "purchaseCost" | "usefulLife", string>
>;

function EditItemForm({
  value,
  onDirtyChange,
  onCancel,
  onDone,
}: {
  value: InventoryItemRow | null;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const save = useSaveInventoryItem();
  const officesQ = useOffices();
  const departmentsQ = useDepartments();
  const profilesQ = useProfilesLite();

  const initial = {
    assetTag: value?.asset_tag ?? "",
    deviceName: value?.device_name ?? "",
    description: value?.description ?? "",
    category: value?.category ?? ("laptop" as InventoryCategory),
    status: value?.status ?? ("in_use" as InventoryStatus),
    condition: value?.condition ?? ("good" as InventoryCondition),
    brand: value?.brand ?? "",
    model: value?.model ?? "",
    serialNumber: value?.serial_number ?? "",
    assignedTo: value?.assigned_to ?? "",
    assignedUserId: value?.assigned_user_id ?? "",
    departmentId: value?.department_id ?? "",
    officeId: value?.office_id ?? "",
    purchaseDate: value?.purchase_date?.slice(0, 10) ?? "",
    warrantyExpiry: value?.warranty_expiry?.slice(0, 10) ?? "",
    purchaseCost: value?.purchase_cost?.toString() ?? "",
    usefulLife: value?.useful_life_months?.toString() ?? "",
    notes: value?.notes ?? "",
  };
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<FormErrors>({});

  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some(
    (k) => initial[k] !== draft[k],
  );
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const edit = (patch: Partial<typeof initial>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as keyof FormErrors];
      return next;
    });
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!draft.assetTag.trim()) next.assetTag = "Enter the asset tag";
    if (!draft.deviceName.trim()) next.deviceName = "Enter the device name";
    if (draft.purchaseCost.trim()) {
      const n = Number(draft.purchaseCost);
      if (!Number.isFinite(n) || n < 0) next.purchaseCost = "Enter an amount of 0 or more";
    }
    if (draft.usefulLife.trim()) {
      const n = Number(draft.usefulLife);
      if (!Number.isInteger(n) || n < 1) {
        next.usefulLife = "Enter a whole number of months, 1 or more";
      }
    }
    return next;
  };

  const submit = () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    save.mutate(
      {
        id: value?.id,
        assetTag: draft.assetTag.trim(),
        deviceName: draft.deviceName.trim(),
        description: draft.description || undefined,
        category: draft.category,
        status: draft.status,
        condition: draft.condition,
        brand: draft.brand || undefined,
        model: draft.model || undefined,
        serialNumber: draft.serialNumber || undefined,
        assignedTo: draft.assignedTo.trim() || (value ? null : undefined),
        assignedUserId: draft.assignedUserId || null,
        departmentId: draft.departmentId || null,
        officeId: draft.officeId || undefined,
        purchaseDate: draft.purchaseDate || undefined,
        warrantyExpiry: draft.warrantyExpiry || undefined,
        purchaseCost: draft.purchaseCost.trim() ? Number(draft.purchaseCost) : null,
        usefulLifeMonths: draft.usefulLife.trim() ? Number(draft.usefulLife) : null,
        notes: draft.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            value ? `${draft.deviceName.trim()} updated` : `${draft.deviceName.trim()} added`,
          );
          onDone();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save item"),
      },
    );
  };

  const invalid = (key: keyof FormErrors, id: string) =>
    errors[key] ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};

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
        <DialogTitle>
          {value ? `Edit ${value.device_name} (${value.asset_tag})` : "New inventory item"}
        </DialogTitle>
        <DialogDescription>
          A piece of hardware: what it is, who has it, and what it cost.
        </DialogDescription>
      </DialogHeader>
      <RequiredNote />
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField id="inv-asset-tag" label="Asset tag" required error={errors.assetTag}>
            <Input
              id="inv-asset-tag"
              value={draft.assetTag}
              onChange={(e) => edit({ assetTag: e.target.value })}
              placeholder="AMS-LT-001"
              {...invalid("assetTag", "inv-asset-tag")}
            />
          </FormField>
          <FormField id="inv-device-name" label="Device name" required error={errors.deviceName}>
            <Input
              id="inv-device-name"
              value={draft.deviceName}
              onChange={(e) => edit({ deviceName: e.target.value })}
              placeholder="Dell Latitude 5420"
              {...invalid("deviceName", "inv-device-name")}
            />
          </FormField>
        </div>
        <FormField id="inv-description" label="Description (optional)">
          <Textarea
            id="inv-description"
            value={draft.description}
            onChange={(e) => edit({ description: e.target.value })}
            rows={2}
            placeholder="Silver, 16GB RAM, 512GB SSD…"
          />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField id="inv-category" label="Category" required>
            <Select
              value={draft.category}
              onValueChange={(v) => edit({ category: v as InventoryCategory })}
            >
              <SelectTrigger id="inv-category">
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
          </FormField>
          <FormField id="inv-status" label="Status" required>
            <Select
              value={draft.status}
              onValueChange={(v) => edit({ status: v as InventoryStatus })}
            >
              <SelectTrigger id="inv-status">
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
          </FormField>
        </div>
        <FormField id="inv-condition" label="Condition" required>
          <Select
            value={draft.condition}
            onValueChange={(v) => edit({ condition: v as InventoryCondition })}
          >
            <SelectTrigger id="inv-condition">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(INVENTORY_CONDITION_LABELS).map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField id="inv-brand" label="Brand (optional)">
            <Input
              id="inv-brand"
              value={draft.brand}
              onChange={(e) => edit({ brand: e.target.value })}
              placeholder="Dell"
            />
          </FormField>
          <FormField id="inv-model" label="Model (optional)">
            <Input
              id="inv-model"
              value={draft.model}
              onChange={(e) => edit({ model: e.target.value })}
              placeholder="Latitude 5420"
            />
          </FormField>
        </div>
        <FormField id="inv-serial" label="Serial number (optional)">
          <Input
            id="inv-serial"
            value={draft.serialNumber}
            onChange={(e) => edit({ serialNumber: e.target.value })}
          />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField id="inv-assigned-user" label="Assigned to (optional)">
            <Select
              value={draft.assignedUserId || NONE}
              onValueChange={(v) => edit({ assignedUserId: v === NONE ? "" : v })}
            >
              <SelectTrigger id="inv-assigned-user">
                <SelectValue placeholder="No one" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No one</SelectItem>
                {(profilesQ.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name ?? p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            id="inv-assigned-to"
            label="Or location / other person (optional)"
            hint="For shared rooms or people not on AIMS"
          >
            <Input
              id="inv-assigned-to"
              value={draft.assignedTo}
              onChange={(e) => edit({ assignedTo: e.target.value })}
              placeholder="e.g. Boardroom"
            />
          </FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField id="inv-department" label="Department (optional)">
            <Select
              value={draft.departmentId || NONE}
              onValueChange={(v) => edit({ departmentId: v === NONE ? "" : v })}
            >
              <SelectTrigger id="inv-department">
                <SelectValue placeholder="No department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No department</SelectItem>
                {(departmentsQ.data ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="inv-office" label="Office (optional)">
            <Select
              value={draft.officeId || NONE}
              onValueChange={(v) => edit({ officeId: v === NONE ? "" : v })}
            >
              <SelectTrigger id="inv-office">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {(officesQ.data ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField id="inv-purchase-date" label="Purchase date (optional)">
            <Input
              id="inv-purchase-date"
              type="date"
              value={draft.purchaseDate}
              onChange={(e) => edit({ purchaseDate: e.target.value })}
            />
          </FormField>
          <FormField id="inv-warranty" label="Warranty expiry (optional)">
            <Input
              id="inv-warranty"
              type="date"
              value={draft.warrantyExpiry}
              onChange={(e) => edit({ warrantyExpiry: e.target.value })}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            id="inv-cost"
            label="Purchase cost in KES (optional)"
            error={errors.purchaseCost}
          >
            <Input
              id="inv-cost"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={draft.purchaseCost}
              onChange={(e) => edit({ purchaseCost: e.target.value })}
              placeholder="e.g. 120000"
              {...invalid("purchaseCost", "inv-cost")}
            />
          </FormField>
          <FormField
            id="inv-useful-life"
            label="Useful life in months (optional)"
            hint="How long until it's worth nothing — e.g. 36 for a laptop"
            error={errors.usefulLife}
          >
            <Input
              id="inv-useful-life"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={draft.usefulLife}
              onChange={(e) => edit({ usefulLife: e.target.value })}
              placeholder="e.g. 36"
              {...invalid("usefulLife", "inv-useful-life")}
            />
          </FormField>
        </div>
        <FormField id="inv-notes" label="Notes (optional)">
          <Textarea
            id="inv-notes"
            value={draft.notes}
            onChange={(e) => edit({ notes: e.target.value })}
            rows={3}
          />
        </FormField>
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {value ? "Save item" : "Add inventory item"}
        </Button>
      </DialogFooter>
    </form>
  );
}
