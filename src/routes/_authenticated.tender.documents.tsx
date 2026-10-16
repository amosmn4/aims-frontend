import { createFileRoute } from "@tanstack/react-router";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Upload, X } from "lucide-react";
import { usePermissions } from "@/lib/permissions";
import {
  useDocuments,
  useDeleteDocument,
  fileProblem,
  formatFileSize,
  type DocumentRow,
} from "@/features/documents/use-documents";
import { useDocumentUploads } from "@/features/documents/use-document-uploads";
import { DocumentDropZone, UploadProgressList } from "@/features/documents/document-drop-zone";
import { DocumentList } from "@/features/documents/document-list";
import { DocumentVersionHistoryDialog } from "@/features/documents/document-version-history-dialog";
import { DepartmentDocumentsPage } from "@/features/documents/documents-library";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/tender/documents")({
  head: () => ({ meta: [{ title: "Tender — Documents — AIMS" }] }),
  component: TenderDocuments,
});

function TenderDocuments() {
  return (
    <DepartmentDocumentsPage
      code="tender"
      extraTabs={[
        {
          value: "mandatory",
          label: "Mandatory documents",
          content: <MandatoryDocumentsLibrary />,
        },
      ]}
    />
  );
}

// Every mandatory-library file shares this resourceId; the catalog isn't tied to a record.
const LIBRARY_RESOURCE_ID = "global";

function MandatoryDocumentsLibrary() {
  const { canManageTenders: canManage } = usePermissions();
  const libraryQ = useDocuments({
    resourceType: "tender_document_library",
    resourceId: LIBRARY_RESOURCE_ID,
  });
  const deleteDocument = useDeleteDocument();
  const [versionsDoc, setVersionsDoc] = useState<DocumentRow | null>(null);
  const library = libraryQ.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl text-xs text-muted-foreground">
          Files most tenders ask for, like a Certificate of Incorporation. Add them once here, then
          tick the ones that apply on a tender&apos;s Requirements tab.
        </p>
        {canManage ? (
          <MandatoryUploadDialog />
        ) : (
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Button size="sm" disabled>
              <Plus className="h-4 w-4 mr-1" /> Add mandatory document
            </Button>
            <p className="text-xs text-muted-foreground">
              Only people who manage tenders can add these.
            </p>
          </div>
        )}
      </div>

      {libraryQ.isLoading ? (
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
      ) : libraryQ.isError ? (
        <LoadError
          what="mandatory documents"
          error={libraryQ.error}
          onRetry={() => libraryQ.refetch()}
        />
      ) : (
        <DocumentList
          documents={library}
          canManage={() => canManage}
          emptyState={
            <div className="rounded-lg border bg-card px-6 py-12 text-center">
              <p className="text-sm font-medium">No mandatory documents yet</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                Add the files tenders usually ask for once, and tick them on any tender that needs
                them.
              </p>
              {canManage && (
                <div className="mt-3 flex justify-center">
                  <MandatoryUploadDialog />
                </div>
              )}
            </div>
          }
          deleteCopy={(doc) => ({
            title: `Remove "${doc.title}" from mandatory documents?`,
            description: "Tenders that already use it keep their copy. This can't be undone.",
            confirmLabel: "Remove document",
          })}
          onDelete={(doc) =>
            deleteDocument
              .mutateAsync(doc.id)
              .then(() => toast.success(`Removed "${doc.title}" from mandatory documents`))
              .catch((err) =>
                toast.error(err instanceof Error ? err.message : "Couldn't remove the document"),
              )
          }
          onShowVersions={setVersionsDoc}
        />
      )}

      <DocumentVersionHistoryDialog
        doc={versionsDoc}
        canManage={canManage}
        onClose={() => setVersionsDoc(null)}
      />
    </div>
  );
}

function MandatoryUploadDialog() {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();
  const uploads = useDocumentUploads();

  const reset = () => {
    setTitle("");
    setFile(null);
    setFileError(undefined);
    setSubmitError(undefined);
    uploads.clear();
  };

  const chooseFile = (files: File[]) => {
    const chosen = files[0];
    if (!chosen) return;
    const problem = fileProblem(chosen);
    setFileError(problem ?? undefined);
    setFile(problem ? null : chosen);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setFileError("Choose a file to upload");
      return;
    }
    setSubmitError(undefined);
    const result = await uploads.upload(
      [file],
      {
        resourceType: "tender_document_library",
        resourceId: LIBRARY_RESOURCE_ID,
        title: title.trim() || undefined,
      },
      { silent: true },
    );
    if (result.uploaded === 0) {
      setSubmitError("Couldn't upload the file. See the message above.");
      return;
    }
    toast.success(`Added "${title.trim() || file.name}" to mandatory documents`);
    setOpen(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add mandatory document
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add a mandatory document</DialogTitle>
            <RequiredNote />
          </DialogHeader>
          <div className="space-y-2">
            <DocumentDropZone
              onFiles={chooseFile}
              multiple={false}
              disabled={uploads.uploading}
              label="Drag the file here, or choose it"
            />
            {file && (
              <div className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-xs">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{file.name}</span>{" "}
                  <span className="text-muted-foreground">{formatFileSize(file.size)}</span>
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setFile(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {fileError && (
              <p role="alert" className="text-xs text-destructive">
                {fileError}
              </p>
            )}
            <UploadProgressList items={uploads.items} />
          </div>
          <FormField id={`${uid}-title`} label="Title" hint="Leave blank to use the file name">
            <Input
              id={`${uid}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Certificate of Incorporation"
            />
          </FormField>
          {submitError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            >
              {submitError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={uploads.uploading}>
              {uploads.uploading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              Add mandatory document
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
