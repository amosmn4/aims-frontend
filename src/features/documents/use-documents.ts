import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiJson } from "@/lib/api-client";

export type DocumentResourceType =
  "project" | "task" | "finance_report" | "tender" | "client_request" | "tender_document_library";
export type LibraryResourceType = DocumentResourceType | "contract";
export type DocumentAccessType = "everyone" | "department" | "user";

export const RESOURCE_TYPE_LABELS: Record<LibraryResourceType, string> = {
  project: "Project",
  task: "Task",
  finance_report: "Finance report",
  tender: "Tender",
  client_request: "Client request",
  contract: "Contract",
  tender_document_library: "Mandatory documents library",
};

export const ACCESS_TYPE_LABELS: Record<DocumentAccessType, string> = {
  everyone: "Everyone",
  department: "Specific departments",
  user: "Specific people",
};

export const DOCUMENT_CATEGORY_SUGGESTIONS = [
  "proposal",
  "report",
  "policy",
  "template",
  "compliance",
  "correspondence",
  "other",
];

export interface DocumentVersionRow {
  id: string;
  document_id: string;
  version_no: number;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number;
  uploaded_by: string | null;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  resource_type: LibraryResourceType;
  resource_id: string;
  title: string;
  description: string | null;
  category: string;
  tags: string[] | null;
  latest_version_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  latest_version: DocumentVersionRow | null;
}

export interface DocumentAccessGrantRow {
  id: string;
  document_id: string;
  access_type: DocumentAccessType;
  department_id: string | null;
  user_id: string | null;
  created_at: string;
}

type BackendVersion = {
  id: string;
  documentId: string;
  versionNo: number;
  fileName: string;
  storagePath: string;
  mimeType: string | null;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
};

type BackendDocument = {
  id: string;
  resourceType: LibraryResourceType;
  resourceId: string;
  title: string;
  description: string | null;
  category: string;
  tags: string[] | null;
  latestVersionId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  latestVersion: BackendVersion | null;
};

type BackendAccessGrant = {
  id: string;
  documentId: string;
  accessType: DocumentAccessType;
  departmentId: string | null;
  userId: string | null;
  createdAt: string;
};

function mapVersion(v: BackendVersion): DocumentVersionRow {
  return {
    id: v.id,
    document_id: v.documentId,
    version_no: v.versionNo,
    file_name: v.fileName,
    storage_path: v.storagePath,
    mime_type: v.mimeType,
    size_bytes: v.sizeBytes,
    uploaded_by: v.uploadedBy,
    created_at: v.createdAt,
  };
}

function mapDocument(d: BackendDocument): DocumentRow {
  return {
    id: d.id,
    resource_type: d.resourceType,
    resource_id: d.resourceId,
    title: d.title,
    description: d.description,
    category: d.category,
    tags: d.tags,
    latest_version_id: d.latestVersionId,
    created_by: d.createdBy,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
    latest_version: d.latestVersion ? mapVersion(d.latestVersion) : null,
  };
}

function mapAccessGrant(g: BackendAccessGrant): DocumentAccessGrantRow {
  return {
    id: g.id,
    document_id: g.documentId,
    access_type: g.accessType,
    department_id: g.departmentId,
    user_id: g.userId,
    created_at: g.createdAt,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface DocumentFilters {
  resourceType?: LibraryResourceType;
  resourceId?: string;
  departmentId?: string;
  tag?: string;
  q?: string;
  mine?: boolean;
  sharedWithMe?: boolean;
}

function buildQuery(filters: DocumentFilters): string {
  const params = new URLSearchParams();
  if (filters.resourceType) params.set("resourceType", filters.resourceType);
  if (filters.resourceId) params.set("resourceId", filters.resourceId);
  if (filters.departmentId) params.set("departmentId", filters.departmentId);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.q) params.set("q", filters.q);
  if (filters.mine) params.set("mine", "true");
  if (filters.sharedWithMe) params.set("sharedWithMe", "true");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/* ---------- Queries ---------- */

export function useDocuments(filters: DocumentFilters = {}) {
  return useQuery({
    queryKey: ["documents", "list", filters],
    queryFn: async () =>
      (await apiJson<BackendDocument[]>(`/documents${buildQuery(filters)}`)).map(mapDocument),
  });
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: ["documents", id],
    enabled: !!id,
    queryFn: async () => mapDocument(await apiJson<BackendDocument>(`/documents/${id}`)),
  });
}

export function useDocumentVersions(id: string | undefined) {
  return useQuery({
    queryKey: ["documents", id, "versions"],
    enabled: !!id,
    queryFn: async () =>
      (await apiJson<BackendVersion[]>(`/documents/${id}/versions`)).map(mapVersion),
  });
}

export function useDocumentAccess(id: string | undefined) {
  return useQuery({
    queryKey: ["documents", id, "access"],
    enabled: !!id,
    queryFn: async () =>
      (await apiJson<BackendAccessGrant[]>(`/documents/${id}/access`)).map(mapAccessGrant),
  });
}

/* ---------- Mutations ---------- */

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      file: File;
      resourceType: DocumentResourceType;
      resourceId: string;
      title?: string;
      description?: string;
      category?: string;
      tags?: string[];
      access?: { accessType: DocumentAccessType; departmentId?: string; userId?: string }[];
    }) => {
      const form = new FormData();
      form.append("file", input.file);
      form.append("resourceType", input.resourceType);
      form.append("resourceId", input.resourceId);
      if (input.title) form.append("title", input.title);
      if (input.description) form.append("description", input.description);
      if (input.category) form.append("category", input.category);
      if (input.tags && input.tags.length > 0) form.append("tags", input.tags.join(","));
      if (input.access) form.append("access", JSON.stringify(input.access));
      const res = await apiFetch("/documents", { method: "POST", body: form });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      return mapDocument(await res.json());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useUploadNewVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ documentId, file }: { documentId: string; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch(`/documents/${documentId}/versions`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      return mapDocument(await res.json());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      title?: string;
      description?: string;
      category?: string;
      tags?: string[];
    }) => {
      const { id, ...body } = input;
      return mapDocument(
        await apiJson<BackendDocument>(`/documents/${id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        }),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiJson(`/documents/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useSetDocumentAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      documentId,
      grants,
    }: {
      documentId: string;
      grants: { accessType: DocumentAccessType; departmentId?: string; userId?: string }[];
    }) => {
      return (
        await apiJson<BackendAccessGrant[]>(`/documents/${documentId}/access`, {
          method: "PUT",
          body: JSON.stringify({ grants }),
        })
      ).map(mapAccessGrant);
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["documents", vars.documentId, "access"] }),
  });
}

/**
 * Fetches the file as a blob (auth header required) and opens it via a local object URL.
 * Contract documents still live in the legacy /contracts endpoint (see DocumentsService),
 * so they're routed there instead of /documents/:id/download.
 */
export async function downloadDocument(doc: DocumentRow, versionId?: string): Promise<void> {
  const path =
    doc.resource_type === "contract"
      ? `/contracts/documents/${doc.id}/download`
      : `/documents/${doc.id}/download${versionId ? `?versionId=${versionId}` : ""}`;
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`Could not open file (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
