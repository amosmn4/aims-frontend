import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  useDocuments,
  useDeleteDocument,
  type DocumentResourceType,
  type DocumentRow,
} from "@/features/documents/use-documents";
import { DocumentList } from "@/features/documents/document-list";
import { DocumentUploadDialog } from "@/features/documents/document-upload-dialog";
import { DocumentVersionHistoryDialog } from "@/features/documents/document-version-history-dialog";
import { DocumentAccessDialog } from "@/features/documents/document-access-picker";

/** Embeddable attachment list for a Project, Task, or Finance Report detail page. */
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Documents</div>
        {canManage && <DocumentUploadDialog resourceType={resourceType} resourceId={resourceId} />}
      </div>

      {documentsQ.isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <DocumentList
          documents={documentsQ.data ?? []}
          canManage={() => canManage}
          onDelete={(doc) =>
            deleteDocument.mutate(doc.id, {
              onSuccess: () => toast.success("Document deleted"),
              onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
            })
          }
          onShowVersions={setVersionsDoc}
          onShowAccess={setAccessDoc}
        />
      )}

      <DocumentVersionHistoryDialog doc={versionsDoc} canManage={canManage} onClose={() => setVersionsDoc(null)} />
      <DocumentAccessDialog doc={accessDoc} onClose={() => setAccessDoc(null)} />
    </div>
  );
}
