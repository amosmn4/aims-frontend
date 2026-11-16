import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type Query,
  type QueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { apiJson } from "@/production/lib/api-client";
import { removeWaterUpload } from "./water-upload-removal";
import { useAuth } from "@/production/lib/auth";
import type { PaginatedResponse } from "@/production/hooks/use-pagination";
import type { WaterExpenseTotals } from "./water-expense-types";
export function useCanManageWater() {
  const { hasRole, isAdminOrCeo, viewAs } = useAuth();
  return !viewAs && hasRole("water");
}
function exceptDetailOf(entity: string, id: string) {
  return (q: Query) => !(q.queryKey[1] === entity && q.queryKey[2] === id);
}
export type WaterMeterType = "main" | "bulk" | "household";
export const WATER_METER_TYPE_LABELS: Record<WaterMeterType, string> = {
  main: "Main",
  bulk: "Bulk / zone",
  household: "Household",
};
export const MAIN_METER_NAMES = ["Borehole → Tank", "Tank → Distribution"] as const;
export type WaterVendingSystem = "amsol" | "mpaya";
export type WaterInactiveReason = "replaced" | "removed";
export const WATER_INACTIVE_REASON_LABELS: Record<WaterInactiveReason, string> = {
  replaced: "Replaced",
  removed: "Removed",
};
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
  meters: {
    id: string;
    meter_number: string;
  }[];
}
export interface WaterMeterRow {
  id: string;
  meter_number: string;
  meter_type: WaterMeterType;
  main_stage: WaterMainStage | null;
  name: string | null;
  location: string | null;
  customer_id: string | null;
  customer_name: string | null;
  plot_no: string | null;
  installed_at: string | null;
  zone_id: string | null;
  zone_name: string | null;
  is_active: boolean;
  deactivated_at: string | null;
  inactive_reason: WaterInactiveReason | null;
  inactive_note: string | null;
  created_at: string;
  last_vend_at: string | null;
  total_vend_count: number;
  last_reading_at: string | null;
  total_reading_count: number;
  vending_system: WaterVendingSystem;
  replaces_meter_id: string | null;
  replaces_meter: {
    id: string;
    meter_number: string;
    vending_system: WaterVendingSystem;
  } | null;
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
  cumulative_usage: number | null;
  id: string;
  meter_id: string;
  meter_number: string;
  meter_name: string | null;
  zone_name: string | null;
  meter_type: WaterMeterType;
  reading_date: string;
  value: number | null;
  notes: string | null;
  created_at: string;
}
export type MeterStatusCounts = Record<
  WaterMeterType,
  {
    active: number;
    inactive: number;
  }
>;
export interface WaterMeterAverages {
  per_household_meter: number | null;
  per_bulk_meter: number | null;
  household_meters: number;
  bulk_meters: number;
}
export interface WaterTankBalance {
  pumped: number;
  sent_out: number;
  outlet_measured: boolean;
  outlet_name: string;
  held: number | null;
}
export type WaterVerdict =
  "not_measured" | "bought_ahead" | "over_read" | "within_limit" | "possible_loss" | "likely_loss";
