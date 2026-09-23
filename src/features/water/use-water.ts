import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type Query,
  type QueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import type { PaginatedResponse } from "@/hooks/use-pagination";

// Same rule as the Water layout guard and the backend's @Roles("water").
export function useCanManageWater() {
  const { hasRole, isAdminOrCeo } = useAuth();
  return isAdminOrCeo || hasRole("water");
}

// Skips the deleted record's own detail query so it doesn't refetch into a 404.
function exceptDetailOf(entity: string, id: string) {
  return (q: Query) => !(q.queryKey[1] === entity && q.queryKey[2] === id);
}

export type WaterMeterType = "main" | "bulk" | "household";

export const WATER_METER_TYPE_LABELS: Record<WaterMeterType, string> = {
  main: "Main",
  bulk: "Bulk / zone",
  household: "Household",
};

// Two stages of one chain, not parallel sources. Must match backend's MAIN_METER_NAMES exactly.
export const MAIN_METER_NAMES = ["Borehole → Tank", "Tank → Distribution"] as const;

export type WaterVendingSystem = "amsol" | "mpaya";

export const WATER_VENDING_SYSTEM_LABELS: Record<WaterVendingSystem, string> = {
  amsol: "Amsol",
  mpaya: "mPaya",
};

export interface WaterZoneRow {
  id: string;
  name: string;
  parent_zone_id: string | null;
  parent_zone_name: string | null;
  child_count: number;
  meter_count: number;
  active_meter_count: number;
  customer_count: number;
  created_at: string;
}

// Flat, unpaginated — builds the "Zone" then "Sub-zone" cascading pickers on forms.
export interface WaterZoneTreeNode {
  id: string;
  name: string;
  parent_zone_id: string | null;
}

export interface WaterCustomerRow {
  id: string;
  name: string;
  zone_id: string | null;
  zone_name: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  meters: { id: string; meter_number: string }[];
}

export interface WaterMeterRow {
  id: string;
  meter_number: string;
  meter_type: WaterMeterType;
  // Main meters only: which stretch of the network this one measures.
  main_stage: WaterMainStage | null;
  // Main/bulk meters only — no customer, identified by name + physical location instead.
  name: string | null;
  location: string | null;
  customer_id: string | null;
  customer_name: string | null;
  plot_no: string | null;
  installed_at: string | null;
  zone_id: string | null;
  zone_name: string | null;
  is_active: boolean;
  created_at: string;
  last_vend_at: string | null;
  total_vend_count: number;
  last_reading_at: string | null;
  total_reading_count: number;
  vending_system: WaterVendingSystem;
  replaces_meter_id: string | null;
  replaces_meter: { id: string; meter_number: string; vending_system: WaterVendingSystem } | null;
  replaced_by_meter: {
    id: string;
    meter_number: string;
    vending_system: WaterVendingSystem;
  } | null;
}

export interface WaterUsageRecordRow {
  id: string;
  meter_id: string;
  meter_number: string;
  customer_id: string | null;
  customer_name: string;
  units_sold: number;
  amount_paid: number;
  recorded_at: string;
  source: "seed" | "upload" | "manual";
}

export interface WaterUsageUploadRow {
  id: string;
  file_name: string;
  record_count: number;
  uploaded_by_name: string | null;
  created_at: string;
  period_start: string | null;
  period_end: string | null;
}

export interface WaterMeterReadingRow {
  id: string;
  meter_id: string;
  meter_number: string;
  meter_name: string | null;
  zone_name: string | null;
  meter_type: WaterMeterType;
  reading_date: string;
  value: number;
  notes: string | null;
  created_at: string;
}

export type MeterStatusCounts = Record<WaterMeterType, { active: number; inactive: number }>;

/** Household and bulk kept apart — a bulk meter covers a zone, a household meter one plot. */
export interface WaterMeterAverages {
  per_household_meter: number | null;
  per_bulk_meter: number | null;
  household_meters: number;
  bulk_meters: number;
}

export interface WaterDashboard {
  month: string;
  averages: WaterMeterAverages;
  active_households: number;
  active_meters: number;
  inactive_meters: number;
  meter_status: MeterStatusCounts;
  units_sold: number;
  units_sold_change_pct: number | null;
  revenue: number;
  main_reading_total: number;
  bulk_reading_total: number;
  // Stage 1: borehole -> tank. Stage 2: tank -> distribution. Overall: borehole vs. all households.
  nrw_borehole_to_tank_pct: number | null;
  nrw_tank_to_network_pct: number | null;
  nrw_overall_pct: number | null;
}

export interface WaterTrendPoint {
  /** Week start date, or the month key — whichever the view asked for. */
  period: string;
  granularity: "week" | "month";
  month: string;
  period_start: string | null;
  period_end: string | null;
  main_total: number;
  bulk_total: number;
  household_total: number;
}

export interface WaterZoneComparisonRow {
  zone_id: string | null;
  zone_name: string;
  parent_zone_id: string | null;
  bulk_total: number;
  household_total: number;
  loss_units: number;
  loss_pct: number | null;
}

export interface WaterReportSummary {
  month: string;
  dashboard: WaterDashboard;
  prev_dashboard: WaterDashboard;
  zone_loss: WaterZoneComparisonRow[];
  insights: string[];
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/* ---------- Zones ---------- */

type BackendZone = {
  id: string;
  name: string;
  parentZoneId: string | null;
  parent: { id: string; name: string } | null;
  _count: { children: number; meters: number; customers: number };
  activeMeterCount?: number;
  createdAt: string;
};

function mapZone(z: BackendZone): WaterZoneRow {
  return {
    id: z.id,
    name: z.name,
    parent_zone_id: z.parentZoneId,
    parent_zone_name: z.parent?.name ?? null,
    child_count: z._count.children,
    meter_count: z._count.meters,
    active_meter_count: z.activeMeterCount ?? z._count.meters,
    customer_count: z._count.customers,
    created_at: z.createdAt,
  };
}

export function useWaterZones(
  filters: { q?: string } = {},
  pagination: { page?: number; pageSize?: number } = {},
) {
  return useQuery({
    queryKey: ["water", "zones", filters, pagination],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const raw = await apiJson<BackendZone[] | PaginatedResponse<BackendZone>>(
        `/water/zones${buildQuery({ ...filters, ...pagination })}`,
      );
      return Array.isArray(raw) ? raw.map(mapZone) : { ...raw, data: raw.data.map(mapZone) };
    },
  });
}

export function useWaterAllZones() {
  return useQuery({
    queryKey: ["water", "zones", "all"],
    queryFn: async () => {
      const raw =
        await apiJson<{ id: string; name: string; parentZoneId: string | null }[]>(
          "/water/zones/all",
        );
      return raw.map((z): WaterZoneTreeNode => ({
        id: z.id,
        name: z.name,
        parent_zone_id: z.parentZoneId,
      }));
    },
  });
}

