import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import {
  Download,
  Eye,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  History,
  Trash2,
  Users,
} from "lucide-react";
import {
  downloadDocument,
  fileTypeLabel,
  formatFileSize,
  type DocumentRow,
} from "@/features/documents/use-documents";
import { DocumentLocation } from "@/features/documents/document-location";
import { DocumentPreviewDialog } from "@/features/documents/document-preview-dialog";
import { useDepartments, useProfilesLite } from "@/features/clients/use-clients-contracts";
import { formatDate } from "@/lib/format-date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ConfirmCopy = { title: string; description: string; confirmLabel: string };

export function DocumentList({
  documents,
  canManage,
  showResourceType = false,
  onDelete,
  onShowVersions,
  onShowAccess,
  emptyState,
  deleteCopy,
  footer,
}: {
  documents: DocumentRow[];
  canManage: (doc: DocumentRow) => boolean;
  /** Shows where each file is attached, linking to the record. */
  showResourceType?: boolean;
  onDelete: (doc: DocumentRow) => Promise<unknown> | void;
  onShowVersions: (doc: DocumentRow) => void;
  onShowAccess?: (doc: DocumentRow) => void;
  emptyState?: ReactNode;
  deleteCopy?: (doc: DocumentRow) => ConfirmCopy;
  /** Shown under the list, inside the same box — used for paging. */
  footer?: ReactNode;
}) {
  const profilesQ = useProfilesLite();
  const departmentsQ = useDepartments();
  const profileMap = new Map((profilesQ.data ?? []).map((p) => [p.id, p.full_name ?? p.email]));
  const departmentMap = new Map((departmentsQ.data ?? []).map((d) => [d.id, d.name]));
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);

  if (documents.length === 0) {
    return (
      emptyState ?? (
        <div className="rounded-lg border bg-card py-8 text-center text-sm text-muted-foreground">
          No files attached yet.
        </div>
      )
    );
  }

  return (
    <>
      <div className="rounded-lg border bg-card">
        <ul className="divide-y">
          {documents.map((doc) => (
            <DocumentRowItem
              key={doc.id}
              doc={doc}
              uploaderName={doc.created_by ? profileMap.get(doc.created_by) : undefined}
              visibleTo={visibleToText(doc, departmentMap)}
              canManage={canManage(doc)}
              showLocation={showResourceType}
              onOpen={setPreviewDoc}
              onDelete={onDelete}
              onShowVersions={onShowVersions}
              onShowAccess={onShowAccess}
              deleteCopy={deleteCopy}
            />
          ))}
        </ul>
        {footer}
      </div>
      <DocumentPreviewDialog
        doc={previewDoc}
        canManage={!!previewDoc && canManage(previewDoc)}
        onDelete={onDelete}
        deleteCopy={deleteCopy}
        onClose={() => setPreviewDoc(null)}
      />
    </>
  );
}

function visibleToText(doc: DocumentRow, departments: Map<string, string>) {
  const grants = doc.access_grants;
  if (grants.length === 0) return undefined;
  if (grants.some((g) => g.access_type === "everyone")) return "Everyone in the company";
  const names = grants
    .filter((g) => g.access_type === "department")
    .map((g) => departments.get(g.department_id ?? ""))
    .filter((n): n is string => !!n);
  const people = grants.filter((g) => g.access_type === "user");
  if (people.length === 1 && names.length === 0 && people[0].user_id === doc.created_by)
    return "Only the person who added it";
  const parts = [
    names.length > 0 ? `Everyone in ${names.join(", ")}` : null,
    people.length > 0 ? `${people.length} ${people.length === 1 ? "person" : "people"}` : null,
  ].filter(Boolean);
  return parts.join(" and ");
}

function TypeIcon({ label }: { label: string }) {
  const className = "h-5 w-5 text-muted-foreground shrink-0 mt-0.5";
  if (label === "Image") return <FileImage className={className} aria-hidden="true" />;
  if (label === "Excel sheet") return <FileSpreadsheet className={className} aria-hidden="true" />;
  if (label === "PDF" || label === "Word document")
    return <FileText className={className} aria-hidden="true" />;
  return <File className={className} aria-hidden="true" />;
}

function DocumentRowItem({
  doc,
  uploaderName,
  visibleTo,
  canManage,
  showLocation,
  onOpen,
  onDelete,
  onShowVersions,
  onShowAccess,
  deleteCopy,
}: {
  doc: DocumentRow;
  uploaderName?: string;
  visibleTo?: string;
  canManage: boolean;
  showLocation: boolean;
  onOpen: (doc: DocumentRow) => void;
  onDelete: (doc: DocumentRow) => Promise<unknown> | void;
  onShowVersions: (doc: DocumentRow) => void;
  onShowAccess?: (doc: DocumentRow) => void;
  deleteCopy?: (doc: DocumentRow) => ConfirmCopy;
}) {
  const [deleting, setDeleting] = useState(false);
  const version = doc.latest_version;
  const type = fileTypeLabel(version);
  const isContract = doc.resource_type === "contract";

  const handleDownload = () =>
    downloadDocument(doc).catch((err) =>
      toast.error(err instanceof Error ? err.message : "Couldn't open the file"),
    );

  const handleDelete = async () => {
    const copy = deleteCopy?.(doc) ?? {
      title: `Delete "${doc.title}"?`,
      description:
        "The file and all its earlier versions are removed for everyone. This can't be undone.",
      confirmLabel: "Delete file",
    };
    const ok = await confirmDialog({ ...copy, destructive: true });
    if (!ok) return;
    setDeleting(true);
    try {
      await onDelete(doc);
    } finally {
      setDeleting(false);
    }
  };

  const showFileName = !!version && version.file_name !== doc.title;
  const meta = [
    type,
    version ? formatFileSize(version.size_bytes) : null,
    version && version.version_no > 1 ? `Version ${version.version_no}` : null,
    uploaderName ? `Added by ${uploaderName}` : null,
    formatDate(doc.created_at),
  ].filter(Boolean);

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <TypeIcon label={type} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpen(doc)}
              className="min-w-0 truncate text-left text-sm font-medium hover:text-primary hover:underline"
              title={`Open ${doc.title}`}
            >
              {doc.title}
            </button>
            {doc.category && doc.category !== "other" && (
              <Badge variant="secondary" className="text-xs capitalize">
                {doc.category}
              </Badge>
            )}
            {(doc.tags ?? []).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          {showFileName && (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{version.file_name}</div>
          )}
          <div className="mt-0.5 text-xs text-muted-foreground">{meta.join(" · ")}</div>
          {(showLocation || visibleTo) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
              {showLocation && <DocumentLocation doc={doc} />}
              {visibleTo && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" aria-hidden="true" />
                  {visibleTo}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onOpen(doc)}
          title="Open"
          aria-label={`Open ${doc.title}`}
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleDownload}
          title="Download"
          aria-label={`Download ${doc.title}`}
        >
          <Download className="h-4 w-4" />
        </Button>
        {!isContract && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onShowVersions(doc)}
            title="Versions"
            aria-label={`Versions of ${doc.title}`}
          >
            <History className="h-4 w-4" />
          </Button>
        )}
        {canManage && !isContract && onShowAccess && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onShowAccess(doc)}
            title="Who can see this file"
            aria-label={`Change who can see ${doc.title}`}
          >
            <Users className="h-4 w-4" />
          </Button>
        )}
        {canManage && !isContract && (
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDelete}
            disabled={deleting}
            title="Delete"
            aria-label={`Delete ${doc.title}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </li>
  );
}
