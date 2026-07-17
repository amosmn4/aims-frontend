import { useRef } from "react";
import { toast } from "sonner";
import { Download, Loader2, Upload } from "lucide-react";
import {
  useDocumentVersions,
  useUploadNewVersion,
  downloadDocument,
  formatFileSize,
  type DocumentRow,
} from "@/features/documents/use-documents";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const uploadVersion = useUploadNewVersion();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file || !doc) return;
    uploadVersion.mutate(
      { documentId: doc.id, file },
      {
        onSuccess: () => toast.success("New version uploaded"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Upload failed"),
      },
    );
  };

  return (
    <Dialog open={!!doc} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{doc?.title} — version history</DialogTitle>
        </DialogHeader>

        {canManage && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
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
        )}

        <ScrollArea className="max-h-72">
          <div className="space-y-1 pr-3">
            {versionsQ.isLoading ? (
              <div className="py-4 flex justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            ) : (versionsQ.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No versions yet.</p>
            ) : (
              (versionsQ.data ?? []).map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-2 text-xs py-2 border-b last:border-0"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      v{v.version_no} — {v.file_name}
                    </div>
                    <div className="text-muted-foreground">
                      {formatFileSize(v.size_bytes)} · {new Date(v.created_at).toLocaleString()}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      doc &&
                      downloadDocument(doc, v.id).catch((err) =>
                        toast.error(err instanceof Error ? err.message : "Download failed"),
                      )
                    }
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