export function useCreateWaterZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; parentZoneId?: string }) =>
      apiJson("/water/zones", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water", "zones"] }),
  });
}

export function useUpdateWaterZone() {
  const qc = useQueryClient();
  return useMutation({
    // parentZoneId null moves the zone to the top level.
    mutationFn: ({ id, ...input }: { id: string; name?: string; parentZoneId?: string | null }) =>
      apiJson(`/water/zones/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["water", "zones"] });
      qc.invalidateQueries({ queryKey: ["water", "meters"] });
      qc.invalidateQueries({ queryKey: ["water", "customers"] });
    },
  });
}

export function useDeleteWaterZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/water/zones/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water", "zones"] }),
  });
}

/* ---------- One zone, opened ---------- */

export interface WaterZoneMeter {
  id: string;
  meter_number: string;
  meter_type: WaterMeterType;
  name: string | null;
  plot_no: string | null;
  customer_id: string | null;
  customer_name: string | null;
  is_active: boolean;
}

export interface WaterZoneDetail {
  id: string;
  name: string;
  parent_zone_id: string | null;
  parent: { id: string; name: string } | null;
  month: string;
  children: { id: string; name: string }[];
  bulk_meters: WaterZoneMeter[];
  household_meters: WaterZoneMeter[];
  customer_count: number;
  active_household_meters: number;
  has_bulk_meter: boolean;
  /** This zone's bulk meter — already contains every bulk meter beneath it. */
  bulk_total: number;
  child_bulk_total: number;
  direct_household_total: number;
  accounted_total: number;
  loss_units: number;
  loss_pct: number | null;
  revenue: number;
}

type BackendZoneMeter = {
  id: string;
  meterNumber: string;
  meterType: WaterMeterType;
  name: string | null;
  plotNo: string | null;
  customerId: string | null;
  customer: { id: string; name: string } | null;
  isActive: boolean;
};

type BackendZoneDetail = {
  id: string;
  name: string;
  parentZoneId: string | null;
  parent: { id: string; name: string } | null;
  month: string;
  children: { id: string; name: string }[];
  bulkMeters: BackendZoneMeter[];
  householdMeters: BackendZoneMeter[];
  customerCount: number;
  activeHouseholdMeters: number;
  hasBulkMeter: boolean;
  bulkTotal: number;
  childBulkTotal: number;
  directHouseholdTotal: number;
  accountedTotal: number;
  lossUnits: number;
  lossPct: number | null;
  revenue: number;
};

function mapZoneMeter(m: BackendZoneMeter): WaterZoneMeter {
  return {
    id: m.id,
    meter_number: m.meterNumber,
    meter_type: m.meterType,
    name: m.name,
    plot_no: m.plotNo,
    customer_id: m.customerId,
    customer_name: m.customer?.name ?? null,
    is_active: m.isActive,
  };
}

function mapZoneDetail(d: BackendZoneDetail): WaterZoneDetail {
  return {
    id: d.id,
    name: d.name,
    parent_zone_id: d.parentZoneId,
    parent: d.parent,
    month: d.month,
    children: d.children,
    bulk_meters: d.bulkMeters.map(mapZoneMeter),
    household_meters: d.householdMeters.map(mapZoneMeter),
    customer_count: d.customerCount,
    active_household_meters: d.activeHouseholdMeters,
    has_bulk_meter: d.hasBulkMeter,
    bulk_total: d.bulkTotal,
    child_bulk_total: d.childBulkTotal,
    direct_household_total: d.directHouseholdTotal,
    accounted_total: d.accountedTotal,
    loss_units: d.lossUnits,
    loss_pct: d.lossPct,
    revenue: d.revenue,
  };
}

export function useWaterZoneDetail(zoneId: string | undefined, month?: string) {
  return useQuery({
    queryKey: ["water", "zones", zoneId, "detail", month ?? ""],
    enabled: !!zoneId,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      mapZoneDetail(
        await apiJson<BackendZoneDetail>(`/water/zones/${zoneId}/detail${buildQuery({ month })}`),
      ),
  });
}

export interface UnassignedMeter {
  id: string;
  meter_number: string;
  meter_type: WaterMeterType;
  plot_no: string | null;
  is_active: boolean;
  customer: { id: string; name: string } | null;
}

/** Meters sitting in no zone yet, so they can be placed. */
export function useUnassignedWaterMeters(meterType?: WaterMeterType, enabled = true) {
  return useQuery({
    queryKey: ["water", "meters", "unassigned", meterType ?? "all"],
    enabled,
    queryFn: () =>
      apiJson<UnassignedMeter[]>(`/water/meters/unassigned${buildQuery({ meterType })}`),
  });
}

/** Places several meters into a zone in one go. */
export function useAssignMetersToZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ zoneId, meterIds }: { zoneId: string; meterIds: string[] }) =>
      apiJson(`/water/zones/${zoneId}/meters`, {
        method: "POST",
        body: JSON.stringify({ meterIds }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["water", "meters"] });
      qc.invalidateQueries({ queryKey: ["water", "zones"] });
      qc.invalidateQueries({ queryKey: ["water", "zone-comparison"] });
      qc.invalidateQueries({ queryKey: ["water", "zone-series"] });
      qc.invalidateQueries({ queryKey: ["water", "customers"] });
    },
  });
}

/** Moves one meter between zones without touching any of its other details. */
export function useMoveWaterMeterZone() {
  const qc = useQueryClient();
  return useMutation({
    // null takes the meter out of every zone — it sits on the main line.
    mutationFn: ({ id, zoneId }: { id: string; zoneId: string | null }) =>
      apiJson(`/water/meters/${id}`, { method: "PATCH", body: JSON.stringify({ zoneId }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["water", "meters"] });
      qc.invalidateQueries({ queryKey: ["water", "zones"] });
      qc.invalidateQueries({ queryKey: ["water", "zone-comparison"] });
      qc.invalidateQueries({ queryKey: ["water", "zone-series"] });
    },
  });
}

/* ---------- Zone series (every zone, period by period) ---------- */

export interface WaterZoneSeriesPoint {
  period: string;
  bulk_units: number;
  household_units: number;
  revenue: number;
}

export interface WaterZoneSeriesRow {
  zone_id: string;
  zone_name: string;
  parent_zone_id: string | null;
  points: WaterZoneSeriesPoint[];
}

export interface WaterZoneSeries {
  periods: string[];
  zones: WaterZoneSeriesRow[];
}

export function useWaterZoneSeries(
  filters: { granularity?: "week" | "month"; periods?: number } = {},
) {
  return useQuery({
    queryKey: ["water", "zone-series", filters],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const raw = await apiJson<{
        periods: string[];
        zones: {
          zoneId: string;
          zoneName: string;
          parentZoneId: string | null;
          points: { period: string; bulkUnits: number; householdUnits: number; revenue: number }[];
        }[];
      }>(`/water/zone-series${buildQuery(filters)}`);
      return {
        periods: raw.periods,
        zones: raw.zones.map((z) => ({
          zone_id: z.zoneId,
          zone_name: z.zoneName,
          parent_zone_id: z.parentZoneId,
          points: z.points.map((p) => ({
            period: p.period,
            bulk_units: p.bulkUnits,
            household_units: p.householdUnits,
            revenue: p.revenue,
          })),
        })),
      } satisfies WaterZoneSeries;
    },
  });
}

/* ---------- Customers ---------- */

type BackendCustomer = {
  id: string;
  name: string;
  zoneId: string | null;
  zone: { id: string; name: string } | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  meters: { id: string; meterNumber: string }[];
};

function mapCustomer(c: BackendCustomer): WaterCustomerRow {
  return {
    id: c.id,
    name: c.name,
    zone_id: c.zoneId,
    zone_name: c.zone?.name ?? null,
    phone: c.phone,
    is_active: c.isActive,
    created_at: c.createdAt,
    meters: c.meters.map((m) => ({ id: m.id, meter_number: m.meterNumber })),
  };
}

type WaterCustomerFilters = { zoneId?: string; q?: string };

// Overloaded so a bare call gets a plain array type; only a paginated call sees the envelope union.
export function useWaterCustomers(
  filters?: WaterCustomerFilters,
): UseQueryResult<WaterCustomerRow[]>;
export function useWaterCustomers(
  filters: WaterCustomerFilters,
  pagination: { page: number; pageSize: number },
): UseQueryResult<WaterCustomerRow[] | PaginatedResponse<WaterCustomerRow>>;
export function useWaterCustomers(
  filters: WaterCustomerFilters = {},
  pagination: { page?: number; pageSize?: number } = {},
) {
  return useQuery({
    queryKey: ["water", "customers", filters, pagination],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const qs = buildQuery({ ...filters, ...pagination });
      const raw = await apiJson<BackendCustomer[] | PaginatedResponse<BackendCustomer>>(
        `/water/customers${qs}`,
      );
      return Array.isArray(raw)
        ? raw.map(mapCustomer)
        : { ...raw, data: raw.data.map(mapCustomer) };
    },
  });
}

export interface SaveCustomerInput {
  id?: string;
  name: string;
  zoneId?: string;
  phone?: string;
  isActive?: boolean;
}

export function useSaveWaterCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveCustomerInput) => {
      // On edit, blanks are sent as null so the stored value is cleared.
      const blank = input.id ? null : undefined;
      const body = {
        name: input.name,
        zoneId: input.zoneId || blank,
        phone: input.phone || blank,
        isActive: input.isActive,
      };
      if (input.id) {
        await apiJson(`/water/customers/${input.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await apiJson("/water/customers", { method: "POST", body: JSON.stringify(body) });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["water", "customers"] });
      qc.invalidateQueries({ queryKey: ["water", "meters"] });
      qc.invalidateQueries({ queryKey: ["water", "zones"] });
    },
  });
}

