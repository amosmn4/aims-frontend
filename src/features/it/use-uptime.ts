import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export interface UptimeRecord {
  id: string;
  systemId: string;
  month: string;
  uptimePercent: number;
  notes: string | null;
  createdAt: string;
}

type BackendUptimeRecord = Omit<UptimeRecord, "uptimePercent"> & {
  uptimePercent: string | number;
};

const uptimeKey = (systemId: string) => ["it-system-uptime", systemId] as const;

const fetchUptime = async (systemId: string): Promise<UptimeRecord[]> =>
  (await apiJson<BackendUptimeRecord[]>(`/it-systems/${systemId}/uptime`)).map((r) => ({
    ...r,
    uptimePercent: Number(r.uptimePercent),
  }));

/** Monthly uptime for one system, newest first. */
export function useSystemUptime(systemId: string | undefined) {
  return useQuery({
    queryKey: uptimeKey(systemId ?? ""),
    enabled: !!systemId,
    queryFn: () => fetchUptime(systemId!),
  });
}

export interface LatestUptime {
  record: UptimeRecord | null;
  isLoading: boolean;
  isError: boolean;
}

/** Latest recorded month per system id; null when nothing is recorded. */
export function useLatestUptimes(systemIds: string[]) {
  return useQueries({
    queries: systemIds.map((id) => ({
      queryKey: uptimeKey(id),
      queryFn: () => fetchUptime(id),
    })),
    combine: (results) =>
      Object.fromEntries(
        systemIds.map((id, i) => [
          id,
          {
            record: results[i]?.data?.[0] ?? null,
            isLoading: !!results[i]?.isLoading,
            isError: !!results[i]?.isError,
          },
        ]),
      ) as Record<string, LatestUptime>,
  });
}

export function useRecordUptime(systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { month: string; uptimePercent: number; notes?: string }) =>
      apiJson(`/it-systems/${systemId}/uptime`, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: uptimeKey(systemId) });
      void qc.invalidateQueries({ queryKey: ["it-system", systemId] });
    },
  });
}

export function useDeleteUptime(systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recordId: string) =>
      apiJson(`/it-systems/uptime/${recordId}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: uptimeKey(systemId) });
      void qc.invalidateQueries({ queryKey: ["it-system", systemId] });
    },
  });
}

/** "Aug 2026" from a first-of-month ISO date. */
export function formatUptimeMonth(month: string): string {
  return new Date(month).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "99.7%" — trims trailing zeros. */
export function formatUptimePercent(value: number): string {
  return `${Number(value.toFixed(2))}%`;
}

/** Previous calendar month as "YYYY-MM". */
export function lastMonthValue(today = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
