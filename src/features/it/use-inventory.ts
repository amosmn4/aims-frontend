import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export type InventoryCategory =
  "laptop" | "desktop" | "monitor" | "printer" | "peripheral" | "other";
export type InventoryStatus = "in_use" | "in_storage" | "under_repair" | "retired";

export const INVENTORY_CATEGORY_LABELS: Record<InventoryCategory, string> = {
  laptop: "Laptop",
  desktop: "Desktop",
  monitor: "Monitor",
  printer: "Printer",
  peripheral: "Peripheral",
  other: "Other",
};

export const INVENTORY_STATUS_LABELS: Record<InventoryStatus, string> = {
  in_use: "In Use",
  in_storage: "In Storage",
  under_repair: "Under Repair",
  retired: "Retired",
};

export const INVENTORY_STATUS_STYLES: Record<InventoryStatus, string> = {
  in_use: "bg-success/15 text-success",
  in_storage: "bg-secondary text-secondary-foreground",
  under_repair: "bg-warning/15 text-warning",
  retired: "bg-destructive/15 text-destructive",
};

export interface InventoryItemRow {
  id: string;
  asset_tag: string;
  device_name: string;
  description: string | null;
  category: InventoryCategory;
  status: InventoryStatus;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  assigned_to: string | null;
  office_id: string | null;
  office_name: string | null;
  purchase_date: string | null;
  warranty_expiry: string | null;
  notes: string | null;
}

type BackendInventoryItem = {
  id: string;
  assetTag: string;
  deviceName: string;
  description: string | null;
  category: InventoryCategory;
  status: InventoryStatus;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  assignedTo: string | null;
  officeId: string | null;
  office: { id: string; name: string } | null;
  purchaseDate: string | null;
  warrantyExpiry: string | null;
  notes: string | null;
};

function mapInventoryItem(i: BackendInventoryItem): InventoryItemRow {
  return {
    id: i.id,
    asset_tag: i.assetTag,
    device_name: i.deviceName,
    description: i.description,
    category: i.category,
    status: i.status,
    brand: i.brand,
    model: i.model,
    serial_number: i.serialNumber,
    assigned_to: i.assignedTo,
    office_id: i.officeId,
    office_name: i.office?.name ?? null,
    purchase_date: i.purchaseDate,
    warranty_expiry: i.warrantyExpiry,
    notes: i.notes,
  };
}

export function useInventoryItems() {
  return useQuery({
    queryKey: ["inventory"],
    queryFn: async () =>
      (await apiJson<BackendInventoryItem[]>("/inventory")).map(mapInventoryItem),
  });
}

export interface SaveInventoryItemInput {
  id?: string;
  assetTag: string;
  deviceName: string;
  description?: string;
  category: InventoryCategory;
  status?: InventoryStatus;
  brand?: string;
  model?: string;
  serialNumber?: string;
  assignedTo?: string;
  officeId?: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  notes?: string;
}

export function useSaveInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveInventoryItemInput) => {
      const body = {
        assetTag: input.assetTag,
        deviceName: input.deviceName,
        description: input.description || undefined,
        category: input.category,
        status: input.status || undefined,
        brand: input.brand || undefined,
        model: input.model || undefined,
        serialNumber: input.serialNumber || undefined,
        assignedTo: input.assignedTo || undefined,
        officeId: input.officeId || undefined,
        purchaseDate: input.purchaseDate || undefined,
        warrantyExpiry: input.warrantyExpiry || undefined,
        notes: input.notes || undefined,
      };
      if (input.id) {
        return mapInventoryItem(
          await apiJson<BackendInventoryItem>(`/inventory/${input.id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          }),
        );
      }
      return mapInventoryItem(
        await apiJson<BackendInventoryItem>("/inventory", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

export function useDeleteInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiJson(`/inventory/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
}