export const WATER_VERDICT_LABELS: Record<WaterVerdict, string> = {
  not_measured: "Not measured yet",
  bought_ahead: "None: bought ahead of use",
  over_read: "Check the readings",
  within_limit: "Within the limit",
  possible_loss: "May be unused credit",
  likely_loss: "Likely loss",
};
export const WATER_VERDICT_TONES: Record<WaterVerdict, string> = {
  not_measured: "text-muted-foreground",
  bought_ahead: "text-muted-foreground",
  over_read: "text-destructive",
  within_limit: "text-success",
  possible_loss: "text-warning",
  likely_loss: "text-destructive",
};
export interface WaterReconciliation {
  verdict: WaterVerdict;
  measured: boolean;
  from: string | null;
  to: string | null;
  released: number;
  household_units: number;
  gap: number;
  gap_pct: number | null;
  note: string;
}
type BackendReconciliation = {
  verdict: WaterVerdict;
  measured: boolean;
  from: string | null;
  to: string | null;
  released: number;
  householdUnits: number;
  gap: number;
  gapPct: number | null;
  note: string;
};
function mapReconciliation(r: BackendReconciliation | undefined): WaterReconciliation {
  return {
    verdict: r?.verdict ?? "not_measured",
    measured: r?.measured ?? false,
    from: r?.from ?? null,
    to: r?.to ?? null,
    released: r?.released ?? 0,
    household_units: r?.householdUnits ?? 0,
    gap: r?.gap ?? 0,
    gap_pct: r?.gapPct ?? null,
    note: r?.note ?? "",
  };
}
export interface WaterBulkFigure {
  units: number;
  measured: boolean;
}
export interface WaterBulkSummary {
  estate:
    | (WaterBulkFigure & {
        name: string;
      })
    | null;
  zones: WaterBulkFigure & {
    names: string[];
  };
}
export interface HouseholdReconciliation {
  metersRead: number;
  metersTotal: number;
  counterMetersRead: number;
  complete: boolean;
  estimated: boolean;
  issues: number;
  openingBalance: number | null;
  closingBalance: number | null;
  purchases: number | null;
  creditUsed: number | null;
  measuredUsed: number | null;
  difference: number | null;
}
export interface WaterDashboard {
  household_reconciliation: HouseholdReconciliation | null;
  month: string;
  expenses: WaterExpenseTotals | null;
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
  bulk: WaterBulkSummary;
  tank: WaterTankBalance;
  nrw_tank_to_network_pct: number | null;
  nrw_overall_pct: number | null;
  reconciliation: WaterReconciliation;
}
export interface WaterTrendPoint {
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
  is_estate: boolean;
  has_sub_zones: boolean;
  has_bulk_meter: boolean;
  bulk_measured: boolean;
  bulk_from: string | null;
  bulk_to: string | null;
  own_meters: number;
  whole_meters: number;
  bulk_total: number;
  child_zones_bulk_total: number;
  own_passed: number;
  household_total: number;
  whole_household_total: number;
  consumption_basis: WaterConsumptionBasis;
  loss_units: number;
  loss_pct: number | null;
  whole_loss_units: number;
  whole_loss_pct: number | null;
  verdict: WaterVerdict;
  whole_verdict: WaterVerdict;
}
export interface WaterZoneUsageRow {
  key: string;
  zone_id: string | null;
  zone_name: string;
  parent_zone_id: string | null;
  depth: number;
  includes_sub_zones: boolean;
  active_meters: number;
  inactive_meters: number;
  buying_meters: number;
  units: number;
  revenue: number;
  units_per_meter: number | null;
  revenue_per_meter: number | null;
  units_share_pct: number | null;
  meter_share_pct: number | null;
}
export interface WaterHighUsageRow {
  meter_id: string;
  meter_number: string;
  plot_no: string | null;
  is_active: boolean;
  customer_id: string | null;
  customer_name: string | null;
  zone_name: string | null;
  units: number;
  amount: number;
  purchases: number;
  times_typical: number | null;
}
export interface WaterReportSummary {
  month: string;
  dashboard: WaterDashboard;
  prev_dashboard: WaterDashboard;
  zone_loss: WaterZoneComparisonRow[];
  insights: string[];
  zone_usage: WaterZoneUsageRow[];
  high_usage: WaterHighUsageRow[];
  typical_household_units: number | null;
}
function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}
type BackendZone = {
  id: string;
  name: string;
  parentZoneId: string | null;
  parent: {
    id: string;
    name: string;
  } | null;
  _count: {
    children: number;
    meters: number;
    customers: number;
  };
  activeMeterCount?: number | undefined;
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
  filters: {
    q?: string | undefined;
  } = {},
  pagination: {
    page?: number | undefined;
    pageSize?: number | undefined;
  } = {},
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
      const raw = await apiJson<
        {
          id: string;
          name: string;
          parentZoneId: string | null;
        }[]
      >("/water/zones/all");
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
    mutationFn: (input: { name: string; parentZoneId?: string | undefined }) =>
      apiJson("/water/zones", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water", "zones"] }),
  });
}
export function useUpdateWaterZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      name?: string | undefined;
      parentZoneId?: string | null | undefined;
    }) => apiJson(`/water/zones/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
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
  parent: {
    id: string;
    name: string;
  } | null;
  month: string;
  children: {
    id: string;
    name: string;
  }[];
  bulk_meters: WaterZoneMeter[];
  household_meters: WaterZoneMeter[];
  customer_count: number;
  active_household_meters: number;
  is_estate: boolean;
  has_bulk_meter: boolean;
  bulk_measured: boolean;
  bulk_from: string | null;
  bulk_to: string | null;
  bulk_total: number;
  child_bulk_total: number;
  direct_household_total: number;
  adjustment_total: number;
  consumption_basis: "readings" | "mixed" | "tokens";
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
  customer: {
    id: string;
    name: string;
  } | null;
  isActive: boolean;
};
type BackendZoneDetail = {
  id: string;
  name: string;
  parentZoneId: string | null;
  parent: {
    id: string;
    name: string;
  } | null;
  month: string;
  children: {
    id: string;
    name: string;
  }[];
  bulkMeters: BackendZoneMeter[];
  householdMeters: BackendZoneMeter[];
  customerCount: number;
  activeHouseholdMeters: number;
  isEstate?: boolean | undefined;
  hasBulkMeter: boolean;
  bulkMeasured?: boolean | undefined;
  bulkFrom?: string | null | undefined;
  bulkTo?: string | null | undefined;
  bulkTotal: number;
  childBulkTotal: number;
  directHouseholdTotal: number;
  adjustmentTotal?: number | undefined;
  consumptionBasis?: "readings" | "mixed" | "tokens" | undefined;
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
    is_estate: d.isEstate ?? false,
    has_bulk_meter: d.hasBulkMeter,
    bulk_measured: d.bulkMeasured ?? d.bulkTotal > 0,
    bulk_from: d.bulkFrom ?? null,
    bulk_to: d.bulkTo ?? null,
    bulk_total: d.bulkTotal,
    child_bulk_total: d.childBulkTotal,
    direct_household_total: d.directHouseholdTotal,
    adjustment_total: d.adjustmentTotal ?? 0,
    consumption_basis: d.consumptionBasis ?? "tokens",
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
  customer: {
    id: string;
    name: string;
  } | null;
}
export function useUnassignedWaterMeters(meterType?: WaterMeterType, enabled = true) {
  return useQuery({
    queryKey: ["water", "meters", "unassigned", meterType ?? "all"],
    enabled,
    queryFn: () =>
      apiJson<UnassignedMeter[]>(`/water/meters/unassigned${buildQuery({ meterType })}`),
  });
}
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
export function useMoveWaterMeterZone() {
  const qc = useQueryClient();
  return useMutation({
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
  filters: {
    granularity?: "week" | "month" | undefined;
    periods?: number | undefined;
  } = {},
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
          points: {
            period: string;
            bulkUnits: number;
            householdUnits: number;
            revenue: number;
          }[];
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
type BackendCustomer = {
  id: string;
  name: string;
  zoneId: string | null;
  zone: {
    id: string;
    name: string;
  } | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  meters: {
    id: string;
    meterNumber: string;
  }[];
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
type WaterCustomerFilters = {
  zoneId?: string | undefined;
  q?: string | undefined;
};
export function useWaterCustomers(
  filters?: WaterCustomerFilters,
): UseQueryResult<WaterCustomerRow[]>;
export function useWaterCustomers(
  filters: WaterCustomerFilters,
  pagination: {
    page: number;
    pageSize: number;
  },
): UseQueryResult<WaterCustomerRow[] | PaginatedResponse<WaterCustomerRow>>;
export function useWaterCustomers(
  filters: WaterCustomerFilters = {},
  pagination: {
    page?: number | undefined;
    pageSize?: number | undefined;
  } = {},
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
  id?: string | undefined;
  name: string;
  zoneId?: string | undefined;
  phone?: string | undefined;
  isActive?: boolean | undefined;
}
export function useSaveWaterCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveCustomerInput) => {
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
type BackendMeter = {
  id: string;
  meterNumber: string;
  meterType: WaterMeterType;
  mainStage?: WaterMainStage | null | undefined;
  name: string | null;
  location: string | null;
  customerId: string | null;
  customer: {
    id: string;
    name: string;
  } | null;
  plotNo: string | null;
  installedAt: string | null;
  zoneId: string | null;
  zone: {
    id: string;
    name: string;
  } | null;
  isActive: boolean;
  deactivatedAt?: string | null | undefined;
  inactiveReason?: WaterInactiveReason | null | undefined;
  inactiveNote?: string | null | undefined;
  createdAt: string;
  usageRecords?:
    | {
        recordedAt: string;
      }[]
    | undefined;
  readings?:
    | {
        readingDate: string;
      }[]
    | undefined;
  _count?:
    | {
        usageRecords: number;
        readings?: number | undefined;
      }
    | undefined;
  vendingSystem: WaterVendingSystem;
  replacesMeterId: string | null;
  replacesMeter: {
    id: string;
    meterNumber: string;
    vendingSystem: WaterVendingSystem;
  } | null;
  replacedByMeter: {
    id: string;
    meterNumber: string;
    vendingSystem: WaterVendingSystem;
  } | null;
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
    deactivated_at: m.deactivatedAt ?? null,
    inactive_reason: m.inactiveReason ?? null,
    inactive_note: m.inactiveNote ?? null,
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
  meterType?: WaterMeterType | undefined;
  zoneId?: string | undefined;
  q?: string | undefined;
  vendingSystem?: WaterVendingSystem | undefined;
  status?: WaterMeterStatus | undefined;
};
export function useWaterMeters(filters?: WaterMeterFilters): UseQueryResult<WaterMeterRow[]>;
export function useWaterMeters(
  filters: WaterMeterFilters,
  pagination: {
    page: number;
    pageSize: number;
  },
): UseQueryResult<WaterMeterRow[] | PaginatedResponse<WaterMeterRow>>;
export function useWaterMeters(
  filters: WaterMeterFilters = {},
  pagination: {
    page?: number | undefined;
    pageSize?: number | undefined;
  } = {},
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
  id?: string | undefined;
  meterNumber: string;
  meterType?: WaterMeterType | undefined;
  mainStage?: WaterMainStage | null | undefined;
  name?: string | null | undefined;
  location?: string | null | undefined;
  customerId?: string | undefined;
  customerName?: string | undefined;
  plotNo?: string | null | undefined;
  installedAt?: string | null | undefined;
  zoneId?: string | null | undefined;
  isActive?: boolean | undefined;
  vendingSystem?: WaterVendingSystem | undefined;
  replacesMeterId?: string | null | undefined;
}
export function useSaveWaterMeter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveMeterInput) => {
      const blank = input.id ? null : undefined;
      const body = {
        meterNumber: input.meterNumber,
        meterType: input.meterType,
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
export function useDeleteWaterMeter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/water/meters/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) =>
      qc.invalidateQueries({ queryKey: ["water"], predicate: exceptDetailOf("meters", id) }),
  });
}
type BackendReading = {
  cumulativeUsage?: number | string | null | undefined;
  id: string;
  meterId: string;
  meter: {
    id: string;
    meterNumber: string;
    meterType: WaterMeterType;
    name?: string | null | undefined;
    zoneId: string | null;
    zone?:
      | {
          id: string;
          name: string;
        }
      | null
      | undefined;
  };
  readingDate: string;
  value: number | string | null;
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
    value: r.value == null ? null : Number(r.value),
    cumulative_usage: r.cumulativeUsage == null ? null : Number(r.cumulativeUsage),
    notes: r.notes,
    created_at: r.createdAt,
  };
}
function toUtcInstant(naiveLocalDateTime: string): string {
  return new Date(naiveLocalDateTime).toISOString();
}
export function toLocalDateTimeInputValue(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const localMs = d.getTime() - d.getTimezoneOffset() * 60000;
  return new Date(localMs).toISOString().slice(0, 16);
}
type WaterReadingFilters = {
  meterId?: string | undefined;
  meterType?: WaterMeterType | undefined;
  zoneId?: string | undefined;
  q?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
};
const READING_DEPENDENT_KEYS = [
  "readings",
  "readings-with-delta",
  "reading-series",
  "balance-periods",
  "household-flags",
  "household-reconciliation",
  "zones",
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
  pagination: {
    page: number;
    pageSize: number;
  },
): UseQueryResult<WaterMeterReadingRow[] | PaginatedResponse<WaterMeterReadingRow>>;
export function useWaterReadings(
  filters: WaterReadingFilters = {},
  pagination: {
    page?: number | undefined;
    pageSize?: number | undefined;
  } = {},
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
    mutationFn: (input: {
      meterId: string;
      readingDate: string;
      value: number | null;
      cumulativeUsage?: number | null | undefined;
      notes?: string | undefined;
      reviewToken?: string | undefined;
      reviewReason?: string | undefined;
    }) =>
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
      meterId?: string | undefined;
      readingDate?: string | undefined;
      value?: number | null | undefined;
      cumulativeUsage?: number | null | undefined;
      reviewToken?: string | undefined;
      reviewReason?: string | undefined;
      notes?: string | null | undefined;
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
export type WaterBalanceFlag =
  "balance_too_high" | "counter_decreased" | "usage_mismatch" | "no_use" | "high_use";
export const WATER_BALANCE_FLAG_LABELS: Record<WaterBalanceFlag, string> = {
  balance_too_high: "Balance higher than possible",
  counter_decreased: "Usage counter decreased",
  usage_mismatch: "Usage and credit differ",
  no_use: "No use recorded",
  high_use: "High use",
};
export const WATER_BALANCE_FLAG_HINTS: Record<WaterBalanceFlag, string> = {
  counter_decreased:
    "The lifetime counter is lower than its earlier reading. Check the capture or register a replacement as a separate meter.",
  usage_mismatch:
    "Counter usage differs from opening credit plus purchases minus remaining credit. Check both readings and the purchase records.",
  balance_too_high:
    "The balance rose more than the units bought. Check for a missing purchase upload or a misread, then inspect the meter.",
  no_use:
    "Nothing used for weeks. Check whether the home is empty, the meter is stuck or bypassed.",
  high_use: "More than double this household's usual daily use. Possible leak in the home.",
};
export interface WaterBalancePeriod {
  measured_used: number | null;
  credit_used: number;
  difference: number | null;
  from: string;
  to: string;
  opening_balance: number;
  purchased: number;
  closing_balance: number;
  used: number;
  days: number;
  per_day: number | null;
  baseline_per_day: number | null;
  flags: WaterBalanceFlag[];
}
export interface WaterBalanceReadingRow {
  cumulative_usage: number | null;
  id: string;
  reading_date: string;
  balance: number | null;
  notes: string | null;
  period: WaterBalancePeriod | null;
}
type BackendBalancePeriod = {
  measuredUsed?: number | null | undefined;
  creditUsed?: number | undefined;
  difference?: number | null | undefined;
  from: string;
  to: string;
  openingBalance: number;
  purchased: number;
  closingBalance: number;
  used: number;
  days: number;
  perDay: number | null;
  baselinePerDay: number | null;
  flags: WaterBalanceFlag[];
};
function mapBalancePeriod(p: BackendBalancePeriod): WaterBalancePeriod {
  return {
    measured_used: p.measuredUsed ?? null,
    credit_used: p.creditUsed ?? p.used,
    difference: p.difference ?? null,
    from: p.from,
    to: p.to,
    opening_balance: p.openingBalance,
    purchased: p.purchased,
    closing_balance: p.closingBalance,
    used: p.used,
    days: p.days,
    per_day: p.perDay,
    baseline_per_day: p.baselinePerDay,
    flags: p.flags,
  };
}
export function useWaterBalancePeriods(meterId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["water", "balance-periods", meterId],
    enabled: !!meterId && enabled,
    queryFn: async () => {
      const rows = await apiJson<
        {
          id: string;
          readingDate: string;
          balance: number | null;
          cumulativeUsage?: number | null | undefined;
          notes: string | null;
          period: BackendBalancePeriod | null;
        }[]
      >(`/water/meters/${meterId}/balance-periods`);
      return rows.map((r): WaterBalanceReadingRow => ({
        id: r.id,
        reading_date: r.readingDate,
        balance: r.balance,
        cumulative_usage: r.cumulativeUsage ?? null,
        notes: r.notes,
        period: r.period ? mapBalancePeriod(r.period) : null,
      }));
    },
  });
}
export interface WaterHouseholdFlagRow {
  meter_id: string;
  meter_number: string;
  meter_is_active: boolean;
  customer_name: string | null;
  zone_name: string | null;
  flag: WaterBalanceFlag;
  period: WaterBalancePeriod;
}
export function useWaterHouseholdReconciliation(month: string) {
  return useQuery({
    queryKey: ["water", "household-reconciliation", month],
    queryFn: () =>
      apiJson<{
        month: string;
        units: number;
        basis: WaterConsumptionBasis;
        reconciliation: HouseholdReconciliation;
      }>(`/water/household-reconciliation?month=${encodeURIComponent(month)}`),
  });
}
export function useWaterHouseholdFlags(months = 3) {
  return useQuery({
    queryKey: ["water", "household-flags", months],
    queryFn: async () => {
      const rows = await apiJson<
        {
          meterId: string;
          flag: WaterBalanceFlag;
          period: BackendBalancePeriod;
          meter: {
            meterNumber: string;
            isActive: boolean;
            customer: {
              name: string;
            } | null;
            zone: {
              name: string;
            } | null;
          };
        }[]
      >(`/water/household-flags${buildQuery({ months })}`);
      return rows.map((r): WaterHouseholdFlagRow => ({
        meter_id: r.meterId,
        meter_number: r.meter.meterNumber,
        meter_is_active: r.meter.isActive,
        customer_name: r.meter.customer?.name ?? null,
        zone_name: r.meter.zone?.name ?? null,
        flag: r.flag,
        period: mapBalancePeriod(r.period),
      }));
    },
  });
}
export type TakeOutOfUseInput = {
  meterId: string;
  reason: WaterInactiveReason;
  date: string;
  finalReading?: number | undefined;
  note?: string | undefined;
  newMeterNumber?: string | undefined;
  newMeterReading?: number | undefined;
};
export function useTakeMeterOutOfUse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ meterId, date, ...input }: TakeOutOfUseInput) =>
      apiJson<{
        meter: {
          id: string;
        };
        newMeter: {
          id: string;
        } | null;
      }>(`/water/meters/${meterId}/take-out-of-use`, {
        method: "POST",
        body: JSON.stringify({ ...input, date: toUtcInstant(date) }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water"] }),
  });
}
type BackendUpload = {
  id: string;
  fileName: string;
  recordCount: number;
  uploader: {
    id: string;
    fullName: string | null;
    email: string;
  } | null;
  createdAt: string;
  _count?:
    | {
        records: number;
      }
    | undefined;
  periodStart?: string | null | undefined;
  periodEnd?: string | null | undefined;
};
function mapUpload(u: BackendUpload): WaterUsageUploadRow {
  return {
    id: u.id,
    file_name: u.fileName,
    record_count: u._count?.records ?? u.recordCount,
    uploaded_by_name: u.uploader?.fullName ?? u.uploader?.email ?? null,
    created_at: u.createdAt,
    period_start: u.periodStart ?? null,
    period_end: u.periodEnd ?? null,
  };
}
export function useWaterUploads(
  filters: {
    q?: string | undefined;
    month?: string | undefined;
  } = {},
  pagination: {
    page?: number | undefined;
    pageSize?: number | undefined;
  } = {},
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
export function useDeleteWaterUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeWaterUpload("standard", id),
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
  inactiveMeterNumbers?: string[] | undefined;
}
export function useCreateWaterUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      fileName: string;
      rows: UsageUploadRowInput[];
      vendingSystem?: "amsol" | "mpaya" | undefined;
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
  meter: {
    id: string;
    meterNumber: string;
  };
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
    meterId?: string | undefined;
    customerId?: string | undefined;
    zoneId?: string | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
  } = {},
  pagination: {
    page?: number | undefined;
    pageSize?: number | undefined;
  } = {},
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
type BackendDashboard = {
  householdReconciliation?: HouseholdReconciliation | undefined;
  month: string;
  expenses?: WaterExpenseTotals | null | undefined;
  averages?:
    | {
        perHouseholdMeter: number | null;
        perBulkMeter: number | null;
        householdMeters: number;
        bulkMeters: number;
      }
    | undefined;
  activeHouseholds: number;
  activeMeters: number;
  inactiveMeters?: number | undefined;
  meterStatus?: MeterStatusCounts | undefined;
  unitsSold: number;
  unitsSoldChangePct: number | null;
  revenue: number;
  mainReadingTotal: number;
  bulkReadingTotal: number;
  bulk?: WaterBulkSummary | undefined;
  tank?:
    | {
        pumped: number;
        sentOut: number;
        outletMeasured: boolean;
        outletName?: string | undefined;
        held: number | null;
      }
    | undefined;
  nrwTankToNetworkPct: number | null;
  nrwOverallPct: number | null;
  reconciliation?: BackendReconciliation | undefined;
};
function mapDashboard(raw: BackendDashboard): WaterDashboard {
  return {
    household_reconciliation: raw.householdReconciliation ?? null,
    month: raw.month,
    expenses: raw.expenses ?? null,
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
    bulk: raw.bulk ?? {
      estate: null,
      zones: { names: [], units: raw.bulkReadingTotal, measured: raw.bulkReadingTotal > 0 },
    },
    tank: {
      pumped: raw.tank?.pumped ?? raw.mainReadingTotal,
      sent_out: raw.tank?.sentOut ?? 0,
      outlet_measured: raw.tank?.outletMeasured ?? false,
      outlet_name: raw.tank?.outletName ?? "the tank outlet meter",
      held: raw.tank?.held ?? null,
    },
    nrw_tank_to_network_pct: raw.nrwTankToNetworkPct,
    nrw_overall_pct: raw.nrwOverallPct,
    reconciliation: mapReconciliation(raw.reconciliation),
  };
}
export function useWaterDashboard(
  filters: {
    zoneId?: string | undefined;
    month?: string | undefined;
  } = {},
) {
  return useQuery({
    queryKey: ["water", "dashboard", filters],
    queryFn: async () => {
      const raw = await apiJson<BackendDashboard>(`/water/dashboard${buildQuery(filters)}`);
      return mapDashboard(raw);
    },
  });
}
type BackendTrendPoint = {
  period?: string | undefined;
  granularity?: "week" | "month" | undefined;
  month: string;
  periodStart?: string | undefined;
  periodEnd?: string | undefined;
  mainTotal: number;
  bulkTotal: number;
  householdTotal: number;
};
export function useWaterTrend(
  filters: {
    zoneId?: string | undefined;
    months?: number | undefined;
    granularity?: "week" | "month" | undefined;
    periods?: number | undefined;
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
  isEstate?: boolean | undefined;
  hasSubZones?: boolean | undefined;
  hasBulkMeter?: boolean | undefined;
  bulkMeasured?: boolean | undefined;
  bulkFrom?: string | null | undefined;
  bulkTo?: string | null | undefined;
  ownMeters?: number | undefined;
  wholeMeters?: number | undefined;
  bulkTotal: number;
  childZonesBulkTotal?: number | undefined;
  ownPassed?: number | undefined;
  householdTotal: number;
  wholeHouseholdTotal?: number | undefined;
  consumptionBasis?: WaterConsumptionBasis | undefined;
  lossUnits: number;
  lossPct: number | null;
  wholeLossUnits?: number | undefined;
  wholeLossPct?: number | null | undefined;
  verdict?: WaterVerdict | undefined;
  wholeVerdict?: WaterVerdict | undefined;
};
function mapZoneComparisonRow(r: BackendZoneComparisonRow): WaterZoneComparisonRow {
  return {
    zone_id: r.zoneId,
    zone_name: r.zoneName,
    parent_zone_id: r.parentZoneId,
    is_estate: r.isEstate ?? false,
    has_sub_zones: r.hasSubZones ?? false,
    has_bulk_meter: r.hasBulkMeter ?? r.bulkTotal > 0,
    bulk_measured: r.bulkMeasured ?? r.bulkTotal > 0,
    bulk_from: r.bulkFrom ?? null,
    bulk_to: r.bulkTo ?? null,
    own_meters: r.ownMeters ?? 0,
    whole_meters: r.wholeMeters ?? 0,
    bulk_total: r.bulkTotal,
    child_zones_bulk_total: r.childZonesBulkTotal ?? 0,
    own_passed: r.ownPassed ?? r.bulkTotal,
    household_total: r.householdTotal,
    whole_household_total: r.wholeHouseholdTotal ?? r.householdTotal,
    consumption_basis: r.consumptionBasis ?? "tokens",
    loss_units: r.lossUnits,
    loss_pct: r.lossPct,
    whole_loss_units: r.wholeLossUnits ?? r.lossUnits,
    whole_loss_pct: r.wholeLossPct ?? r.lossPct,
    verdict: r.verdict ?? "not_measured",
    whole_verdict: r.wholeVerdict ?? r.verdict ?? "not_measured",
  };
}
export function useWaterZoneComparison(
  filters: {
    month?: string | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
  } = {},
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
type BackendZoneUsageRow = {
  key: string;
  zoneId: string | null;
  zoneName: string;
  parentZoneId: string | null;
  depth?: number | undefined;
  includesSubZones?: boolean | undefined;
  activeMeters: number;
  inactiveMeters: number;
  buyingMeters: number;
  units: number;
  revenue: number;
  unitsPerMeter: number | null;
  revenuePerMeter: number | null;
  unitsSharePct: number | null;
  meterSharePct: number | null;
};
type BackendHighUsageRow = {
  meterId: string;
  meterNumber: string;
  plotNo: string | null;
  isActive: boolean;
  customerId: string | null;
  customerName: string | null;
  zoneName: string | null;
  units: number;
  amount: number;
  purchases: number;
  timesTypical: number | null;
};
export function useWaterReportSummary(
  filters: {
    month?: string | undefined;
  } = {},
) {
  return useQuery({
    queryKey: ["water", "report-summary", filters],
    queryFn: async () => {
      const raw = await apiJson<{
        month: string;
        dashboard: BackendDashboard;
        prevDashboard: BackendDashboard;
        zoneLoss: BackendZoneComparisonRow[];
        insights: string[];
        zoneUsage?: BackendZoneUsageRow[] | undefined;
        highUsage?: BackendHighUsageRow[] | undefined;
        typicalHouseholdUnits?: number | null | undefined;
      }>(`/water/reports/summary${buildQuery(filters)}`);
      return {
        month: raw.month,
        dashboard: mapDashboard(raw.dashboard),
        prev_dashboard: mapDashboard(raw.prevDashboard),
        zone_loss: raw.zoneLoss.map(mapZoneComparisonRow),
        insights: raw.insights,
        zone_usage: (raw.zoneUsage ?? []).map((z) => ({
          key: z.key,
          zone_id: z.zoneId,
          zone_name: z.zoneName,
          parent_zone_id: z.parentZoneId,
          depth: z.depth ?? 0,
          includes_sub_zones: z.includesSubZones ?? false,
          active_meters: z.activeMeters,
          inactive_meters: z.inactiveMeters,
          buying_meters: z.buyingMeters,
          units: z.units,
          revenue: z.revenue,
          units_per_meter: z.unitsPerMeter,
          revenue_per_meter: z.revenuePerMeter,
          units_share_pct: z.unitsSharePct,
          meter_share_pct: z.meterSharePct,
        })),
        high_usage: (raw.highUsage ?? []).map((h) => ({
          meter_id: h.meterId,
          meter_number: h.meterNumber,
          plot_no: h.plotNo,
          is_active: h.isActive,
          customer_id: h.customerId,
          customer_name: h.customerName,
          zone_name: h.zoneName,
          units: h.units,
          amount: h.amount,
          purchases: h.purchases,
          times_typical: h.timesTypical,
        })),
        typical_household_units: raw.typicalHouseholdUnits ?? null,
      } satisfies WaterReportSummary;
    },
  });
}
export interface WaterReadingSeriesPoint {
  period: string;
  usage: number;
  reading_count: number;
}
export function useWaterReadingSeries(filters: {
  meterType: WaterMeterType;
  zoneId?: string | undefined;
  bucket: "day" | "week" | "month";
  dateFrom: string;
  dateTo: string;
}) {
  return useQuery({
    queryKey: ["water", "reading-series", filters],
    queryFn: async () => {
      const raw = await apiJson<
        {
          period: string;
          usage: number;
          readingCount: number;
        }[]
      >(`/water/readings/series${buildQuery(filters)}`);
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
  value: number | null;
  delta: number | null;
  notes: string | null;
}
type BackendReadingWithDelta = {
  id: string;
  meterId: string;
  readingDate: string;
  value: number | string | null;
  notes: string | null;
  delta: number | null;
  meter: {
    id: string;
    meterNumber: string;
    name: string | null;
    meterType: WaterMeterType;
    zone: {
      id: string;
      name: string;
    } | null;
  };
};
export function useWaterReadingsWithDelta(filters: {
  meterId?: string | undefined;
  meterType?: WaterMeterType | undefined;
  zoneId?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
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
        value: r.value == null ? null : Number(r.value),
        delta: r.delta,
        notes: r.notes,
      }));
    },
  });
}
export type VendingHealth = "active" | "slowing" | "inactive" | "never";
export function vendingHealth(lastVendAt: string | null): VendingHealth {
  if (!lastVendAt) return "never";
  const days = (Date.now() - new Date(lastVendAt).getTime()) / 86400000;
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
    deactivatedAt: string | null;
    inactiveReason: WaterInactiveReason | null;
    inactiveNote: string | null;
    createdAt: string;
    customer: {
      id: string;
      name: string;
      phone: string | null;
      isActive: boolean;
    } | null;
    zone: {
      id: string;
      name: string;
    } | null;
    vendingSystem: WaterVendingSystem;
    replacesMeterId: string | null;
    replacesMeter: {
      id: string;
      meterNumber: string;
      vendingSystem: WaterVendingSystem;
    } | null;
    replacedByMeter: {
      id: string;
      meterNumber: string;
      vendingSystem: WaterVendingSystem;
    } | null;
  };
  totals: {
    unitsSold: number | null;
    revenue: number;
    transactionCount: number;
    lastVendAt: string | null;
  };
  monthly: {
    month: string;
    unitsSold: number;
    revenue: number;
  }[];
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
  deactivated_at: string | null;
  inactive_reason: WaterInactiveReason | null;
  inactive_note: string | null;
  created_at: string;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    is_active: boolean;
  } | null;
  zone: {
    id: string;
    name: string;
  } | null;
  vending_system: WaterVendingSystem;
  replaces_meter_id: string | null;
  replaces_meter: {
    id: string;
    meter_number: string;
    vending_system: WaterVendingSystem;
  } | null;
  replaced_by_meter: {
    id: string;
    meter_number: string;
    vending_system: WaterVendingSystem;
  } | null;
  totals: {
    units_sold: number | null;
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
    deactivated_at: d.meter.deactivatedAt,
    inactive_reason: d.meter.inactiveReason,
    inactive_note: d.meter.inactiveNote,
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
type BackendCustomerDetail = {
  customer: {
    id: string;
    name: string;
    phone: string | null;
    isActive: boolean;
    createdAt: string;
    zone: {
      id: string;
      name: string;
    } | null;
    meters: {
      id: string;
      meterNumber: string;
      meterType: WaterMeterType;
      isActive: boolean;
      zone: {
        id: string;
        name: string;
      } | null;
    }[];
  };
  totals: {
    unitsSold: number;
    revenue: number;
    transactionCount: number;
    lastVendAt: string | null;
  };
  monthly: {
    month: string;
    unitsSold: number;
    revenue: number;
  }[];
  recentUsage: {
    id: string;
    meterId: string;
    meter: {
      id: string;
      meterNumber: string;
    };
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
  zone: {
    id: string;
    name: string;
  } | null;
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
export type WaterMainStage = "borehole_to_tank" | "tank_to_network";
export const WATER_MAIN_STAGE_LABELS: Record<WaterMainStage, string> = {
  borehole_to_tank: "Borehole to tanks",
  tank_to_network: "Tanks to the network",
};
export function mainStageFromName(name: string | null | undefined): WaterMainStage | null {
  if (name === "Borehole → Tank") return "borehole_to_tank";
  if (name === "Tank → Distribution") return "tank_to_network";
  return null;
}
export interface WaterMeterSeries {
  meter_id: string;
  meter_number: string;
  label: string;
  meter_type: WaterMeterType;
  main_stage: WaterMainStage | null;
  zone_id: string | null;
  zone_name: string | null;
  points: {
    period: string;
    units: number;
  }[];
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
    points: {
      period: string;
      units: number;
    }[];
  }[];
};
export function useWaterMeterSeries(
  filters: {
    granularity?: "week" | "month" | undefined;
    periods?: number | undefined;
    meterType?: WaterMeterType | undefined;
  } = {},
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
export type WaterConsumptionBasis = "readings" | "mixed" | "tokens";
export const WATER_ADJUSTMENT_LABELS: Record<string, string> = {
  line_fill: "Line fill",
  flushing: "Flushing",
  burst_repair: "Burst repair",
  other: "Other",
};
export interface WaterBalance {
  household_reconciliation: HouseholdReconciliation | null;
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
  reconciliation: WaterReconciliation;
}
type BackendBalance = {
  householdReconciliation?: HouseholdReconciliation | undefined;
  released: number;
  intoNetwork: number;
  used: number;
  bought: number;
  accountedAdjustments: number;
  adjustmentsByKind?: Record<string, number> | undefined;
  consumptionBasis: WaterConsumptionBasis;
  householdMetersRead?: number | undefined;
  provisional?: boolean | undefined;
  unusedCredit?: number | null | undefined;
  reconciliation?: BackendReconciliation | undefined;
};
function mapBalance(w: BackendBalance): WaterBalance {
  const reconciliation = mapReconciliation(w.reconciliation);
  return {
    household_reconciliation: w.householdReconciliation ?? null,
    released: w.released,
    into_network: w.intoNetwork,
    used: w.used,
    bought: w.bought,
    accounted_adjustments: w.accountedAdjustments,
    adjustments_by_kind: w.adjustmentsByKind ?? {},
    consumption_basis: w.consumptionBasis,
    household_meters_read: w.householdMetersRead ?? 0,
    provisional: w.provisional ?? w.consumptionBasis !== "readings",
    unused_credit: w.unusedCredit ?? null,
    unaccounted: reconciliation.gap,
    unaccounted_pct: reconciliation.gap_pct,
    reconciliation,
  };
}
export function useWaterMonthBalance(
  filters: {
    zoneId?: string | undefined;
    month?: string | undefined;
  } = {},
) {
  return useQuery({
    queryKey: ["water", "dashboard", "balance", filters],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const raw = await apiJson<{
        water?: BackendBalance | undefined;
      }>(`/water/dashboard${buildQuery(filters)}`);
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
      const totals = new Map<
        string,
        {
          units: number;
          amount: number;
        }
      >();
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
