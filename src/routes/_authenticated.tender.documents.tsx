import { createFileRoute } from "@tanstack/react-router";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Upload } from "lucide-react";
import { usePermissions } from "@/lib/permissions";
import {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
  DOCUMENT_ACCEPT,
  MAX_DOCUMENT_BYTES,
  type DocumentRow,
} from "@/features/documents/use-documents";
import { DocumentList } from "@/features/documents/document-list";
import { DocumentVersionHistoryDialog } from "@/features/documents/document-version-history-dialog";
import { DepartmentDocumentsPage } from "@/features/documents/documents-library";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        <div className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
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
  const upload = useUploadDocument();

  const reset = () => {
    setTitle("");
    setFile(null);
    setFileError(undefined);
    setSubmitError(undefined);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setFileError("Choose a file to upload");
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setFileError("This file is bigger than 25 MB. Choose a smaller file.");
      return;
    }
    setSubmitError(undefined);
    upload.mutate(
      {
        file,
        resourceType: "tender_document_library",
        resourceId: LIBRARY_RESOURCE_ID,
        title: title.trim() || undefined,
      },
      {
        onSuccess: (doc) => {
          toast.success(`Added "${doc.title}" to mandatory documents`);
          setOpen(false);
          reset();
        },
        onError: (err) =>
          setSubmitError(
            err instanceof Error ? err.message : "Couldn't upload the file. Try again.",
          ),
      },
    );
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
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add a mandatory document</DialogTitle>
            <RequiredNote />
          </DialogHeader>
          <FormField
            id={`${uid}-file`}
            label="File"
            required
            error={fileError}
            hint="PDF, Word, Excel, PowerPoint, images, text or zip — up to 25 MB"
          >
            <Input
              id={`${uid}-file`}
              type="file"
              accept={DOCUMENT_ACCEPT}
              aria-invalid={!!fileError}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setFileError(undefined);
              }}
            />
          </FormField>
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
            <Button type="submit" disabled={upload.isPending}>
              {upload.isPending ? (
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
