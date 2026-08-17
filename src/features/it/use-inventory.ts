import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import type { PaginatedResponse } from "@/hooks/use-pagination";

export type InventoryCategory =
  "laptop" | "desktop" | "monitor" | "printer" | "peripheral" | "other";
export type InventoryStatus = "in_use" | "idle";
export type InventoryCondition = "good" | "working" | "needs_attention" | "faulty";

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
  idle: "Idle",
};

export const INVENTORY_STATUS_STYLES: Record<InventoryStatus, string> = {
  in_use: "bg-success/15 text-success",
  idle: "bg-secondary text-secondary-foreground",
};

export const INVENTORY_CONDITION_LABELS: Record<InventoryCondition, string> = {
  good: "Good",
  working: "Working",
  needs_attention: "Needs Attention",
  faulty: "Faulty",
};

export const INVENTORY_CONDITION_STYLES: Record<InventoryCondition, string> = {
  good: "bg-success/15 text-success",
  working: "bg-primary/15 text-primary",
  needs_attention: "bg-warning/15 text-warning",
  faulty: "bg-destructive/15 text-destructive",
};

// Subtle per-condition row tints for the table — deliberately light, not "heavy" colors.
export const INVENTORY_CONDITION_ROW_STYLES: Record<InventoryCondition, string> = {
  good: "bg-success/5",
  working: "bg-primary/5",
  needs_attention: "bg-warning/8",
  faulty: "bg-destructive/8",
};

export interface InventoryItemRow {
  id: string;
  asset_tag: string;
  device_name: string;
  description: string | null;
  category: InventoryCategory;
  status: InventoryStatus;
  condition: InventoryCondition;
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
  condition: InventoryCondition;
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
    condition: i.condition,
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

export interface InventoryFilters {
  category?: InventoryCategory;
  status?: InventoryStatus;
  condition?: InventoryCondition;
  officeId?: string;
  q?: string;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

// See useTenders' matching overload comment (features/tender/use-tender.ts) — same reasoning.
export function useInventoryItems(filters?: InventoryFilters): UseQueryResult<InventoryItemRow[]>;
export function useInventoryItems(
  filters: InventoryFilters,
  pagination: { page: number; pageSize: number },
): UseQueryResult<InventoryItemRow[] | PaginatedResponse<InventoryItemRow>>;
export function useInventoryItems(
  filters: InventoryFilters = {},
  pagination: { page?: number; pageSize?: number } = {},
) {
  return useQuery({
    queryKey: ["inventory", filters, pagination],
    queryFn: async () => {
      const qs = buildQuery({ ...filters, ...pagination });
      const raw = await apiJson<BackendInventoryItem[] | PaginatedResponse<BackendInventoryItem>>(
        `/inventory${qs}`,
      );
      return Array.isArray(raw)
        ? raw.map(mapInventoryItem)
        : { ...raw, data: raw.data.map(mapInventoryItem) };
    },
  });
}

export interface SaveInventoryItemInput {
  id?: string;
  assetTag: string;
  deviceName: string;
  description?: string;
  category: InventoryCategory;
  status?: InventoryStatus;
  condition?: InventoryCondition;
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
        condition: input.condition || undefined,
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
