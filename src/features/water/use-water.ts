import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import type { PaginatedResponse } from "@/hooks/use-pagination";

export type WaterMeterType = "main" | "bulk" | "household";

export const WATER_METER_TYPE_LABELS: Record<WaterMeterType, string> = {
  main: "Main",
  bulk: "Bulk / zone",
  household: "Household",
};

export interface WaterZoneRow {
  id: string;
  name: string;
  parent_zone_id: string | null;
  parent_zone_name: string | null;
  child_count: number;
  meter_count: number;
  customer_count: number;
  created_at: string;
}

// Flat, unpaginated — every zone's id/name/parent, used to build the "Zone" then "Sub-zone"
// cascading pickers on the Meter/Customer forms (top-level = parent_zone_id null, sub-zone =
// any zone whose parent is the one picked) and the parent-zone picker on the Zones page itself.
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
}

export interface WaterMeterReadingRow {
  id: string;
  meter_id: string;
  meter_number: string;
  meter_type: WaterMeterType;
  reading_date: string;
  value: number;
  notes: string | null;
  created_at: string;
}

export interface WaterDashboard {
  month: string;
  active_households: number;
  units_sold: number;
  units_sold_change_pct: number | null;
  revenue: number;
  main_reading_total: number;
  bulk_reading_total: number;
  nrw_main_to_bulk_pct: number | null;
  nrw_bulk_to_household_pct: number | null;
  nrw_main_to_household_pct: number | null;
}

export interface WaterTrendPoint {
  month: string;
  main_total: number;
  bulk_total: number;
  household_total: number;
}

export interface WaterZoneComparisonRow {
  zone_id: string;
  zone_name: string;
  bulk_total: number;
  household_total: number;
}

export interface WaterReportSummary {
  month: string;
  dashboard: WaterDashboard;
  zone_loss: { zone_id: string; zone_name: string; loss_pct: number | null }[];
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
    customer_count: z._count.customers,
    created_at: z.createdAt,
  };
}

export function useWaterZones(pagination: { page?: number; pageSize?: number } = {}) {
  return useQuery({
    queryKey: ["water", "zones", pagination],
    queryFn: async () => {
      const raw = await apiJson<BackendZone[] | PaginatedResponse<BackendZone>>(
        `/water/zones${buildQuery(pagination)}`,
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
    mutationFn: ({ id, ...input }: { id: string; name?: string; parentZoneId?: string }) =>
      apiJson(`/water/zones/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water", "zones"] }),
  });
}

export function useDeleteWaterZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/water/zones/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water", "zones"] }),
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

// Overloaded so a bare call (dropdown pickers, the "apply to meter" list) gets a plain
// `WaterCustomerRow[]` at the type level, matching what the backend actually returns then; only
// a call with concrete `{page, pageSize}` sees the paginated-envelope union it has to narrow.
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
      const body = {
        name: input.name,
        zoneId: input.zoneId || undefined,
        phone: input.phone || undefined,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water", "customers"] }),
  });
}

export function useDeleteWaterCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/water/customers/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water", "customers"] }),
  });
}

/* ---------- Meters — the primary registration entry point ---------- */

type BackendMeter = {
  id: string;
  meterNumber: string;
  meterType: WaterMeterType;
  customerId: string | null;
  customer: { id: string; name: string } | null;
  plotNo: string | null;
  installedAt: string | null;
  zoneId: string | null;
  zone: { id: string; name: string } | null;
  isActive: boolean;
  createdAt: string;
  usageRecords?: { recordedAt: string }[];
  _count?: { usageRecords: number };
};

function mapMeter(m: BackendMeter): WaterMeterRow {
  return {
    id: m.id,
    meter_number: m.meterNumber,
    meter_type: m.meterType,
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
  };
}

type WaterMeterFilters = { meterType?: WaterMeterType; zoneId?: string; q?: string };

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
    queryFn: async () => {
      const qs = buildQuery({ ...filters, ...pagination });
      const raw = await apiJson<BackendMeter[] | PaginatedResponse<BackendMeter>>(
        `/water/meters${qs}`,
      );
      return Array.isArray(raw) ? raw.map(mapMeter) : { ...raw, data: raw.data.map(mapMeter) };
    },
  });
}

export interface SaveMeterInput {
  id?: string;
  meterNumber: string;
  meterType?: WaterMeterType;
  customerId?: string;
  customerName?: string;
  plotNo?: string;
  installedAt?: string;
  zoneId?: string;
  isActive?: boolean;
}

export function useSaveWaterMeter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveMeterInput) => {
      const body = {
        meterNumber: input.meterNumber,
        meterType: input.meterType,
        customerId: input.customerId || undefined,
        customerName: input.customerName || undefined,
        plotNo: input.plotNo || undefined,
        installedAt: input.installedAt || undefined,
        zoneId: input.zoneId || undefined,
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
    },
  });
}

export function useDeleteWaterMeter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/water/meters/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water", "meters"] }),
  });
}

/* ---------- Meter readings ---------- */

type BackendReading = {
  id: string;
  meterId: string;
  meter: { id: string; meterNumber: string; meterType: WaterMeterType; zoneId: string | null };
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
    meter_type: r.meter.meterType,
    reading_date: r.readingDate,
    value: Number(r.value),
    notes: r.notes,
    created_at: r.createdAt,
  };
}

type WaterReadingFilters = { meterId?: string; from?: string; to?: string };

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
      apiJson("/water/readings", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["water", "readings"] });
      qc.invalidateQueries({ queryKey: ["water", "dashboard"] });
      qc.invalidateQueries({ queryKey: ["water", "trend"] });
      qc.invalidateQueries({ queryKey: ["water", "zone-comparison"] });
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
      notes?: string;
    }) => apiJson(`/water/readings/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["water", "readings"] });
      qc.invalidateQueries({ queryKey: ["water", "dashboard"] });
      qc.invalidateQueries({ queryKey: ["water", "trend"] });
      qc.invalidateQueries({ queryKey: ["water", "zone-comparison"] });
    },
  });
}

