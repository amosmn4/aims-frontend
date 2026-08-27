import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { useAuth } from "@/lib/auth";
import {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
  formatFileSize,
} from "@/features/documents/use-documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DocumentsLibrary } from "./_authenticated.documents";

export const Route = createFileRoute("/_authenticated/tender/documents")({
  head: () => ({ meta: [{ title: "Tender — Documents — AIMS" }] }),
  component: TenderDocuments,
});

function TenderDocuments() {
  const departmentsQ = useDepartments();
  const dept = departmentsQ.data?.find((d) => d.code === "tender");
  if (!dept) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <MandatoryDocumentsLibrary />
      <DocumentsLibrary departmentId={dept.id} />
    </div>
  );
}

// The sentinel resourceId every "tender_document_library" Document shares — this catalog isn't
// attached to any real record, it IS the record (see the schema's DocumentResourceType comment).
const LIBRARY_RESOURCE_ID = "global";

function MandatoryDocumentsLibrary() {
  const { isAdminOrCeo, hasRole } = useAuth();
  const canManage = isAdminOrCeo || hasRole("tender");
  const libraryQ = useDocuments({
    resourceType: "tender_document_library",
    resourceId: LIBRARY_RESOURCE_ID,
  });
  const deleteDocument = useDeleteDocument();
  const library = libraryQ.data ?? [];

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold">Mandatory documents library</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Documents that are the same across every tender — upload once here, then tick which
            apply from any tender&apos;s Requirements tab instead of re-uploading them.
          </p>
        </div>
        {canManage && <LibraryUploadDialog />}
      </div>
      {libraryQ.isLoading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : library.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">
          No mandatory documents yet.
        </div>
      ) : (
        <div className="space-y-2">
          {library.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{doc.title}</div>
                <div className="text-xs text-muted-foreground">
                  {doc.latest_version ? formatFileSize(doc.latest_version.size_bytes) : "—"}
                  {" · "}
                  {new Date(doc.created_at).toLocaleDateString()}
                </div>
              </div>
              {canManage && (
                <Button
                  size="icon"
                  variant="ghost"
                  title="Remove from library"
                  onClick={() =>
                    deleteDocument.mutate(doc.id, {
                      onError: (err) =>
                        toast.error(err instanceof Error ? err.message : "Failed to delete"),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LibraryUploadDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const upload = useUploadDocument();

  const submit = () => {
    if (!file) {
      toast.error("Choose a file to upload");
      return;
    }
    upload.mutate(
      {
        file,
        resourceType: "tender_document_library",
        resourceId: LIBRARY_RESOURCE_ID,
        title: title.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Added to the mandatory documents library");
          setOpen(false);
          setTitle("");
          setFile(null);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Upload failed"),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setTitle("");
          setFile(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add to library
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a mandatory document</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Certificate of Incorporation"
            />
          </div>
          <div>
            <Label>File</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={upload.isPending}>
            {upload.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-1" />
            )}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
