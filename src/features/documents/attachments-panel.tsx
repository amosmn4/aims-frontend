import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useDocuments,
  useDeleteDocument,
  DOCUMENT_ACCEPT_HINT,
  RESOURCE_TYPE_LABELS,
  type DocumentResourceType,
  type DocumentRow,
} from "@/features/documents/use-documents";
import { useDocumentUploads } from "@/features/documents/use-document-uploads";
import { DocumentList } from "@/features/documents/document-list";
import { DocumentDropZone, UploadProgressList } from "@/features/documents/document-drop-zone";
import { DocumentUploadDialog } from "@/features/documents/document-upload-dialog";
import { DocumentVersionHistoryDialog } from "@/features/documents/document-version-history-dialog";
import { DocumentAccessDialog } from "@/features/documents/document-access-picker";
import { LoadError } from "@/components/load-error";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

/** Embeddable file list for a record's detail page (project, task, tender, request, report). */
export function AttachmentsPanel({
  resourceType,
  resourceId,
  canManage = false,
  title = "Documents",
}: {
  resourceType: DocumentResourceType;
  resourceId: string;
  canManage?: boolean;
  /** Heading above the list. */
  title?: string;
}) {
  const documentsQ = useDocuments({ resourceType, resourceId });
  const deleteDocument = useDeleteDocument();
  const uploads = useDocumentUploads();
  const [versionsDoc, setVersionsDoc] = useState<DocumentRow | null>(null);
  const [accessDoc, setAccessDoc] = useState<DocumentRow | null>(null);
  const noun = RESOURCE_TYPE_LABELS[resourceType].toLowerCase();
  const documents = documentsQ.data ?? [];

  // Clears the finished list on its own, so the panel doesn't collect old rows.
  const { items, uploading, clear } = uploads;
  useEffect(() => {
    if (items.length === 0 || uploading || items.some((i) => i.status === "failed")) return;
    const timer = setTimeout(clear, 4000);
    return () => clearTimeout(timer);
  }, [items, uploading, clear]);

  const handleFiles = (files: File[]) => {
    void uploads.upload(files, { resourceType, resourceId });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          {documents.length > 0 && <Badge variant="secondary">{documents.length}</Badge>}
        </div>
        {canManage && <DocumentUploadDialog resourceType={resourceType} resourceId={resourceId} />}
      </div>

      {canManage && (
        <DocumentDropZone
          onFiles={handleFiles}
          disabled={uploads.uploading}
          label={
            uploads.uploading ? "Sending files…" : `Drag files here to add them to this ${noun}`
          }
        />
      )}
      <UploadProgressList items={uploads.items} />

      {documentsQ.isLoading ? (
        <div className="space-y-2 rounded-lg border bg-card p-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : documentsQ.isError ? (
        <LoadError what="documents" error={documentsQ.error} onRetry={() => documentsQ.refetch()} />
      ) : (
        <DocumentList
          documents={documents}
          canManage={() => canManage}
          emptyState={
            <div className="rounded-lg border bg-card px-6 py-8 text-center">
              <p className="text-sm font-medium">No files on this {noun} yet</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                {canManage
                  ? `Keep anything people need for this ${noun} here — drag a file onto the box above, or use "Attach file". ${DOCUMENT_ACCEPT_HINT}.`
                  : `Files added to this ${noun} appear here. Ask whoever runs it to add one.`}
              </p>
            </div>
          }
          onDelete={(doc) =>
            deleteDocument
              .mutateAsync(doc.id)
              .then(() => toast.success(`Deleted "${doc.title}"`))
              .catch((err) =>
                toast.error(err instanceof Error ? err.message : "Couldn't delete the file"),
              )
          }
          onShowVersions={setVersionsDoc}
          onShowAccess={setAccessDoc}
        />
      )}

      <DocumentVersionHistoryDialog
        doc={versionsDoc}
        canManage={canManage}
        onClose={() => setVersionsDoc(null)}
      />
      <DocumentAccessDialog doc={accessDoc} onClose={() => setAccessDoc(null)} />
    </div>
  );
}
