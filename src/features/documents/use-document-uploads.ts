import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAccessToken, refreshAccessToken } from "@/lib/api-client";
import {
  fileProblem,
  type DocumentAccessType,
  type DocumentResourceType,
} from "@/features/documents/use-documents";

// Mirrors the API client's base URL; XHR is used because fetch can't report upload progress.
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

export type UploadStatus = "waiting" | "uploading" | "done" | "failed";

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  status: UploadStatus;
  /** 0–100. */
  progress: number;
  error?: string;
}

export interface UploadMeta {
  resourceType: DocumentResourceType;
  resourceId: string;
  /** Used only when a single file is being uploaded. */
  title?: string;
  category?: string;
  tags?: string[];
  access?: { accessType: DocumentAccessType; departmentId?: string; userId?: string }[];
}

function serverMessage(xhr: XMLHttpRequest): string {
  try {
    const body = JSON.parse(xhr.responseText) as { message?: string | string[] };
    if (body.message) return Array.isArray(body.message) ? body.message.join(", ") : body.message;
  } catch {
    /* falls through to the plain message below */
  }
  if (xhr.status === 403) return "You're not allowed to add files here.";
  if (xhr.status === 413) return "The server refused the file for being too large.";
  return "Couldn't upload the file. Try again.";
}

/** POSTs a file with the signed-in user's token, reporting how far it has got. */
export function postFileWithProgress(
  path: string,
  form: FormData,
  onProgress: (percent: number) => void,
  retried = false,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}${path}`);
    xhr.withCredentials = true;
    const token = getAccessToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      // The access token can expire mid-upload; renew it once and send again.
      if (xhr.status === 401 && !retried) {
        void refreshAccessToken().then((ok) =>
          ok
            ? postFileWithProgress(path, form, onProgress, true).then(resolve, reject)
            : reject(new Error("Your session expired. Sign in again.")),
        );
        return;
      }
      reject(new Error(serverMessage(xhr)));
    };
    xhr.onerror = () => reject(new Error("Couldn't reach the server. Check your connection."));
    xhr.send(form);
  });
}

function newId(index: number): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${index}`;
}

/** Uploads files one at a time, with a progress bar and a result for each one. */
export function useDocumentUploads() {
  const qc = useQueryClient();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const patch = useCallback((id: string, changes: Partial<UploadItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const upload = useCallback(
    async (files: File[], meta: UploadMeta, options: { silent?: boolean } = {}) => {
      if (files.length === 0) return { uploaded: 0, failed: 0 };
      const queued = files.map((file, index) => ({
        file,
        item: {
          id: newId(index),
          name: file.name,
          size: file.size,
          status: "waiting" as UploadStatus,
          progress: 0,
        },
      }));
      setItems(queued.map((q) => q.item));
      setUploading(true);

      let uploaded = 0;
      const failures: string[] = [];
      for (const { file, item } of queued) {
        const problem = fileProblem(file);
        if (problem) {
          patch(item.id, { status: "failed", error: problem });
          failures.push(problem);
          continue;
        }
        patch(item.id, { status: "uploading", progress: 0 });
        const form = new FormData();
        form.append("file", file);
        form.append("resourceType", meta.resourceType);
        form.append("resourceId", meta.resourceId);
        if (meta.title && queued.length === 1) form.append("title", meta.title);
        if (meta.category) form.append("category", meta.category);
        if (meta.tags && meta.tags.length > 0) form.append("tags", meta.tags.join(","));
        if (meta.access && meta.access.length > 0)
          form.append("access", JSON.stringify(meta.access));
        try {
          await postFileWithProgress("/documents", form, (percent) =>
            patch(item.id, { progress: percent }),
          );
          patch(item.id, { status: "done", progress: 100 });
          uploaded += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Couldn't upload the file.";
          patch(item.id, { status: "failed", error: `"${file.name}": ${message}` });
          failures.push(`"${file.name}": ${message}`);
        }
      }

      setUploading(false);
      if (uploaded > 0) await qc.invalidateQueries({ queryKey: ["documents"] });
      if (!options.silent) {
        if (uploaded === 1 && failures.length === 0) {
          toast.success(`Attached "${queued[0].file.name}"`);
        } else if (uploaded > 1) {
          toast.success(`Attached ${uploaded} files`);
        }
        if (failures.length === 1) toast.error(failures[0]);
        else if (failures.length > 1) toast.error(`${failures.length} files couldn't be added`);
      }

      return { uploaded, failed: failures.length };
    },
    [patch, qc],
  );

  return { items, uploading, upload, clear };
}