export function useDeleteWaterReading() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/water/readings/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["water", "readings"] });
      qc.invalidateQueries({ queryKey: ["water", "dashboard"] });
      qc.invalidateQueries({ queryKey: ["water", "trend"] });
      qc.invalidateQueries({ queryKey: ["water", "zone-comparison"] });
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
};

function mapUpload(u: BackendUpload): WaterUsageUploadRow {
  return {
    id: u.id,
    file_name: u.fileName,
    record_count: u.recordCount,
    uploaded_by_name: u.uploader?.fullName ?? u.uploader?.email ?? null,
    created_at: u.createdAt,
  };
}

export function useWaterUploads(pagination: { page?: number; pageSize?: number } = {}) {
  return useQuery({
    queryKey: ["water", "uploads", pagination],
    queryFn: async () => {
      const raw = await apiJson<BackendUpload[] | PaginatedResponse<BackendUpload>>(
        `/water/usage-uploads${buildQuery(pagination)}`,
      );
      return Array.isArray(raw) ? raw.map(mapUpload) : { ...raw, data: raw.data.map(mapUpload) };
    },
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
}

export function useCreateWaterUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { fileName: string; rows: UsageUploadRowInput[] }) =>
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

export function useWaterDashboard(filters: { zoneId?: string; month?: string } = {}) {
  return useQuery({
    queryKey: ["water", "dashboard", filters],
    queryFn: async () => {
      const raw = await apiJson<{
        month: string;
        activeHouseholds: number;
        unitsSold: number;
        unitsSoldChangePct: number | null;
        revenue: number;
        mainReadingTotal: number;
        bulkReadingTotal: number;
        nrwMainToBulkPct: number | null;
        nrwBulkToHouseholdPct: number | null;
        nrwMainToHouseholdPct: number | null;
      }>(`/water/dashboard${buildQuery(filters)}`);
      return {
        month: raw.month,
        active_households: raw.activeHouseholds,
        units_sold: raw.unitsSold,
        units_sold_change_pct: raw.unitsSoldChangePct,
        revenue: raw.revenue,
        main_reading_total: raw.mainReadingTotal,
        bulk_reading_total: raw.bulkReadingTotal,
        nrw_main_to_bulk_pct: raw.nrwMainToBulkPct,
        nrw_bulk_to_household_pct: raw.nrwBulkToHouseholdPct,
        nrw_main_to_household_pct: raw.nrwMainToHouseholdPct,
      } satisfies WaterDashboard;
    },
  });
}

export function useWaterTrend(filters: { zoneId?: string; months?: number } = {}) {
  return useQuery({
    queryKey: ["water", "trend", filters],
    queryFn: async () => {
      const raw = await apiJson<
        { month: string; mainTotal: number; bulkTotal: number; householdTotal: number }[]
      >(`/water/trend${buildQuery(filters)}`);
      return raw.map((r): WaterTrendPoint => ({
        month: r.month,
        main_total: r.mainTotal,
        bulk_total: r.bulkTotal,
        household_total: r.householdTotal,
      }));
    },
  });
}

export function useWaterZoneComparison(filters: { month?: string } = {}) {
  return useQuery({
    queryKey: ["water", "zone-comparison", filters],
    queryFn: async () => {
      const raw = await apiJson<
        { zoneId: string; zoneName: string; bulkTotal: number; householdTotal: number }[]
      >(`/water/zone-comparison${buildQuery(filters)}`);
      return raw.map((r): WaterZoneComparisonRow => ({
        zone_id: r.zoneId,
        zone_name: r.zoneName,
        bulk_total: r.bulkTotal,
        household_total: r.householdTotal,
      }));
    },
  });
}

export function useWaterReportSummary(filters: { month?: string } = {}) {
  return useQuery({
    queryKey: ["water", "report-summary", filters],
    queryFn: async () => {
      const raw = await apiJson<{
        month: string;
        dashboard: {
          month: string;
          activeHouseholds: number;
          unitsSold: number;
          unitsSoldChangePct: number | null;
          revenue: number;
          mainReadingTotal: number;
          bulkReadingTotal: number;
          nrwMainToBulkPct: number | null;
          nrwBulkToHouseholdPct: number | null;
          nrwMainToHouseholdPct: number | null;
        };
        zoneLoss: { zoneId: string; zoneName: string; lossPct: number | null }[];
        insights: string[];
      }>(`/water/reports/summary${buildQuery(filters)}`);
      return {
        month: raw.month,
        dashboard: {
          month: raw.dashboard.month,
          active_households: raw.dashboard.activeHouseholds,
          units_sold: raw.dashboard.unitsSold,
          units_sold_change_pct: raw.dashboard.unitsSoldChangePct,
          revenue: raw.dashboard.revenue,
          main_reading_total: raw.dashboard.mainReadingTotal,
          bulk_reading_total: raw.dashboard.bulkReadingTotal,
          nrw_main_to_bulk_pct: raw.dashboard.nrwMainToBulkPct,
          nrw_bulk_to_household_pct: raw.dashboard.nrwBulkToHouseholdPct,
          nrw_main_to_household_pct: raw.dashboard.nrwMainToHouseholdPct,
        },
        zone_loss: raw.zoneLoss.map((z) => ({
          zone_id: z.zoneId,
          zone_name: z.zoneName,
          loss_pct: z.lossPct,
        })),
        insights: raw.insights,
      } satisfies WaterReportSummary;
    },
  });
}

/* ---------- Vending health (row tinting) ---------- */

export type VendingHealth = "active" | "slowing" | "inactive" | "never";

// Recency-based read on how a meter is vending: recent purchases = healthy, a long silence is
// the strongest signal something needs attention (broken meter, inactive customer, a data gap).
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

// Light theme-color row tints — deliberately subtle, same convention as Inventory's condition
// row colors, so the table stays scannable rather than looking like a stoplight.
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
    plotNo: string | null;
    installedAt: string | null;
    isActive: boolean;
    createdAt: string;
    customer: { id: string; name: string; phone: string | null; isActive: boolean } | null;
    zone: { id: string; name: string } | null;
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
  recentReadings: {
    id: string;
    readingDate: string;
    value: number | string;
    notes: string | null;
    createdAt: string;
  }[];
};

