import { jsPDF } from "jspdf";
import type { StoredDocument } from "./models";
import { api, isDemo } from "./api";
import { mutateApi } from "./workspace";

export async function uploadDocument(doc: StoredDocument, file: File) {
  const form = new FormData();
  form.append("metadata", JSON.stringify(doc));
  form.append("file", file);
  await mutateApi("/documents", { method: "POST", body: form });
}

function openFiles(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("amsol-ops-files", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Browser file storage could not be opened."));
    request.onblocked = () => reject(new Error("Close other Amsol tabs and try again."));
  });
}

async function fileTransaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openFiles();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("files", mode);
    const request = action(transaction.objectStore("files"));
    transaction.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    transaction.onabort = () => {
      db.close();
      reject(new Error("The file could not be saved. Browser storage may be full."));
    };
    transaction.onerror = () => {
      db.close();
      reject(new Error("The file operation failed."));
    };
  });
}

export async function saveFile(key: string, file: Blob) {
  await fileTransaction("readwrite", (store) => store.put(file, key));
}

export async function deleteFile(key: string) {
  await fileTransaction("readwrite", (store) => store.delete(key));
}

export async function documentBlob(doc: StoredDocument): Promise<Blob> {
  if (!isDemo) {
    const blob = await api<Blob>(`/documents/${encodeURIComponent(doc.id)}/content`, {
      headers: { Accept: "application/octet-stream" },
    });
    return new Blob([blob], { type: doc.mime || "application/octet-stream" });
  }
  if (doc.sample) {
    const pdf = new jsPDF();
    pdf.setFontSize(18);
    pdf.text("Amsol Ops | Sample document", 20, 25);
    pdf.setFontSize(11);
    const lines = pdf.splitTextToSize(
      `${doc.name}\n\nThis is a locally generated sample for frontend testing. The original business document is not included.\n\nFolder: ${doc.folder}\nUpdated: ${doc.updated}\nAccess: ${doc.access}\n\nUpload your own file to store and download the original content.`,
      170,
    );
    pdf.text(lines, 20, 42);
    return pdf.output("blob");
  }
  if (!doc.fileKey) throw new Error("This record has no file attached.");
  const value: unknown = await fileTransaction("readonly", (store) => store.get(doc.fileKey!));
  if (!(value instanceof Blob))
    throw new Error(
      "This file is missing from this browser. Upload it again from the original file.",
    );
  return value;
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