export function useDeleteWaterCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/water/customers/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) =>
      qc.invalidateQueries({ queryKey: ["water"], predicate: exceptDetailOf("customers", id) }),
  });
}

/* ---------- Meters — the primary registration entry point ---------- */

type BackendMeter = {
  id: string;
  meterNumber: string;
  meterType: WaterMeterType;
  mainStage?: WaterMainStage | null;
  name: string | null;
  location: string | null;
  customerId: string | null;
  customer: { id: string; name: string } | null;
  plotNo: string | null;
  installedAt: string | null;
  zoneId: string | null;
  zone: { id: string; name: string } | null;
  isActive: boolean;
  createdAt: string;
  usageRecords?: { recordedAt: string }[];
  readings?: { readingDate: string }[];
  _count?: { usageRecords: number; readings?: number };
  vendingSystem: WaterVendingSystem;
  replacesMeterId: string | null;
  replacesMeter: { id: string; meterNumber: string; vendingSystem: WaterVendingSystem } | null;
  replacedByMeter: { id: string; meterNumber: string; vendingSystem: WaterVendingSystem } | null;
};

function mapMeter(m: BackendMeter): WaterMeterRow {
  return {
    id: m.id,
    meter_number: m.meterNumber,
    meter_type: m.meterType,
    main_stage: m.mainStage ?? null,
    name: m.name,
    location: m.location,
    customer_id: m.customerId,
    customer_name: m.customer?.name ?? null,
    plot_no: m.plotNo,
    installed_at: m.installedAt,
    zone_id: m.zoneId,
    zone_name: m.zone?.name ?? null,
    is_active: m.isActive,
    created_at: m.createdAt,
    last_vend_at: m.usageRecords?.[0]?.recordedAt ?? null,
    total_vend_count: m._count?.usageRecords ?? 0,
    last_reading_at: m.readings?.[0]?.readingDate ?? null,
    total_reading_count: m._count?.readings ?? 0,
    vending_system: m.vendingSystem,
    replaces_meter_id: m.replacesMeterId,
    replaces_meter: m.replacesMeter
      ? {
          id: m.replacesMeter.id,
          meter_number: m.replacesMeter.meterNumber,
          vending_system: m.replacesMeter.vendingSystem,
        }
      : null,
    replaced_by_meter: m.replacedByMeter
      ? {
          id: m.replacedByMeter.id,
          meter_number: m.replacedByMeter.meterNumber,
          vending_system: m.replacedByMeter.vendingSystem,
        }
      : null,
  };
}

export type WaterMeterStatus = "active" | "inactive";

type WaterMeterFilters = {
  meterType?: WaterMeterType;
  zoneId?: string;
  q?: string;
  vendingSystem?: WaterVendingSystem;
  status?: WaterMeterStatus;
};

// See useWaterCustomers' matching overload comment above — same reasoning.
export function useWaterMeters(filters?: WaterMeterFilters): UseQueryResult<WaterMeterRow[]>;
export function useWaterMeters(
  filters: WaterMeterFilters,
  pagination: { page: number; pageSize: number },
): UseQueryResult<WaterMeterRow[] | PaginatedResponse<WaterMeterRow>>;
export function useWaterMeters(
  filters: WaterMeterFilters = {},
  pagination: { page?: number; pageSize?: number } = {},
) {
  return useQuery({
    queryKey: ["water", "meters", filters, pagination],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const qs = buildQuery({ ...filters, ...pagination });
      const raw = await apiJson<BackendMeter[] | PaginatedResponse<BackendMeter>>(
        `/water/meters${qs}`,
      );
      return Array.isArray(raw) ? raw.map(mapMeter) : { ...raw, data: raw.data.map(mapMeter) };
    },
  });
}

