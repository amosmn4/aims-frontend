import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import type { PaginatedResponse } from "@/hooks/use-pagination";

export type InventoryCategory =
  "laptop" | "desktop" | "monitor" | "printer" | "peripheral" | "other";
export type InventoryStatus = "in_use" | "idle" | "in_storage" | "under_repair" | "retired";
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
  in_storage: "In Storage",
  under_repair: "Under Repair",
  retired: "Retired",
};

// Solid theme-color fills (not translucent tints) — reads clearly regardless of the surrounding
// card/table background, in both light and dark mode.
export const INVENTORY_STATUS_STYLES: Record<InventoryStatus, string> = {
  in_use: "bg-success text-success-foreground",
  idle: "bg-secondary text-secondary-foreground",
  in_storage: "bg-primary text-primary-foreground",
  under_repair: "bg-warning text-warning-foreground",
  retired: "bg-destructive text-destructive-foreground",
};

export const INVENTORY_CONDITION_LABELS: Record<InventoryCondition, string> = {
  good: "Good",
  working: "Working",
  needs_attention: "Needs Attention",
  faulty: "Faulty",
};

export const INVENTORY_CONDITION_STYLES: Record<InventoryCondition, string> = {
  good: "bg-success text-success-foreground",
  working: "bg-primary text-primary-foreground",
  needs_attention: "bg-warning text-warning-foreground",
  faulty: "bg-destructive text-destructive-foreground",
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
  purchase_cost: number | null;
  useful_life_months: number | null;
  current_value: number | null;
  department_id: string | null;
  department_name: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
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
  purchaseCost: string | number | null;
  usefulLifeMonths: number | null;
  currentValue: number | null;
  departmentId: string | null;
  department: { id: string; name: string; code: string } | null;
  assignedUserId: string | null;
  assignedUser: { id: string; fullName: string | null; email: string } | null;
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
    assigned_to: i.assignedTo || null,
    office_id: i.officeId,
    office_name: i.office?.name ?? null,
    purchase_date: i.purchaseDate,
    warranty_expiry: i.warrantyExpiry,
    notes: i.notes,
    purchase_cost: i.purchaseCost == null ? null : Number(i.purchaseCost),
    useful_life_months: i.usefulLifeMonths ?? null,
    current_value: i.currentValue ?? null,
    department_id: i.departmentId ?? null,
    department_name: i.department?.name ?? null,
    assigned_user_id: i.assignedUserId ?? null,
    assigned_user_name: i.assignedUser ? (i.assignedUser.fullName ?? i.assignedUser.email) : null,
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
  // null clears the value on edit.
  assignedTo?: string | null;
  officeId?: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  notes?: string;
  purchaseCost?: number | null;
  usefulLifeMonths?: number | null;
  departmentId?: string | null;
  assignedUserId?: string | null;
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
        assignedTo: input.assignedTo === null ? null : input.assignedTo || undefined,
        officeId: input.officeId || undefined,
        purchaseDate: input.purchaseDate || undefined,
        warrantyExpiry: input.warrantyExpiry || undefined,
        notes: input.notes || undefined,
        purchaseCost: input.purchaseCost,
        usefulLifeMonths: input.usefulLifeMonths,
        departmentId: input.departmentId,
        assignedUserId: input.assignedUserId,
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
