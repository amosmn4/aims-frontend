import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiJson } from "@/lib/api-client";

export type DocumentResourceType =
  | "project"
  | "task"
  | "finance_report"
  | "department_report"
  | "tender"
  | "client_request"
  | "tender_document_library"
  | "department"
  | "it_system";
export type LibraryResourceType = DocumentResourceType | "contract";
export type DocumentAccessType = "everyone" | "department" | "user";

export const RESOURCE_TYPE_LABELS: Record<LibraryResourceType, string> = {
  project: "Project",
  task: "Task",
  finance_report: "Finance report",
  department_report: "Department report",
  tender: "Tender",
  client_request: "Client request",
  contract: "Contract",
  tender_document_library: "Mandatory documents library",
  department: "Department library",
  it_system: "System or site",
};

export const ACCESS_TYPE_LABELS: Record<DocumentAccessType, string> = {
  everyone: "Everyone",
  department: "Departments",
  user: "Specific people",
};

/** Where a file is attached, grouped the way people look for it. */
export type DocumentPlace =
  "library" | "projects" | "client_requests" | "tenders" | "reports" | "contracts" | "systems";

export const DOCUMENT_PLACES: { value: DocumentPlace; label: string }[] = [
  { value: "library", label: "Library" },
  { value: "projects", label: "Projects" },
  { value: "client_requests", label: "Client requests" },
  { value: "tenders", label: "Tenders" },
  { value: "reports", label: "Reports" },
  { value: "contracts", label: "Contracts" },
  { value: "systems", label: "Systems and sites" },
];

export function documentPlace(type: LibraryResourceType): DocumentPlace {
  switch (type) {
    case "department":
    case "tender_document_library":
      return "library";
    case "project":
    case "task":
      return "projects";
    case "client_request":
      return "client_requests";
    case "tender":
      return "tenders";
    case "finance_report":
    case "department_report":
      return "reports";
    case "contract":
      return "contracts";
    case "it_system":
      return "systems";
  }
}

/** File types the server accepts, for the file picker. */
export const DOCUMENT_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.png,.jpg,.jpeg,.txt,.zip";
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

/** One line people can read before choosing a file. */
export const DOCUMENT_ACCEPT_HINT =
  "PDF, Word, Excel, PowerPoint, images, text or zip — up to 25 MB each";

const ACCEPTED_EXTENSIONS = DOCUMENT_ACCEPT.split(",").map((e) => e.trim().toLowerCase());

function extensionOf(fileName: string): string {
  return fileName.includes(".") ? `.${(fileName.split(".").pop() ?? "").toLowerCase()}` : "";
}

/** A plain message naming the file, or null when it can be uploaded. */
export function fileProblem(file: File): string | null {
  if (!ACCEPTED_EXTENSIONS.includes(extensionOf(file.name))) {
    return `"${file.name}" isn't a file type we accept. ${DOCUMENT_ACCEPT_HINT}.`;
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return `"${file.name}" is ${formatFileSize(file.size)} — bigger than the 25 MB limit.`;
  }
  if (file.size === 0) return `"${file.name}" is empty, so there is nothing to upload.`;
  return null;
}

/** "PDF", "Word document", "Excel sheet", "Image", else the extension. */
export function fileTypeLabel(
  version: Pick<DocumentVersionRow, "file_name" | "mime_type"> | null,
): string {
  if (!version) return "File";
  const name = version.file_name ?? "";
  const ext = name.includes(".") ? (name.split(".").pop() ?? "").toLowerCase() : "";
  const mime = version.mime_type ?? "";
  if (mime === "application/pdf" || ext === "pdf") return "PDF";
  if (
    mime.includes("wordprocessingml") ||
    mime === "application/msword" ||
    ext === "doc" ||
    ext === "docx"
  )
    return "Word document";
  if (
    mime.includes("spreadsheetml") ||
    mime === "application/vnd.ms-excel" ||
    ext === "xls" ||
    ext === "xlsx"
  )
    return "Excel sheet";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(ext))
    return "Image";
  return ext ? ext.toUpperCase() : "File";
}

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
  /** Empty means the same people who can see where it's attached. */
  access_grants: DocumentAccessGrantRow[];
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
  accessGrants?: BackendAccessGrant[];
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
    access_grants: (d.accessGrants ?? []).map(mapAccessGrant),
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
    // Keeps the list on screen while a new search loads.
    placeholderData: keepPreviousData,
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
      return mapDocument(
        await apiJson<BackendDocument>("/documents", { method: "POST", body: form }),
      );
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
      return mapDocument(
        await apiJson<BackendDocument>(`/documents/${documentId}/versions`, {
          method: "POST",
          body: form,
        }),
      );
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

/* ---------- Opening files ---------- */

/** What the browser can show in the app; anything else is offered as a download. */
export type DocumentPreviewKind = "pdf" | "image" | "text" | "unsupported";

export function previewKind(
  version: Pick<DocumentVersionRow, "file_name" | "mime_type"> | null,
): DocumentPreviewKind {
  if (!version) return "unsupported";
  const mime = (version.mime_type ?? "").toLowerCase();
  const ext = extensionOf(version.file_name ?? "").replace(".", "");
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext))
    return "image";
  if (mime.startsWith("text/") || ["txt", "csv", "md", "log"].includes(ext)) return "text";
  return "unsupported";
}

// Contract files still live behind the older /contracts endpoint.
function filePath(doc: DocumentRow, mode: "preview" | "download", versionId?: string): string {
  if (doc.resource_type === "contract") return `/contracts/documents/${doc.id}/download`;
  return `/documents/${doc.id}/${mode}${versionId ? `?versionId=${versionId}` : ""}`;
}

/** Fetches the file itself, with the signed-in user's token attached. */
export async function fetchDocumentFile(
  doc: DocumentRow,
  mode: "preview" | "download" = "preview",
  versionId?: string,
): Promise<Blob> {
  const res = await apiFetch(filePath(doc, mode, versionId));
  if (!res.ok) {
    throw new Error(
      res.status === 403
        ? "You don't have access to this file. Ask whoever added it."
        : res.status === 404
          ? "This file no longer exists."
          : "Couldn't open the file. Try again.",
    );
  }
  return res.blob();
}

/** Saves the file to the person's computer, keeping its real file name. */
export async function downloadDocument(
  doc: DocumentRow,
  versionId?: string,
  fileName?: string,
): Promise<void> {
  const blob = await fetchDocumentFile(doc, "download", versionId);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName ?? doc.latest_version?.file_name ?? doc.title;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
