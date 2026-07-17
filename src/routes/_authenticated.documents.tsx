import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import {
  useDocuments,
  useDeleteDocument,
  RESOURCE_TYPE_LABELS,
  type LibraryResourceType,
  type DocumentRow,
} from "@/features/documents/use-documents";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { useAuth } from "@/lib/auth";
import { DocumentList } from "@/features/documents/document-list";
import { DocumentUploadDialog } from "@/features/documents/document-upload-dialog";
import { DocumentVersionHistoryDialog } from "@/features/documents/document-version-history-dialog";
import { DocumentAccessDialog } from "@/features/documents/document-access-picker";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [{ title: "Documents — AIMS" }] }),
  component: DocumentsLibrary,
});

const RESOURCE_TYPES: LibraryResourceType[] = ["project", "task", "finance_report", "tender", "contract"];

function DocumentsLibrary() {
  const { user, isAdminOrCeo } = useAuth();
  const [resourceType, setResourceType] = useState<LibraryResourceType | "all">("all");
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);

  const documentsQ = useDocuments({
    resourceType: resourceType === "all" ? undefined : resourceType,
    departmentId: departmentId === "all" ? undefined : departmentId,
    q: q.trim() || undefined,
    mine,
  });
  const departmentsQ = useDepartments();
  const deleteDocument = useDeleteDocument();

  const [versionsDoc, setVersionsDoc] = useState<DocumentRow | null>(null);
  const [accessDoc, setAccessDoc] = useState<DocumentRow | null>(null);

  // Manage actions (delete/version/share) are ultimately re-checked server-side against the
  // parent resource's own access rule — this is just the UI affordance, so it conservatively
  // shows for the uploader and admin/CEO rather than replicating every resource's rule here.
  const canManage = (doc: DocumentRow) => isAdminOrCeo || doc.created_by === user?.id;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold">Documents</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Central library for everything attached across Projects, Tasks, Finance Reports and
            Contracts.
          </p>
        </div>
        <DocumentUploadDialog />
      </div>

      <div className="rounded-lg border bg-card p-3 flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title or file name…"
            className="pl-7"
          />
        </div>
        <div className="w-40">
          <Select value={resourceType} onValueChange={(v) => setResourceType(v as typeof resourceType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {RESOURCE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {RESOURCE_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-45">
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {(departmentsQ.data ?? []).map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="mine-only" checked={mine} onCheckedChange={(v) => setMine(!!v)} />
          <Label htmlFor="mine-only" className="font-normal cursor-pointer text-sm">
            Mine only
          </Label>
        </div>
      </div>

      {documentsQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <DocumentList
          documents={documentsQ.data ?? []}
          canManage={canManage}
          showResourceType
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

      <DocumentVersionHistoryDialog
        doc={versionsDoc}
        canManage={!!versionsDoc && canManage(versionsDoc)}
        onClose={() => setVersionsDoc(null)}
      />
      <DocumentAccessDialog doc={accessDoc} onClose={() => setAccessDoc(null)} />
    </div>
  );
}