/** Every registered meter number, to warn about unknown meters before an upload is saved. */
export function useWaterMeterNumbers(enabled: boolean) {
  return useQuery({
    queryKey: ["water", "meters", "numbers"],
    enabled,
    queryFn: async () => {
      const raw = await apiJson<BackendMeter[] | PaginatedResponse<BackendMeter>>("/water/meters");
      return new Set((Array.isArray(raw) ? raw : raw.data).map((m) => m.meterNumber));
    },
  });
}

export interface SaveMeterInput {
  id?: string;
  meterNumber: string;
  meterType?: WaterMeterType;
  mainStage?: WaterMainStage | null;
  name?: string | null;
  location?: string | null;
  customerId?: string;
  customerName?: string;
  plotNo?: string | null;
  installedAt?: string | null;
  zoneId?: string | null;
  isActive?: boolean;
  vendingSystem?: WaterVendingSystem;
  replacesMeterId?: string | null;
}

export function useSaveWaterMeter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveMeterInput) => {
      // On edit, blank optional fields are sent as null so the stored value is cleared.
      const blank = input.id ? null : undefined;
      const body = {
        meterNumber: input.meterNumber,
        meterType: input.meterType,
        // Backend clears this for bulk and household meters.
        mainStage: input.mainStage || blank,
        name: input.name || blank,
        location: input.location || blank,
        customerId: input.customerId || undefined,
        customerName: input.customerName || undefined,
        vendingSystem: input.vendingSystem || undefined,
        replacesMeterId: input.replacesMeterId || blank,
        plotNo: input.plotNo || blank,
        installedAt: input.installedAt || blank,
        zoneId: input.zoneId || blank,
        isActive: input.isActive,
      };
      if (input.id) {
        await apiJson(`/water/meters/${input.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiJson("/water/meters", { method: "POST", body: JSON.stringify(body) });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["water", "meters"] });
      qc.invalidateQueries({ queryKey: ["water", "customers"] });
      qc.invalidateQueries({ queryKey: ["water", "zones"] });
      qc.invalidateQueries({ queryKey: ["water", "readings"] });
      qc.invalidateQueries({ queryKey: ["water", "readings-with-delta"] });
    },
  });
}

// Readings and usage records cascade with the meter, so every water view may change.
export function useDeleteWaterMeter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/water/meters/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) =>
      qc.invalidateQueries({ queryKey: ["water"], predicate: exceptDetailOf("meters", id) }),
  });
}

/* ---------- Meter readings ---------- */

type BackendReading = {
  id: string;
  meterId: string;
  meter: {
    id: string;
    meterNumber: string;
    meterType: WaterMeterType;
    name?: string | null;
    zoneId: string | null;
    zone?: { id: string; name: string } | null;
  };
  readingDate: string;
  value: number | string;
  notes: string | null;
  createdAt: string;
};

function mapReading(r: BackendReading): WaterMeterReadingRow {
  return {
    id: r.id,
    meter_id: r.meterId,
    meter_number: r.meter.meterNumber,
    meter_name: r.meter.name ?? null,
    zone_name: r.meter.zone?.name ?? null,
    meter_type: r.meter.meterType,
    reading_date: r.readingDate,
    value: Number(r.value),
    notes: r.notes,
    created_at: r.createdAt,
  };
}

// Naive datetime-local strings parse as server-local time on the backend — convert client-side.
function toUtcInstant(naiveLocalDateTime: string): string {
  return new Date(naiveLocalDateTime).toISOString();
}

// Inverse — formats a stored UTC instant into a datetime-local string in browser-local time.
export function toLocalDateTimeInputValue(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const localMs = d.getTime() - d.getTimezoneOffset() * 60_000;
  return new Date(localMs).toISOString().slice(0, 16);
}

type WaterReadingFilters = {
  meterId?: string;
  meterType?: WaterMeterType;
  zoneId?: string;
  q?: string;
  from?: string;
  to?: string;
};

// Readings feed meter pages, charts and every loss/NRW figure.
const READING_DEPENDENT_KEYS = [
  "readings",
  "readings-with-delta",
  "reading-series",
  "meters",
  "dashboard",
  "trend",
  "zone-comparison",
  "report-summary",
];

function invalidateReadingViews(qc: QueryClient) {
  return Promise.all(
    READING_DEPENDENT_KEYS.map((key) => qc.invalidateQueries({ queryKey: ["water", key] })),
  );
}

export function useWaterReadings(
  filters?: WaterReadingFilters,
): UseQueryResult<WaterMeterReadingRow[]>;
export function useWaterReadings(
  filters: WaterReadingFilters,
  pagination: { page: number; pageSize: number },
): UseQueryResult<WaterMeterReadingRow[] | PaginatedResponse<WaterMeterReadingRow>>;
export function useWaterReadings(
  filters: WaterReadingFilters = {},
  pagination: { page?: number; pageSize?: number } = {},
) {
  return useQuery({
    queryKey: ["water", "readings", filters, pagination],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const qs = buildQuery({ ...filters, ...pagination });
      const raw = await apiJson<BackendReading[] | PaginatedResponse<BackendReading>>(
        `/water/readings${qs}`,
      );
      return Array.isArray(raw) ? raw.map(mapReading) : { ...raw, data: raw.data.map(mapReading) };
    },
  });
}

export function useLogWaterReading() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { meterId: string; readingDate: string; value: number; notes?: string }) =>
      apiJson("/water/readings", {
        method: "POST",
        body: JSON.stringify({ ...input, readingDate: toUtcInstant(input.readingDate) }),
      }),
    onSuccess: () => {
      invalidateReadingViews(qc);
    },
  });
}

export function useUpdateWaterReading() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      meterId?: string;
      readingDate?: string;
      value?: number;
      // null clears the notes.
      notes?: string | null;
    }) =>
      apiJson(`/water/readings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...input,
          readingDate: input.readingDate ? toUtcInstant(input.readingDate) : undefined,
        }),
      }),
    onSuccess: () => {
      invalidateReadingViews(qc);
    },
  });
}

export function useDeleteWaterReading() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/water/readings/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidateReadingViews(qc);
    },
  });
}

/* ---------- Usage uploads & records ---------- */

type BackendUpload = {
  id: string;
  fileName: string;
  recordCount: number;
  uploader: { id: string; fullName: string | null; email: string } | null;
  createdAt: string;
  _count?: { records: number };
  periodStart?: string | null;
  periodEnd?: string | null;
};

