import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiJson } from "@/lib/api-client";

export type ImportKind =
  "reading" | "purchase" | "usage" | "meter" | "customer" | "unresolved" | "ignored";
export type ImportData = { kind: ImportKind; [field: string]: string | number | null };
export interface ImportAssessment {
  suggestions?: {
    label: string;
    explanation: string;
    confidence: string;
    patch: Record<string, string | number | null>;
    recordId?: string;
  }[];
  status: "ready" | "warning" | "blocked" | "duplicate" | "ignored";
  issues: string[];
  warnings: { code: string; severity: "warning" | "danger"; message: string }[];
  reviewToken: string;
  meterLabel?: string;
}
export interface ImportRow {
  id: string;
  position: number;
  source: string;
  raw: Record<string, unknown>;
  data: ImportData;
  status: string;
  updatedAt: string;
  issues?: unknown[];
  warnings?: { code: string; severity: "warning" | "danger"; message: string }[];
  targetType?: string;
  targetId?: string;
  assessment?: ImportAssessment;
}
export interface ImportBatch {
  previewVersion: number;
  id: string;
  fileName: string;
  status: "queued" | "processing" | "recording" | "review" | "completed" | "failed";
  totalRows: number;
  processedParts: number;
  totalParts: number;
  createdAt: string;
  error?: string;
  summary?: Record<string, unknown>;
}
export interface ImportDetail extends ImportBatch {
  previewToken: string | null;
  rows: ImportRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<string, number>;
}

export function useWaterImports() {
  return useQuery({
    queryKey: ["water", "imports"],
    queryFn: () => apiJson<ImportBatch[]>("/water/imports"),
    refetchInterval: (query) =>
      query.state.data?.some((batch) =>
        ["queued", "processing", "recording"].includes(batch.status),
      )
        ? 5000
        : false,
  });
}

export function useWaterImport(id: string | null, page: number, status: string) {
  return useQuery({
    queryKey: ["water", "import", id, page, status],
    enabled: !!id,
    queryFn: () =>
      apiJson<ImportDetail>(
        `/water/imports/${id}?page=${page}${status ? `&status=${status}` : ""}`,
      ),
    refetchInterval: (query) =>
      query.state.data && ["queued", "processing", "recording"].includes(query.state.data.status)
        ? 4000
        : false,
  });
}

export function useUploadWaterImport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append("file", file);
      return apiJson<ImportBatch>("/water/imports", { method: "POST", body });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["water", "imports"] }),
  });
}

export function useUpdateWaterImportRow(batchId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ImportData }) =>
      apiJson(`/water/imports/${batchId}/rows/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ data }),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["water", "import", batchId] }),
  });
}

export function useConfirmWaterImport(batchId: string | null, previewToken?: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (rows: { id: string; reviewToken: string; reviewReason?: string }[]) =>
      apiJson<{ processed: number; pending: number; counts: Record<string, number> }>(
        `/water/imports/${batchId}/confirm`,
        { method: "POST", body: JSON.stringify({ rows, previewToken }) },
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: ["water"] }),
  });
}

export async function downloadImportSource(id: string, fileName: string) {
  const response = await apiFetch(`/water/imports/${id}/source`);
  if (!response.ok) throw new Error("Could not download the source file.");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
