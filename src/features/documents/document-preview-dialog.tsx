import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, FileQuestion, History, Loader2, Trash2 } from "lucide-react";
import {
  downloadDocument,
  fetchDocumentFile,
  fileTypeLabel,
  formatFileSize,
  previewKind,
  useDocumentVersions,
  type DocumentRow,
  type DocumentVersionRow,
} from "@/features/documents/use-documents";
import { useProfilesLite } from "@/features/clients/use-clients-contracts";
import { formatDateTime } from "@/lib/format-date";
import { confirmDialog } from "@/components/confirm-dialog";
import { LoadError } from "@/components/load-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Opens a file inside the app, with its earlier versions, download and delete. */
export function DocumentPreviewDialog({
  doc,
  canManage = false,
  onClose,
  onDelete,
  deleteCopy,
}: {
  doc: DocumentRow | null;
  canManage?: boolean;
  onClose: () => void;
  onDelete?: (doc: DocumentRow) => Promise<unknown> | void;
  /** Wording for the delete confirmation, when the default doesn't fit. */
  deleteCopy?: (doc: DocumentRow) => {
    title: string;
    description: string;
    confirmLabel: string;
  };
}) {
  const [versionId, setVersionId] = useState<string | undefined>();
  const [showVersions, setShowVersions] = useState(false);
  const [busy, setBusy] = useState(false);
  const versionsQ = useDocumentVersions(
    doc && doc.resource_type !== "contract" ? doc.id : undefined,
  );
  const profilesQ = useProfilesLite();
  const names = new Map((profilesQ.data ?? []).map((p) => [p.id, p.full_name ?? p.email]));
  const versionData = versionsQ.data;
  const versions = useMemo(() => versionData ?? [], [versionData]);

  useEffect(() => {
    setVersionId(undefined);
    setShowVersions(false);
  }, [doc?.id]);

  const version = useMemo<DocumentVersionRow | null>(() => {
    if (!doc) return null;
    return versions.find((v) => v.id === versionId) ?? doc.latest_version;
  }, [doc, versionId, versions]);

  if (!doc) return null;

  const isOlder = !!versionId && versionId !== doc.latest_version?.id;
  const uploader = version?.uploaded_by ? names.get(version.uploaded_by) : undefined;
  const meta = [
    fileTypeLabel(version),
    version ? formatFileSize(version.size_bytes) : null,
    version && version.version_no > 1 ? `Version ${version.version_no}` : null,
    uploader ? `Added by ${uploader}` : null,
    version ? formatDateTime(version.created_at) : null,
  ].filter(Boolean);

  const download = () => {
    setBusy(true);
    downloadDocument(doc, isOlder ? versionId : undefined, version?.file_name)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Couldn't open the file"))
      .finally(() => setBusy(false));
  };

  const remove = async () => {
    if (!onDelete) return;
    const copy = deleteCopy?.(doc) ?? {
      title: `Delete "${doc.title}"?`,
      description:
        "The file and all its earlier versions are removed for everyone. This can't be undone.",
      confirmLabel: "Delete file",
    };
    const ok = await confirmDialog({ ...copy, destructive: true });
    if (!ok) return;
    setBusy(true);
    try {
      await onDelete(doc);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="truncate">{doc.title}</DialogTitle>
          <DialogDescription>{meta.join(" · ")}</DialogDescription>
          {isOlder && (
            <Badge variant="secondary" className="w-fit">
              You're looking at an older version
            </Badge>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <PreviewPane
            key={`${doc.id}:${version?.id ?? "none"}`}
            doc={doc}
            version={version}
            versionId={isOlder ? versionId : undefined}
            onDownload={download}
          />
        </div>

        {versions.length > 1 && (
          <div className="shrink-0 border-t pt-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowVersions((s) => !s)}
            >
              <History className="mr-1 h-4 w-4" />
              {showVersions ? "Hide earlier versions" : `Earlier versions (${versions.length - 1})`}
            </Button>
            {showVersions && (
              <ul className="mt-1 max-h-40 divide-y overflow-y-auto">
                {versions.map((v, i) => {
                  const selected = v.id === version?.id;
                  return (
                    <li key={v.id} className="flex items-center justify-between gap-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => setVersionId(v.id)}
                        className={cn(
                          "min-w-0 flex-1 text-left text-xs hover:text-primary",
                          selected && "text-primary",
                        )}
                      >
                        <span className="font-medium">
                          Version {v.version_no}
                          {i === 0 && " (latest)"}
                        </span>{" "}
                        — {v.file_name}
                        <span className="block text-muted-foreground">
                          {formatFileSize(v.size_bytes)} ·{" "}
                          {v.uploaded_by && names.get(v.uploaded_by)
                            ? `${names.get(v.uploaded_by)}, `
                            : ""}
                          {formatDateTime(v.created_at)}
                        </span>
                      </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Download version ${v.version_no}`}
                        title="Download this version"
                        onClick={() =>
                          downloadDocument(doc, v.id, v.file_name).catch((err) =>
                            toast.error(
                              err instanceof Error ? err.message : "Couldn't open the file",
                            ),
                          )
                        }
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <DialogFooter className="shrink-0">
          {canManage && onDelete && doc.resource_type !== "contract" && (
            <Button type="button" variant="outline" onClick={remove} disabled={busy}>
              <Trash2 className="mr-1 h-4 w-4 text-destructive" /> Delete
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={download} disabled={busy}>
            <Download className="mr-1 h-4 w-4" /> Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type PaneState = { loading: boolean; url?: string; text?: string; error?: unknown };

function PreviewPane({
  doc,
  version,
  versionId,
  onDownload,
}: {
  doc: DocumentRow;
  version: DocumentVersionRow | null;
  versionId?: string;
  onDownload: () => void;
}) {
  const kind = previewKind(version);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PaneState>({ loading: kind !== "unsupported" });

  useEffect(() => {
    if (kind === "unsupported") return;
    let cancelled = false;
    let created: string | undefined;
    setState({ loading: true });
    (async () => {
      try {
        const blob = await fetchDocumentFile(doc, "preview", versionId);
        if (cancelled) return;
        if (kind === "text") {
          const text = await blob.text();
          if (!cancelled) setState({ loading: false, text: text.slice(0, 200_000) });
          return;
        }
        created = URL.createObjectURL(blob);
        setState({ loading: false, url: created });
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: err });
      }
    })();
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [doc, kind, versionId, attempt]);

  if (kind === "unsupported") {
    return (
      <Unsupported
        fileName={version?.file_name ?? doc.title}
        type={fileTypeLabel(version)}
        onDownload={onDownload}
      />
    );
  }

  if (state.loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Opening the file…
        </div>
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  if (state.error) {
    return (
      <LoadError
        what="this file"
        error={state.error}
        onRetry={() => setAttempt((a) => a + 1)}
        className="my-6"
      />
    );
  }

  if (kind === "pdf") {
    return (
      <iframe
        src={state.url}
        title={doc.title}
        className="h-[65vh] w-full rounded-md border bg-white"
      />
    );
  }

  if (kind === "image") {
    return (
      <img
        src={state.url}
        alt={doc.title}
        className="mx-auto max-h-[65vh] rounded-md object-contain"
      />
    );
  }

  return (
    <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs">
      {state.text}
    </pre>
  );
}

function Unsupported({
  fileName,
  type,
  onDownload,
}: {
  fileName: string;
  type: string;
  onDownload: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border bg-card px-6 py-12 text-center">
      <FileQuestion className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium">This kind of file can't be shown here</p>
      <p className="max-w-md text-xs text-muted-foreground">
        {type} files open in the program that made them. Download {fileName} to read it.
      </p>
      <Button size="sm" className="mt-1" onClick={onDownload}>
        <Download className="mr-1 h-4 w-4" /> Download
      </Button>
    </div>
  );
}
