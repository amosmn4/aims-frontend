import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  useDocuments,
  useDeleteDocument,
  RESOURCE_TYPE_LABELS,
  type DocumentResourceType,
  type DocumentRow,
} from "@/features/documents/use-documents";
import { DocumentList } from "@/features/documents/document-list";
import { DocumentUploadDialog } from "@/features/documents/document-upload-dialog";
import { DocumentVersionHistoryDialog } from "@/features/documents/document-version-history-dialog";
import { DocumentAccessDialog } from "@/features/documents/document-access-picker";
import { LoadError } from "@/components/load-error";

/** Embeddable file list for a record's detail page (project, task, tender, request, report). */
export function AttachmentsPanel({
  resourceType,
  resourceId,
  canManage = false,
}: {
  resourceType: DocumentResourceType;
  resourceId: string;
  canManage?: boolean;
}) {
  const documentsQ = useDocuments({ resourceType, resourceId });
  const deleteDocument = useDeleteDocument();
  const [versionsDoc, setVersionsDoc] = useState<DocumentRow | null>(null);
  const [accessDoc, setAccessDoc] = useState<DocumentRow | null>(null);
  const noun = RESOURCE_TYPE_LABELS[resourceType].toLowerCase();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">Documents</div>
        {canManage && <DocumentUploadDialog resourceType={resourceType} resourceId={resourceId} />}
      </div>

      {documentsQ.isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : documentsQ.isError ? (
        <LoadError what="documents" error={documentsQ.error} onRetry={() => documentsQ.refetch()} />
      ) : (
        <DocumentList
          documents={documentsQ.data ?? []}
          canManage={() => canManage}
          emptyState={
            <div className="rounded-lg border bg-card py-8 text-center text-sm text-muted-foreground">
              No files attached to this {noun} yet.
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
