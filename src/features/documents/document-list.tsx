import { useState } from "react";
import { toast } from "sonner";
import { Download, File, History, Share2, Trash2 } from "lucide-react";
import {
  downloadDocument,
  formatFileSize,
  RESOURCE_TYPE_LABELS,
  type DocumentRow,
} from "@/features/documents/use-documents";
import { useProfilesLite } from "@/features/clients/use-clients-contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function DocumentList({
  documents,
  canManage,
  showResourceType = false,
  onDelete,
  onShowVersions,
  onShowAccess,
}: {
  documents: DocumentRow[];
  canManage: (doc: DocumentRow) => boolean;
  showResourceType?: boolean;
  onDelete: (doc: DocumentRow) => void;
  onShowVersions: (doc: DocumentRow) => void;
  onShowAccess: (doc: DocumentRow) => void;
}) {
  const profilesQ = useProfilesLite();
  const profileMap = new Map((profilesQ.data ?? []).map((p) => [p.id, p.full_name ?? p.email]));

  if (documents.length === 0) {
    return (
      <div className="rounded-lg border bg-card py-8 text-center text-sm text-muted-foreground">
        No documents yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card divide-y">
      {documents.map((doc) => (
        <DocumentRowItem
          key={doc.id}
          doc={doc}
          uploaderName={doc.created_by ? profileMap.get(doc.created_by) : undefined}
          canManage={canManage(doc)}
          showResourceType={showResourceType}
          onDelete={onDelete}
          onShowVersions={onShowVersions}
          onShowAccess={onShowAccess}
        />
      ))}
    </div>
  );
}

function DocumentRowItem({
  doc,
  uploaderName,
  canManage,
  showResourceType,
  onDelete,
  onShowVersions,
  onShowAccess,
}: {
  doc: DocumentRow;
  uploaderName?: string;
  canManage: boolean;
  showResourceType: boolean;
  onDelete: (doc: DocumentRow) => void;
  onShowVersions: (doc: DocumentRow) => void;
  onShowAccess: (doc: DocumentRow) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const version = doc.latest_version;

  const handleDownload = () =>
    downloadDocument(doc).catch((err) =>
      toast.error(err instanceof Error ? err.message : "Download failed"),
    );

  const handleDelete = () => {
    if (!confirm(`Delete "${doc.title}"? This removes all versions.`)) return;
    setDeleting(true);
    onDelete(doc);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <File className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1 cursor-pointer" onClick={handleDownload}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">{doc.title}</span>
          <Badge variant="secondary" className="text-[0.6875rem]">
            {doc.category}
          </Badge>
          {showResourceType && (
            <Badge variant="outline" className="text-[0.6875rem]">
              {RESOURCE_TYPE_LABELS[doc.resource_type]}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {version && `${formatFileSize(version.size_bytes)} · v${version.version_no}`}
          {uploaderName && ` · ${uploaderName}`}
          {` · ${new Date(doc.created_at).toLocaleDateString()}`}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button size="icon" variant="ghost" onClick={handleDownload} title="Download">
          <Download className="h-4 w-4" />
        </Button>
        {doc.resource_type !== "contract" && (
          <Button size="icon" variant="ghost" onClick={() => onShowVersions(doc)} title="Version history">
            <History className="h-4 w-4" />
          </Button>
        )}
        {canManage && doc.resource_type !== "contract" && (
          <>
            <Button size="icon" variant="ghost" onClick={() => onShowAccess(doc)} title="Sharing">
              <Share2 className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleDelete}
              disabled={deleting}
              title="Delete"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