export interface WaterMeterDetail {
  id: string;
  meter_number: string;
  meter_type: WaterMeterType;
  plot_no: string | null;
  installed_at: string | null;
  is_active: boolean;
  created_at: string;
  customer: { id: string; name: string; phone: string | null; is_active: boolean } | null;
  zone: { id: string; name: string } | null;
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
  recent_readings: {
    id: string;
    reading_date: string;
    value: number;
    notes: string | null;
    created_at: string;
  }[];
}

function mapMeterDetail(d: BackendMeterDetail): WaterMeterDetail {
  return {
    id: d.meter.id,
    meter_number: d.meter.meterNumber,
    meter_type: d.meter.meterType,
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
    recent_readings: d.recentReadings.map((r) => ({
      id: r.id,
      reading_date: r.readingDate,
      value: Number(r.value),
      notes: r.notes,
      created_at: r.createdAt,
    })),
  };
}

export function useWaterMeterDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["water", "meters", id, "detail"],
    queryFn: async () => mapMeterDetail(await apiJson<BackendMeterDetail>(`/water/meters/${id}`)),
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

export function useWaterCustomerDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["water", "customers", id, "detail"],
    queryFn: async () =>
      mapCustomerDetail(await apiJson<BackendCustomerDetail>(`/water/customers/${id}`)),
    enabled: !!id,
  });
}
