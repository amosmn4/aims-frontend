import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import {
  useDocumentVersions,
  downloadDocument,
  fileProblem,
  fileTypeLabel,
  formatFileSize,
  type DocumentRow,
} from "@/features/documents/use-documents";
import { postFileWithProgress } from "@/features/documents/use-document-uploads";
import { DocumentDropZone } from "@/features/documents/document-drop-zone";
import { useProfilesLite } from "@/features/clients/use-clients-contracts";
import { formatDateTime } from "@/lib/format-date";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
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
  const qc = useQueryClient();
  const versionsQ = useDocumentVersions(doc?.id);
  const profilesQ = useProfilesLite();
  const [progress, setProgress] = useState<number | null>(null);
  const names = new Map((profilesQ.data ?? []).map((p) => [p.id, p.full_name ?? p.email]));

  const handleFiles = async (files: File[]) => {
    const file = files[0];
    if (!file || !doc) return;
    const problem = fileProblem(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setProgress(0);
    const form = new FormData();
    form.append("file", file);
    try {
      await postFileWithProgress(`/documents/${doc.id}/versions`, form, setProgress);
      await qc.invalidateQueries({ queryKey: ["documents"] });
      toast.success(`New version of "${doc.title}" added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add the new version");
    } finally {
      setProgress(null);
    }
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
          <div className="space-y-2">
            <DocumentDropZone
              onFiles={(files) => void handleFiles(files)}
              multiple={false}
              disabled={progress !== null}
              label={progress === null ? "Drag the newer file here" : "Sending the newer file…"}
            />
            {progress !== null && <Progress value={progress} className="h-1.5" />}
            <p className="text-xs text-muted-foreground">
              The newer file becomes the one people open. Earlier versions stay here.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Only people who can edit where this file is attached can upload a new version.
          </p>
        )}

        <div className="max-h-72 overflow-y-auto">
          {versionsQ.isLoading ? (
            <div className="space-y-2 py-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
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
                      downloadDocument(doc, v.id, v.file_name).catch((err) =>
                        toast.error(err instanceof Error ? err.message : "Couldn't open the file"),
                      )
                    }
                    aria-label={`Download version ${v.version_no} of ${doc?.title ?? v.file_name}`}
                    title="Download this version"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={progress !== null}>
            {progress !== null ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
