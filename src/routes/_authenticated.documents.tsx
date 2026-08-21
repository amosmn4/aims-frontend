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
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [{ title: "Documents — AIMS" }] }),
  component: () => <DocumentsLibrary />,
});

const RESOURCE_TYPES: LibraryResourceType[] = [
  "project",
  "task",
  "finance_report",
  "tender",
  "contract",
];

/**
 * Exported so each department can embed this same library scoped to itself (department id
 * locked, department picker hidden) instead of the central, unscoped view every other role sees
 * — same "one shared component, narrower query" pattern as the rest of the department hubs.
 * When scoped, a "Shared with me" toggle sits next to it (Google-Drive-style: things outside your
 * own department that were specifically shared with you, not blended into your normal list).
 */
export function DocumentsLibrary({
  departmentId: lockedDepartmentId,
}: {
  departmentId?: string;
} = {}) {
  const { user, isAdminOrCeo } = useAuth();
  const [resourceType, setResourceType] = useState<LibraryResourceType | "all">("all");
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);
  const [view, setView] = useState<"mine" | "shared">("mine");
  const scoped = !!lockedDepartmentId;

  // Scoped (department-embedded) use only ever happens for a non-admin/CEO viewer — admin/CEO
  // use the unscoped central library below instead — so "mine" here can mean what it says:
  // documents this person actually uploaded, not "everything in my department" (that was the
  // old behavior, and it meant no department user ever had a truly personal view).
  const documentsQ = useDocuments({
    resourceType: resourceType === "all" ? undefined : resourceType,
    departmentId: scoped ? undefined : departmentId === "all" ? undefined : departmentId,
    q: q.trim() || undefined,
    mine: scoped ? view === "mine" : mine,
    sharedWithMe: scoped && view === "shared",
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
            {scoped
              ? "Documents you've uploaded, plus anything specifically shared with you."
              : "Central library for everything attached across Projects, Tasks, Finance Reports and Contracts."}
          </p>
        </div>
        <DocumentUploadDialog />
      </div>

      {scoped && (
        <div className="inline-flex rounded-md border bg-card p-0.5 text-xs">
          {(["mine", "shared"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-3 py-1.5 rounded-[5px] font-medium",
                view === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "mine" ? "My documents" : "Shared with me"}
            </button>
          ))}
        </div>
      )}

      {!scoped && (
        <div className="border-b flex gap-1 overflow-x-auto">
          <button
            onClick={() => setDepartmentId("all")}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap",
              departmentId === "all"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            All departments
          </button>
          {(departmentsQ.data ?? []).map((d) => (
            <button
              key={d.id}
              onClick={() => setDepartmentId(d.id)}
              className={cn(
                "px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap",
                departmentId === d.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

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
          <Select
            value={resourceType}
            onValueChange={(v) => setResourceType(v as typeof resourceType)}
          >
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
        {!scoped && (
          <div className="flex items-center gap-2">
            <Checkbox id="mine-only" checked={mine} onCheckedChange={(v) => setMine(!!v)} />
            <Label htmlFor="mine-only" className="font-normal cursor-pointer text-sm">
              Mine only
            </Label>
          </div>
        )}
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