function mapUpload(u: BackendUpload): WaterUsageUploadRow {
  return {
    id: u.id,
    file_name: u.fileName,
    // Live count — records also disappear when their meter is deleted.
    record_count: u._count?.records ?? u.recordCount,
    uploaded_by_name: u.uploader?.fullName ?? u.uploader?.email ?? null,
    created_at: u.createdAt,
    period_start: u.periodStart ?? null,
    period_end: u.periodEnd ?? null,
  };
}

export function useWaterUploads(
  filters: { q?: string; month?: string } = {},
  pagination: { page?: number; pageSize?: number } = {},
) {
  return useQuery({
    queryKey: ["water", "uploads", filters, pagination],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const raw = await apiJson<BackendUpload[] | PaginatedResponse<BackendUpload>>(
        `/water/usage-uploads${buildQuery({ ...filters, ...pagination })}`,
      );
      return Array.isArray(raw) ? raw.map(mapUpload) : { ...raw, data: raw.data.map(mapUpload) };
    },
  });
}

// Removes the upload and its usage records, so any water analytic may change.
export function useDeleteWaterUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiJson<{ id: string; recordsDeleted: number }>(`/water/usage-uploads/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water"] }),
  });
}

export interface UsageUploadRowInput {
  meterNumber: string;
  customerName: string;
  unitsSold: number;
  amountPaid: number;
  recordedAt: string;
}

export interface UsageUploadResult {
  id: string;
  recordCount: number;
  duplicatesSkipped: number;
  inactiveMeterNumbers?: string[];
}

export function useCreateWaterUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      fileName: string;
      rows: UsageUploadRowInput[];
      vendingSystem?: "amsol" | "mpaya";
    }) =>
      apiJson<UsageUploadResult>("/water/usage-uploads", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["water"] });
    },
  });
}

type BackendUsageRecord = {
  id: string;
  meterId: string;
  meter: { id: string; meterNumber: string };
  customerId: string | null;
  customerName: string;
  unitsSold: number | string;
  amountPaid: number | string;
  recordedAt: string;
  source: "seed" | "upload" | "manual";
};

function mapUsageRecord(r: BackendUsageRecord): WaterUsageRecordRow {
  return {
    id: r.id,
    meter_id: r.meterId,
    meter_number: r.meter.meterNumber,
    customer_id: r.customerId,
    customer_name: r.customerName,
    units_sold: Number(r.unitsSold),
    amount_paid: Number(r.amountPaid),
    recorded_at: r.recordedAt,
    source: r.source,
  };
}

export function useWaterUsageRecords(
  filters: {
    meterId?: string;
    customerId?: string;
    zoneId?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {},
  pagination: { page?: number; pageSize?: number } = {},
) {
  return useQuery({
    queryKey: ["water", "usage-records", filters, pagination],
    queryFn: async () => {
      const qs = buildQuery({ ...filters, ...pagination });
      const raw = await apiJson<BackendUsageRecord[] | PaginatedResponse<BackendUsageRecord>>(
        `/water/usage-records${qs}`,
      );
      return Array.isArray(raw)
        ? raw.map(mapUsageRecord)
        : { ...raw, data: raw.data.map(mapUsageRecord) };
    },
  });
}

/* ---------- Analytics ---------- */

type BackendDashboard = {
  month: string;
  averages?: {
    perHouseholdMeter: number | null;
    perBulkMeter: number | null;
    householdMeters: number;
    bulkMeters: number;
  };
  activeHouseholds: number;
  activeMeters: number;
  inactiveMeters?: number;
  meterStatus?: MeterStatusCounts;
  unitsSold: number;
  unitsSoldChangePct: number | null;
  revenue: number;
  mainReadingTotal: number;
  bulkReadingTotal: number;
  nrwBoreholeToTankPct: number | null;
  nrwTankToNetworkPct: number | null;
  nrwOverallPct: number | null;
};

function mapDashboard(raw: BackendDashboard): WaterDashboard {
  return {
    month: raw.month,
    averages: {
      per_household_meter: raw.averages?.perHouseholdMeter ?? null,
      per_bulk_meter: raw.averages?.perBulkMeter ?? null,
      household_meters: raw.averages?.householdMeters ?? 0,
      bulk_meters: raw.averages?.bulkMeters ?? 0,
    },
    active_households: raw.activeHouseholds,
    active_meters: raw.activeMeters,
    inactive_meters: raw.inactiveMeters ?? 0,
    meter_status: raw.meterStatus ?? {
      main: { active: 0, inactive: 0 },
      bulk: { active: 0, inactive: 0 },
      household: { active: 0, inactive: 0 },
    },
    units_sold: raw.unitsSold,
    units_sold_change_pct: raw.unitsSoldChangePct,
    revenue: raw.revenue,
    main_reading_total: raw.mainReadingTotal,
    bulk_reading_total: raw.bulkReadingTotal,
    nrw_borehole_to_tank_pct: raw.nrwBoreholeToTankPct,
    nrw_tank_to_network_pct: raw.nrwTankToNetworkPct,
    nrw_overall_pct: raw.nrwOverallPct,
  };
}

export function useWaterDashboard(filters: { zoneId?: string; month?: string } = {}) {
  return useQuery({
    queryKey: ["water", "dashboard", filters],
    queryFn: async () => {
      const raw = await apiJson<BackendDashboard>(`/water/dashboard${buildQuery(filters)}`);
      return mapDashboard(raw);
    },
  });
}

type BackendTrendPoint = {
  period?: string;
  granularity?: "week" | "month";
  month: string;
  periodStart?: string;
  periodEnd?: string;
  mainTotal: number;
  bulkTotal: number;
  householdTotal: number;
};

/** Per-period water volumes — by week or by month, oldest first. */
export function useWaterTrend(
  filters: {
    zoneId?: string;
    months?: number;
    granularity?: "week" | "month";
    periods?: number;
  } = {},
) {
  return useQuery({
    queryKey: ["water", "trend", filters],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const raw = await apiJson<BackendTrendPoint[]>(`/water/trend${buildQuery(filters)}`);
      return raw.map((r): WaterTrendPoint => ({
        period: r.period ?? r.month,
        granularity: r.granularity ?? "month",
        month: r.month,
        period_start: r.periodStart ?? null,
        period_end: r.periodEnd ?? null,
        main_total: r.mainTotal,
        bulk_total: r.bulkTotal,
        household_total: r.householdTotal,
      }));
    },
  });
}

type BackendZoneComparisonRow = {
  zoneId: string | null;
  zoneName: string;
  parentZoneId: string | null;
  bulkTotal: number;
  householdTotal: number;
  lossUnits: number;
  lossPct: number | null;
};

function mapZoneComparisonRow(r: BackendZoneComparisonRow): WaterZoneComparisonRow {
  return {
    zone_id: r.zoneId,
    zone_name: r.zoneName,
    parent_zone_id: r.parentZoneId,
    bulk_total: r.bulkTotal,
    household_total: r.householdTotal,
    loss_units: r.lossUnits,
    loss_pct: r.lossPct,
  };
}

/** Pass a month, or a dateFrom/dateTo window for a single week. */
export function useWaterZoneComparison(
  filters: { month?: string; dateFrom?: string; dateTo?: string } = {},
) {
  return useQuery({
    queryKey: ["water", "zone-comparison", filters],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const raw = await apiJson<BackendZoneComparisonRow[]>(
        `/water/zone-comparison${buildQuery(filters)}`,
      );
      return raw.map(mapZoneComparisonRow);
    },
  });
}

export function useWaterReportSummary(filters: { month?: string } = {}) {
  return useQuery({
    queryKey: ["water", "report-summary", filters],
    queryFn: async () => {
      const raw = await apiJson<{
        month: string;
        dashboard: BackendDashboard;
        prevDashboard: BackendDashboard;
        zoneLoss: BackendZoneComparisonRow[];
        insights: string[];
      }>(`/water/reports/summary${buildQuery(filters)}`);
      return {
        month: raw.month,
        dashboard: mapDashboard(raw.dashboard),
        prev_dashboard: mapDashboard(raw.prevDashboard),
        zone_loss: raw.zoneLoss.map(mapZoneComparisonRow),
        insights: raw.insights,
      } satisfies WaterReportSummary;
    },
  });
}

/* ---------- Reading series & delta table (daily/weekly/monthly comparisons) ---------- */

export interface WaterReadingSeriesPoint {
  period: string;
  usage: number;
  reading_count: number;
}

export function useWaterReadingSeries(filters: {
  meterType: WaterMeterType;
  zoneId?: string;
  bucket: "day" | "week" | "month";
  dateFrom: string;
  dateTo: string;
}) {
  return useQuery({
    queryKey: ["water", "reading-series", filters],
    queryFn: async () => {
      const raw = await apiJson<{ period: string; usage: number; readingCount: number }[]>(
        `/water/readings/series${buildQuery(filters)}`,
      );
      return raw.map((r): WaterReadingSeriesPoint => ({
        period: r.period,
        usage: r.usage,
        reading_count: r.readingCount,
      }));
    },
  });
}

export interface WaterReadingWithDeltaRow {
  id: string;
  meter_id: string;
  meter_number: string;
  meter_name: string | null;
  meter_type: WaterMeterType;
  zone_name: string | null;
  reading_date: string;
  value: number;
  delta: number | null;
  notes: string | null;
}

type BackendReadingWithDelta = {
  id: string;
  meterId: string;
  readingDate: string;
  value: number | string;
  notes: string | null;
  delta: number | null;
  meter: {
    id: string;
    meterNumber: string;
    name: string | null;
    meterType: WaterMeterType;
    zone: { id: string; name: string } | null;
  };
};

export function useWaterReadingsWithDelta(filters: {
  meterId?: string;
  meterType?: WaterMeterType;
  zoneId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  return useQuery({
    queryKey: ["water", "readings-with-delta", filters],
    queryFn: async () => {
      const raw = await apiJson<BackendReadingWithDelta[]>(
        `/water/readings/with-delta${buildQuery(filters)}`,
      );
      return raw.map((r): WaterReadingWithDeltaRow => ({
        id: r.id,
        meter_id: r.meterId,
        meter_number: r.meter.meterNumber,
        meter_name: r.meter.name,
        meter_type: r.meter.meterType,
        zone_name: r.meter.zone?.name ?? null,
        reading_date: r.readingDate,
        value: Number(r.value),
        delta: r.delta,
        notes: r.notes,
      }));
    },
  });
}

/* ---------- Vending health (row tinting) ---------- */

export type VendingHealth = "active" | "slowing" | "inactive" | "never";

// Recency-based read: recent purchases = healthy, a long silence signals something's wrong.
export function vendingHealth(lastVendAt: string | null): VendingHealth {
  if (!lastVendAt) return "never";
  const days = (Date.now() - new Date(lastVendAt).getTime()) / 86_400_000;
  if (days <= 30) return "active";
  if (days <= 90) return "slowing";
  return "inactive";
}

export const VENDING_HEALTH_LABELS: Record<VendingHealth, string> = {
  active: "Vending well",
  slowing: "Slowing down",
  inactive: "Not vending",
  never: "No vends yet",
};

// Subtle row tints, same convention as Inventory — scannable, not a stoplight.
export const VENDING_HEALTH_ROW_STYLES: Record<VendingHealth, string> = {
  active: "bg-success/5",
  slowing: "bg-warning/8",
  inactive: "bg-destructive/8",
  never: "",
};

export const VENDING_HEALTH_BADGE_STYLES: Record<VendingHealth, string> = {
  active: "bg-success text-success-foreground",
  slowing: "bg-warning text-warning-foreground",
  inactive: "bg-destructive text-destructive-foreground",
  never: "bg-secondary text-secondary-foreground",
};

/* ---------- Meter detail (vending history, analytics, insights) ---------- */

export interface WaterMonthlyPoint {
  month: string;
  units_sold: number;
  revenue: number;
}

type BackendMeterDetail = {
  meter: {
    id: string;
    meterNumber: string;
    meterType: WaterMeterType;
    name: string | null;
    location: string | null;
    plotNo: string | null;
    installedAt: string | null;
    isActive: boolean;
    createdAt: string;
    customer: { id: string; name: string; phone: string | null; isActive: boolean } | null;
    zone: { id: string; name: string } | null;
    vendingSystem: WaterVendingSystem;
    replacesMeterId: string | null;
    replacesMeter: { id: string; meterNumber: string; vendingSystem: WaterVendingSystem } | null;
    replacedByMeter: { id: string; meterNumber: string; vendingSystem: WaterVendingSystem } | null;
  };
  totals: {
    unitsSold: number;
    revenue: number;
    transactionCount: number;
    lastVendAt: string | null;
  };
  monthly: { month: string; unitsSold: number; revenue: number }[];
  recentUsage: {
    id: string;
    customerId: string | null;
    customerName: string;
    unitsSold: number | string;
    amountPaid: number | string;
    recordedAt: string;
    source: "seed" | "upload" | "manual";
  }[];
};

export interface WaterMeterDetail {
  id: string;
  meter_number: string;
  meter_type: WaterMeterType;
  name: string | null;
  location: string | null;
  plot_no: string | null;
  installed_at: string | null;
  is_active: boolean;
  created_at: string;
  customer: { id: string; name: string; phone: string | null; is_active: boolean } | null;
  zone: { id: string; name: string } | null;
  vending_system: WaterVendingSystem;
  replaces_meter_id: string | null;
  replaces_meter: { id: string; meter_number: string; vending_system: WaterVendingSystem } | null;
  replaced_by_meter: {
    id: string;
    meter_number: string;
    vending_system: WaterVendingSystem;
  } | null;
  totals: {
    units_sold: number;
    revenue: number;
    transaction_count: number;
    last_vend_at: string | null;
  };
  monthly: WaterMonthlyPoint[];
  recent_usage: {
    id: string;
    customer_id: string | null;
    customer_name: string;
    units_sold: number;
    amount_paid: number;
    recorded_at: string;
    source: "seed" | "upload" | "manual";
  }[];
}

function mapMeterDetail(d: BackendMeterDetail): WaterMeterDetail {
  return {
    id: d.meter.id,
    meter_number: d.meter.meterNumber,
    meter_type: d.meter.meterType,
    name: d.meter.name,
    location: d.meter.location,
    plot_no: d.meter.plotNo,
    installed_at: d.meter.installedAt,
    is_active: d.meter.isActive,
    created_at: d.meter.createdAt,
    customer: d.meter.customer
      ? {
          id: d.meter.customer.id,
          name: d.meter.customer.name,
          phone: d.meter.customer.phone,
          is_active: d.meter.customer.isActive,
        }
      : null,
    zone: d.meter.zone,
    vending_system: d.meter.vendingSystem,
    replaces_meter_id: d.meter.replacesMeterId,
    replaces_meter: d.meter.replacesMeter
      ? {
          id: d.meter.replacesMeter.id,
          meter_number: d.meter.replacesMeter.meterNumber,
          vending_system: d.meter.replacesMeter.vendingSystem,
        }
      : null,
    replaced_by_meter: d.meter.replacedByMeter
      ? {
          id: d.meter.replacedByMeter.id,
          meter_number: d.meter.replacedByMeter.meterNumber,
          vending_system: d.meter.replacedByMeter.vendingSystem,
        }
      : null,
    totals: {
      units_sold: d.totals.unitsSold,
      revenue: d.totals.revenue,
      transaction_count: d.totals.transactionCount,
      last_vend_at: d.totals.lastVendAt,
    },
    monthly: d.monthly.map((m) => ({
      month: m.month,
      units_sold: m.unitsSold,
      revenue: m.revenue,
    })),
    recent_usage: d.recentUsage.map((r) => ({
      id: r.id,
      customer_id: r.customerId,
      customer_name: r.customerName,
      units_sold: Number(r.unitsSold),
      amount_paid: Number(r.amountPaid),
      recorded_at: r.recordedAt,
      source: r.source,
    })),
  };
}

export function useWaterMeterDetail(id: string | undefined, months = 6) {
  return useQuery({
    queryKey: ["water", "meters", id, "detail", months],
    queryFn: async () =>
      mapMeterDetail(
        await apiJson<BackendMeterDetail>(`/water/meters/${id}${buildQuery({ months })}`),
      ),
    enabled: !!id,
  });
}

/* ---------- Customer detail (vending history, analytics, insights) ---------- */

type BackendCustomerDetail = {
  customer: {
    id: string;
    name: string;
    phone: string | null;
    isActive: boolean;
    createdAt: string;
    zone: { id: string; name: string } | null;
    meters: {
      id: string;
      meterNumber: string;
      meterType: WaterMeterType;
      isActive: boolean;
      zone: { id: string; name: string } | null;
    }[];
  };
  totals: {
    unitsSold: number;
    revenue: number;
    transactionCount: number;
    lastVendAt: string | null;
  };
  monthly: { month: string; unitsSold: number; revenue: number }[];
  recentUsage: {
    id: string;
    meterId: string;
    meter: { id: string; meterNumber: string };
    unitsSold: number | string;
    amountPaid: number | string;
    recordedAt: string;
    source: "seed" | "upload" | "manual";
  }[];
};

export interface WaterCustomerDetail {
  id: string;
  name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  zone: { id: string; name: string } | null;
  meters: {
    id: string;
    meter_number: string;
    meter_type: WaterMeterType;
    is_active: boolean;
    zone_name: string | null;
  }[];
  totals: {
    units_sold: number;
    revenue: number;
    transaction_count: number;
    last_vend_at: string | null;
  };
  monthly: WaterMonthlyPoint[];
  recent_usage: {
    id: string;
    meter_id: string;
    meter_number: string;
    units_sold: number;
    amount_paid: number;
    recorded_at: string;
    source: "seed" | "upload" | "manual";
  }[];
}

function mapCustomerDetail(d: BackendCustomerDetail): WaterCustomerDetail {
  return {
    id: d.customer.id,
    name: d.customer.name,
    phone: d.customer.phone,
    is_active: d.customer.isActive,
    created_at: d.customer.createdAt,
    zone: d.customer.zone,
    meters: d.customer.meters.map((m) => ({
      id: m.id,
      meter_number: m.meterNumber,
      meter_type: m.meterType,
      is_active: m.isActive,
      zone_name: m.zone?.name ?? null,
    })),
    totals: {
      units_sold: d.totals.unitsSold,
      revenue: d.totals.revenue,
      transaction_count: d.totals.transactionCount,
      last_vend_at: d.totals.lastVendAt,
    },
    monthly: d.monthly.map((m) => ({
      month: m.month,
      units_sold: m.unitsSold,
      revenue: m.revenue,
    })),
    recent_usage: d.recentUsage.map((r) => ({
      id: r.id,
      meter_id: r.meterId,
      meter_number: r.meter.meterNumber,
      units_sold: Number(r.unitsSold),
      amount_paid: Number(r.amountPaid),
      recorded_at: r.recordedAt,
      source: r.source,
    })),
  };
}

export function useWaterCustomerDetail(id: string | undefined, months = 6) {
  return useQuery({
    queryKey: ["water", "customers", id, "detail", months],
    queryFn: async () =>
      mapCustomerDetail(
        await apiJson<BackendCustomerDetail>(`/water/customers/${id}${buildQuery({ months })}`),
      ),
    enabled: !!id,
  });
}

/* ---------- Main meter stages ---------- */

export type WaterMainStage = "borehole_to_tank" | "tank_to_network";

export const WATER_MAIN_STAGE_LABELS: Record<WaterMainStage, string> = {
  borehole_to_tank: "Borehole to tanks",
  tank_to_network: "Tanks to the network",
};

/** Falls back to the old name-matched stages for meters saved before mainStage existed. */
export function mainStageFromName(name: string | null | undefined): WaterMainStage | null {
  if (name === "Borehole → Tank") return "borehole_to_tank";
  if (name === "Tank → Distribution") return "tank_to_network";
  return null;
}

/* ---------- Meter series (every main and bulk meter, period by period) ---------- */

export interface WaterMeterSeries {
  meter_id: string;
  meter_number: string;
  label: string;
  meter_type: WaterMeterType;
  main_stage: WaterMainStage | null;
  zone_id: string | null;
  zone_name: string | null;
  points: { period: string; units: number }[];
}

type BackendMeterSeries = {
  periods: string[];
  meters: {
    meterId: string;
    meterNumber: string;
    label: string;
    meterType: WaterMeterType;
    mainStage: WaterMainStage | null;
    zoneId: string | null;
    zoneName: string | null;
    points: { period: string; units: number }[];
  }[];
};

/** Each main and bulk meter's usage per week or month, for reading meters against each other. */
export function useWaterMeterSeries(
  filters: { granularity?: "week" | "month"; periods?: number; meterType?: WaterMeterType } = {},
) {
  return useQuery({
    queryKey: ["water", "meter-series", filters],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const raw = await apiJson<BackendMeterSeries>(`/water/meter-series${buildQuery(filters)}`);
      return {
        periods: raw.periods,
        meters: raw.meters.map((m): WaterMeterSeries => ({
          meter_id: m.meterId,
          meter_number: m.meterNumber,
          label: m.label,
          meter_type: m.meterType,
          main_stage: m.mainStage ?? null,
          zone_id: m.zoneId,
          zone_name: m.zoneName,
          points: m.points,
        })),
      };
    },
  });
}

/* ---------- Released, used, bought — three figures that are never one ---------- */

export type WaterConsumptionBasis = "readings" | "tokens";

export const WATER_ADJUSTMENT_LABELS: Record<string, string> = {
  line_fill: "Line fill",
  flushing: "Flushing",
  burst_repair: "Burst repair",
  other: "Other",
};

/** Released is what a meter passed, used is what dials moved, bought is credit paid for. */
export interface WaterBalance {
  released: number;
  into_network: number;
  used: number;
  bought: number;
  accounted_adjustments: number;
  adjustments_by_kind: Record<string, number>;
  consumption_basis: WaterConsumptionBasis;
  household_meters_read: number;
  provisional: boolean;
  unused_credit: number | null;
  unaccounted: number;
  unaccounted_pct: number | null;
}

type BackendBalance = {
  released: number;
  intoNetwork: number;
  used: number;
  bought: number;
  accountedAdjustments: number;
  adjustmentsByKind?: Record<string, number>;
  consumptionBasis: WaterConsumptionBasis;
  householdMetersRead?: number;
  provisional?: boolean;
  unusedCredit?: number | null;
};

function mapBalance(w: BackendBalance): WaterBalance {
  // Water in the pipe was written down, so it is accounted for, not missing.
  const unaccounted = w.released - w.used - w.accountedAdjustments;
  return {
    released: w.released,
    into_network: w.intoNetwork,
    used: w.used,
    bought: w.bought,
    accounted_adjustments: w.accountedAdjustments,
    adjustments_by_kind: w.adjustmentsByKind ?? {},
    consumption_basis: w.consumptionBasis,
    household_meters_read: w.householdMetersRead ?? 0,
    provisional: w.provisional ?? w.consumptionBasis === "tokens",
    unused_credit: w.unusedCredit ?? null,
    unaccounted,
    unaccounted_pct: w.released > 0 ? (unaccounted / w.released) * 100 : null,
  };
}

/** One month only. Tokens are bought before they are used, so it never settles. */
export function useWaterMonthBalance(filters: { zoneId?: string; month?: string } = {}) {
  return useQuery({
    queryKey: ["water", "dashboard", "balance", filters],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const raw = await apiJson<{ water?: BackendBalance }>(
        `/water/dashboard${buildQuery(filters)}`,
      );
      return raw.water ? mapBalance(raw.water) : null;
    },
  });
}

export interface WaterSettledBalance extends WaterBalance {
  months: number;
  from: string;
  to: string;
  bought_less_used: number;
}

type BackendSettled = BackendBalance & {
  months: number;
  from: string;
  to: string;
  unaccounted: number;
  unaccountedPct: number | null;
  boughtLessUsed: number;
};

/** The long window, where buying ahead of use washes out. Two to twenty-four months. */
export function useWaterSettled(months = 6, enabled = true) {
  return useQuery({
    queryKey: ["water", "settled", months],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const raw = await apiJson<BackendSettled>(`/water/settled${buildQuery({ months })}`);
      return {
        ...mapBalance(raw),
        unaccounted: raw.unaccounted,
        unaccounted_pct: raw.unaccountedPct,
        months: raw.months,
        from: raw.from,
        to: raw.to,
        bought_less_used: raw.boughtLessUsed,
      } satisfies WaterSettledBalance;
    },
  });
}

/* ---------- What each plot was billed, ready to group by zone ---------- */

export interface WaterHouseholdBillingRow {
  meter_id: string;
  meter_number: string;
  plot_no: string | null;
  customer_name: string | null;
  zone_id: string | null;
  zone_name: string | null;
  units: number;
  amount: number;
  is_active: boolean;
}

/** Token purchases joined onto their meters, so every row carries its plot and zone. */
export function useWaterHouseholdBilling(period: { dateFrom: string; dateTo: string }) {
  return useQuery({
    queryKey: ["water", "household-billing", period],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const [rawMeters, rawRecords] = await Promise.all([
        apiJson<BackendMeter[] | PaginatedResponse<BackendMeter>>(
          `/water/meters${buildQuery({ meterType: "household" })}`,
        ),
        apiJson<BackendUsageRecord[] | PaginatedResponse<BackendUsageRecord>>(
          `/water/usage-records${buildQuery(period)}`,
        ),
      ]);
      const records = (Array.isArray(rawRecords) ? rawRecords : rawRecords.data).map(
        mapUsageRecord,
      );
      const totals = new Map<string, { units: number; amount: number }>();
      for (const r of records) {
        const at = totals.get(r.meter_id) ?? { units: 0, amount: 0 };
        totals.set(r.meter_id, {
          units: at.units + r.units_sold,
          amount: at.amount + r.amount_paid,
        });
      }
      const meters = (Array.isArray(rawMeters) ? rawMeters : rawMeters.data).map(mapMeter);
      return meters.map((m): WaterHouseholdBillingRow => {
        const at = totals.get(m.id);
        return {
          meter_id: m.id,
          meter_number: m.meter_number,
          plot_no: m.plot_no,
          customer_name: m.customer_name,
          zone_id: m.zone_id,
          zone_name: m.zone_name,
          units: at?.units ?? 0,
          amount: at?.amount ?? 0,
          is_active: m.is_active,
        };
      });
    },
  });
}
