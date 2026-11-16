import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileText, Lock, Download } from "@/components/icons";
import { AccessBadge, Card, PageHeader, fmtDate } from "@/components/kit";
import { EmptyState, RecordActions, RecordDialog, SearchField } from "@/components/RecordDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { canOpenDoc, useRole } from "@/lib/role";
import { saveRecord, removeRecord, useWorkspace } from "@/lib/workspace";
import { documentSchema, type StoredDocument } from "@/lib/models";
import {
  deleteFile,
  documentBlob,
  downloadBlob,
  saveFile,
  uploadDocument,
} from "@/lib/file-storage";
import { isDemo } from "@/lib/api";
import { today } from "@/lib/access";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/documents")({
  head: () => ({ meta: meta("Documents", "Upload, open and manage document permissions.") }),
  component: Documents,
});
function Documents() {
  const { mode, me } = useRole();
  const { documents, projects, person } = useWorkspace();
  const [edit, setEdit] = useState<StoredDocument | "new" | null>(null);
  const [preview, setPreview] = useState<StoredDocument | null>(null);
  const previewRecord = documents.find((doc) => doc.id === preview?.id);
  const [search, setSearch] = useState("");
  const hash = useLocation({ select: (location) => location.hash });
  const list = documents.filter(
    (doc) =>
      !search ||
      (canOpenDoc(doc, mode, me.id, me.dept, projects) &&
        `${doc.name} ${doc.folder}`.toLowerCase().includes(search.toLowerCase())),
  );
  useEffect(() => {
    if (hash.startsWith("document-"))
      document.getElementById(hash)?.scrollIntoView({ block: "center" });
  }, [hash]);
  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Secure files with project, department and owner access controls"
        action={<Button onClick={() => setEdit("new")}>Upload document</Button>}
      />
      <SearchField value={search} onChange={setSearch} placeholder="Search documents" />
      {!list.length ? (
        <EmptyState>No documents found.</EmptyState>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase text-muted-foreground">
              <tr>
                {["Name", "Folder", "Access", "Owner", "Updated", "Actions"].map((label) => (
                  <th key={label} className="px-5 py-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((doc) => {
                const allowed = canOpenDoc(doc, mode, me.id, me.dept, projects);
                return (
                  <tr id={`document-${doc.id}`} key={doc.id}>
                    <td className="min-w-60 px-5 py-3">
                      {allowed ? (
                        <button
                          onClick={() => setPreview(doc)}
                          className="flex items-center gap-2 text-left text-primary hover:underline"
                        >
                          <FileText className="h-4 w-4 shrink-0" />
                          {doc.name}
                        </button>
                      ) : (
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Lock className="h-4 w-4" />
                          Restricted document
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">{allowed ? doc.folder : "Restricted"}</td>
                    <td className="px-5 py-3">
                      <AccessBadge access={doc.access} />
                    </td>
                    <td className="px-5 py-3">{person(doc.owner).name}</td>
                    <td className="whitespace-nowrap px-5 py-3">{fmtDate(doc.updated)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        {allowed && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Download ${doc.name}`}
                            onClick={async () => {
                              try {
                                downloadBlob(await documentBlob(doc), doc.name);
                              } catch (error) {
                                toast.error(
                                  error instanceof Error ? error.message : "Download failed.",
                                );
                              }
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        {(mode === "ceo" || doc.owner === me.id) && !doc.weeklyRef && (
                          <RecordActions
                            collection="documents"
                            id={doc.id}
                            label={doc.name}
                            onEdit={() => setEdit(doc)}
                            onDelete={async () => {
                              await removeRecord("documents", doc.id);
                              if (isDemo && doc.fileKey)
                                await deleteFile(doc.fileKey).catch(() =>
                                  toast.error(
                                    "The record was removed, but its stored file could not be cleared.",
                                  ),
                                );
                            }}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      {edit && (
        <DocumentForm record={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />
      )}
      {previewRecord && canOpenDoc(previewRecord, mode, me.id, me.dept, projects) && (
        <DocumentPreview doc={previewRecord} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}

function DocumentForm({
  record,
  onClose,
}: {
  record?: StoredDocument | undefined;
  onClose: () => void;
}) {
  const { me } = useRole();
  const { projects, departments, people, settings } = useWorkspace();
  const [file, setFile] = useState<File | null>(null);
  return (
    <RecordDialog
      title={record ? "Edit document and permissions" : "Upload document"}
      onClose={onClose}
      initial={{
        name: record?.name ?? "",
        folder: record?.folder ?? "Company",
        access: record?.access ?? settings.defaultDocumentAccess,
        project: record?.project ?? "",
        dept: record?.dept ?? me.dept ?? "hr",
        allowed: record?.allowed ?? [me.id],
      }}
      fields={(values) => [
        {
          name: "name",
          label: "Document name",
          required: !!record,
          help: record
            ? "Keep the file extension when renaming."
            : "Leave blank to use the uploaded filename.",
        },
        { name: "folder", label: "Folder", required: true },
        {
          name: "access",
          label: "Access",
          type: "select",
          options: [
            { value: "public", label: "All staff" },
            { value: "department", label: "Department" },
            { value: "project", label: "Project members" },
            { value: "restricted", label: "Selected staff" },
          ],
        },
        ...(values.access === "project"
          ? [
              {
                name: "project" as const,
                label: "Project",
                type: "select" as const,
                required: true,
                options: [
                  { value: "", label: "Select project" },
                  ...projects.map((project) => ({ value: project.id, label: project.name })),
                ],
              },
            ]
          : []),
        ...(values.access === "department"
          ? [
              {
                name: "dept" as const,
                label: "Department",
                type: "select" as const,
                options: departments.map((department) => ({
                  value: department.id,
                  label: department.name,
                })),
              },
            ]
          : []),
        ...(values.access === "restricted"
          ? [
              {
                name: "allowed" as const,
                label: "Allowed staff",
                type: "multi" as const,
                required: true,
                options: people.map((person) => ({ value: person.id, label: person.name })),
              },
            ]
          : []),
      ]}
      description={
        record
          ? "The owner and CEO can change document details and access."
          : "Choose a file up to 25 MB. Access is controlled by the permissions below."
      }
      extra={
        !record && (
          <label className="field-label">
            File *
            <input
              type="file"
              required
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="field-input"
            />
          </label>
        )
      }
      onSave={async (values) => {
        if (!record && !file) throw new Error("Choose a file to upload.");
        if (file && file.size > 25 * 1024 * 1024)
          throw new Error("Choose a file no larger than 25 MB.");
        const key = file ? crypto.randomUUID() : record?.fileKey;
        const doc = documentSchema.parse({
          ...record,
          ...values,
          id: record?.id ?? crypto.randomUUID(),
          name: values.name.trim() || file?.name,
          project: values.access === "project" ? values.project : undefined,
          dept: values.access === "department" ? values.dept : undefined,
          allowed: values.access === "restricted" ? values.allowed : undefined,
          fileKey: key,
          mime: file?.type || record?.mime || "application/octet-stream",
          owner: record?.owner ?? me.id,
          updated: today(),
        });
        if (!isDemo && file) {
          await uploadDocument(doc, file);
          return;
        }
        if (file && key) await saveFile(key, file);
        try {
          await saveRecord("documents", doc);
        } catch (error) {
          if (file && key) await deleteFile(key).catch(() => {});
          throw error;
        }
      }}
    />
  );
}

function DocumentPreview({ doc, onClose }: { doc: StoredDocument; onClose: () => void }) {
  const [preview, setPreview] = useState<{ url: string; type: string; text: string } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    let url = "";
    void documentBlob(doc)
      .then(async (blob) => {
        const text =
          blob.type.startsWith("text/") && blob.size < 1024 * 1024 ? await blob.text() : "";
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPreview({ url, type: blob.type, text });
      })
      .catch((error: unknown) => {
        if (!cancelled) setError(error instanceof Error ? error.message : "Preview failed.");
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{doc.name}</DialogTitle>
          <DialogDescription>
            {doc.sample
              ? "Generated sample document for local testing."
              : "Original file stored in this browser."}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {!preview && !error && <p>Opening document...</p>}
        {preview && (
          <>
            {preview.type === "application/pdf" ? (
              <iframe
                title={doc.name}
                src={preview.url}
                className="h-[60vh] w-full rounded border"
              />
            ) : /^image\/(png|jpeg|gif|webp|avif|bmp)$/.test(preview.type) ? (
              <img
                src={preview.url}
                alt={doc.name}
                className="max-h-[60vh] w-full object-contain"
              />
            ) : preview.text ? (
              <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded border p-4 text-sm">
                {preview.text}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">
                Download this file to view it in its original application.
              </p>
            )}
            <a href={preview.url} download={doc.name} className="action-button w-fit">
              Download file
            </a>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
