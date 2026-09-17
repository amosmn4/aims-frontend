import { useRef } from "react";
import { toast } from "sonner";
import { Download, Loader2, Upload } from "lucide-react";
import {
  useDocumentVersions,
  useUploadNewVersion,
  downloadDocument,
  fileTypeLabel,
  formatFileSize,
  DOCUMENT_ACCEPT,
  MAX_DOCUMENT_BYTES,
  type DocumentRow,
} from "@/features/documents/use-documents";
import { useProfilesLite } from "@/features/clients/use-clients-contracts";
import { formatDateTime } from "@/lib/format-date";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DocumentVersionHistoryDialog({
  doc,
  canManage,
  onClose,
}: {
  doc: DocumentRow | null;
  canManage: boolean;
  onClose: () => void;
}) {
  const versionsQ = useDocumentVersions(doc?.id);
  const profilesQ = useProfilesLite();
  const uploadVersion = useUploadNewVersion();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const names = new Map((profilesQ.data ?? []).map((p) => [p.id, p.full_name ?? p.email]));

  const handleFile = (file: File | undefined) => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file || !doc) return;
    if (file.size > MAX_DOCUMENT_BYTES) {
      toast.error("This file is bigger than 25 MB. Choose a smaller file.");
      return;
    }
    uploadVersion.mutate(
      { documentId: doc.id, file },
      {
        onSuccess: () => toast.success(`New version of "${doc.title}" added`),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Couldn't add the new version"),
      },
    );
  };

  const versions = versionsQ.data ?? [];

  return (
    <Dialog open={!!doc} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Versions</DialogTitle>
          <DialogDescription className="truncate">{doc?.title}</DialogDescription>
        </DialogHeader>

        {canManage ? (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept={DOCUMENT_ACCEPT}
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadVersion.isPending}
            >
              {uploadVersion.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              Upload new version
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Only people who can edit where this file is attached can upload a new version.
          </p>
        )}

        <div className="max-h-72 overflow-y-auto">
          {versionsQ.isLoading ? (
            <div className="py-4 flex justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          ) : versionsQ.isError ? (
            <LoadError
              what="versions"
              error={versionsQ.error}
              onRetry={() => versionsQ.refetch()}
            />
          ) : versions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No versions yet.</p>
          ) : (
            <ul className="divide-y">
              {versions.map((v, i) => (
                <li key={v.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      Version {v.version_no}
                      {i === 0 && " (latest)"} — {v.file_name}
                    </div>
                    <div className="text-muted-foreground">
                      {fileTypeLabel(v)} · {formatFileSize(v.size_bytes)} ·{" "}
                      {v.uploaded_by && names.get(v.uploaded_by)
                        ? `${names.get(v.uploaded_by)}, `
                        : ""}
                      {formatDateTime(v.created_at)}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      doc &&
                      downloadDocument(doc, v.id).catch((err) =>
                        toast.error(err instanceof Error ? err.message : "Couldn't open the file"),
                      )
                    }
                    aria-label={`Download version ${v.version_no} of ${doc?.title ?? v.file_name}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
