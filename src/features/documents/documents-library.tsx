import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Plus, Search, Upload, X } from "lucide-react";
import {
  useDocuments,
  useDeleteDocument,
  documentPlace,
  DOCUMENT_PLACES,
  type DocumentFilters,
  type DocumentPlace,
  type DocumentRow,
} from "@/features/documents/use-documents";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { DocumentList } from "@/features/documents/document-list";
import { DocumentUploadDialog } from "@/features/documents/document-upload-dialog";
import { DocumentVersionHistoryDialog } from "@/features/documents/document-version-history-dialog";
import { DocumentAccessDialog } from "@/features/documents/document-access-picker";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { PaginationBar } from "@/components/pagination-bar";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { WithDepartment } from "@/components/nav/with-department";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePagination } from "@/hooks/use-pagination";
import { useAuth, type DepartmentCode } from "@/lib/auth";
import { DEPARTMENT_NAMES } from "@/lib/department-nav";
import { usePermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DepartmentLite = { id: string; name: string; code: string };
export type ExtraDocumentsTab = { value: string; label: string; content: ReactNode };

const departmentDescription = (name: string) =>
  `Every file ${name} can see: its library, plus files on its projects, client requests, tenders and reports.`;

function EmptyBox({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border bg-card px-6 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

/* ---------- Department Documents pages ---------- */

export function DepartmentDocumentsPage({
  code,
  extraTabs,
}: {
  code: DepartmentCode;
  extraTabs?: ExtraDocumentsTab[];
}) {
  const departmentsQ = useDepartments();
  const department = departmentsQ.data?.find((d) => d.code === code);
  if (department) return <DepartmentDocuments department={department} extraTabs={extraTabs} />;
  return (
    <div>
      <PageHeader title="Documents" description={departmentDescription(DEPARTMENT_NAMES[code])} />
      <WithDepartment code={code}>{() => null}</WithDepartment>
    </div>
  );
}

function DepartmentDocuments({
  department,
  extraTabs = [],
}: {
  department: DepartmentLite;
  extraTabs?: ExtraDocumentsTab[];
}) {
  const { user, isAdminOrCeo, canWriteDepartment } = useAuth();
  const { canManageTenders } = usePermissions();
  const canEdit = canWriteDepartment(department.code);
  const [tab, setTab] = useState("all");
  const name = department.name;

  const canManage = (doc: DocumentRow) => {
    if (isAdminOrCeo || doc.created_by === user?.id) return true;
    if (doc.resource_type === "tender_document_library") return canManageTenders;
    return canEdit;
  };
  // The mandatory tender catalog only belongs on the Tender page.
  const belongsHere = (doc: DocumentRow) =>
    department.code === "tender" || doc.resource_type !== "tender_document_library";

  const addToLibrary = canEdit ? (
    <DocumentUploadDialog
      department={department}
      defaultAttachTo="department"
      trigger={
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add to library
        </Button>
      }
    />
  ) : undefined;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Documents"
        description={departmentDescription(name)}
        actions={
          canEdit ? (
            <DocumentUploadDialog
              department={department}
              trigger={
                <Button size="sm">
                  <Upload className="h-4 w-4 mr-1" /> Upload document
                </Button>
              }
            />
          ) : undefined
        }
      />
      {!canEdit && <ViewOnlyBanner area={`${name} documents`} action="add files to them" />}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="all">All {name} documents</TabsTrigger>
            {extraTabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
            <TabsTrigger value="mine">My documents</TabsTrigger>
            <TabsTrigger value="shared">Shared with me</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all" className="mt-3">
          <DocumentsBrowser
            filters={{ departmentId: department.id }}
            what={`${name} documents`}
            include={belongsHere}
            canManage={canManage}
            empty={<EmptyBox title={`No documents in ${name} yet`} action={addToLibrary} />}
          />
        </TabsContent>
        {extraTabs.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-3">
            {t.content}
          </TabsContent>
        ))}
        <TabsContent value="mine" className="mt-3">
          <DocumentsBrowser
            filters={{ mine: true, departmentId: department.id }}
            what={`your ${department.name} documents`}
            canManage={canManage}
            empty={
              <EmptyBox
                title={`You haven't added any ${department.name} documents yet`}
                action={addToLibrary}
              />
            }
          />
        </TabsContent>
        <TabsContent value="shared" className="mt-3">
          <DocumentsBrowser
            filters={{ sharedWithMe: true, departmentId: department.id }}
            what={`${department.name} documents shared with you`}
            canManage={canManage}
            empty={
              <EmptyBox
                title={`No ${department.name} documents have been shared with you yet`}
                hint="Files show up here when someone picks you under “Who can see this file”."
              />
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Company-wide Documents page ---------- */

type Show = "all" | "mine" | "shared";

export function CompanyDocuments() {
  const { user, isAdminOrCeo, hasCapability, canWriteDepartment } = useAuth();
  const departmentsQ = useDepartments();
  const [departmentId, setDepartmentId] = useState("all");
  const [show, setShow] = useState<Show>("all");
  const department = departmentsQ.data?.find((d) => d.id === departmentId);
  const canUpload = hasCapability("edit_department");
  const canManage = (doc: DocumentRow) => isAdminOrCeo || doc.created_by === user?.id;

  const clearShow = () => setShow("all");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Documents"
        description="Every file in the company: department libraries, plus files on projects, client requests, tenders, reports and contracts."
        actions={
          canUpload ? (
            <DocumentUploadDialog
              department={department}
              trigger={
                <Button size="sm">
                  <Upload className="h-4 w-4 mr-1" /> Upload document
                </Button>
              }
            />
          ) : undefined
        }
      />
      {!canUpload && <ViewOnlyBanner area="these documents" action="add files here" />}

      <div className="border-b flex gap-1 overflow-x-auto" role="group" aria-label="Department">
        {[{ id: "all", name: "All departments" }, ...(departmentsQ.data ?? [])].map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setDepartmentId(d.id)}
            aria-pressed={departmentId === d.id}
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
      {departmentsQ.isError && (
        <LoadError
          what="departments"
          error={departmentsQ.error}
          onRetry={() => departmentsQ.refetch()}
        />
      )}

      <DocumentsBrowser
        key={departmentId}
        filters={{
          departmentId: department?.id,
          mine: show === "mine",
          sharedWithMe: show === "shared",
        }}
        what={department ? `${department.name} documents` : "documents"}
        canManage={canManage}
        extraFilter={
          <Select value={show} onValueChange={(v) => setShow(v as Show)}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Show">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All files</SelectItem>
              <SelectItem value="mine">Files I added</SelectItem>
              <SelectItem value="shared">Shared with me</SelectItem>
            </SelectContent>
          </Select>
        }
        extraFilterActive={show !== "all"}
        onClearExtraFilter={clearShow}
        empty={
          <EmptyBox
            title={department ? `No documents in ${department.name} yet` : "No documents yet"}
            action={
              department && canWriteDepartment(department.code) ? (
                <DocumentUploadDialog
                  department={department}
                  defaultAttachTo="department"
                  trigger={
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" /> Add to library
                    </Button>
                  }
                />
              ) : !department && canUpload ? (
                <DocumentUploadDialog
                  trigger={
                    <Button size="sm">
                      <Upload className="h-4 w-4 mr-1" /> Upload document
                    </Button>
                  }
                />
              ) : undefined
            }
          />
        }
      />
    </div>
  );
}

/* ---------- Shared list with search, "where it's attached" filter and states ---------- */

function DocumentsBrowser({
  filters,
  what,
  include,
  canManage,
  empty,
  extraFilter,
  extraFilterActive = false,
  onClearExtraFilter,
}: {
  filters: DocumentFilters;
  what: string;
  include?: (doc: DocumentRow) => boolean;
  canManage: (doc: DocumentRow) => boolean;
  empty: ReactNode;
  extraFilter?: ReactNode;
  extraFilterActive?: boolean;
  onClearExtraFilter?: () => void;
}) {
  const [q, setQ] = useState("");
  const [place, setPlace] = useState<DocumentPlace | "all">("all");
  const [label, setLabel] = useState("all");
  const debouncedQ = useDebouncedValue(q.trim());
  const documentsQ = useDocuments({ ...filters, q: debouncedQ || undefined });
  const deleteDocument = useDeleteDocument();
  const [versionsDoc, setVersionsDoc] = useState<DocumentRow | null>(null);
  const [accessDoc, setAccessDoc] = useState<DocumentRow | null>(null);
  const { page, pageSize, setPage, setPageSize } = usePagination();

  const rows = (documentsQ.data ?? []).filter((d) => !include || include(d));
  const counts = new Map<DocumentPlace, number>();
  for (const d of rows) {
    const p = documentPlace(d.resource_type);
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  const labels = [...new Set(rows.flatMap((d) => d.tags ?? []))].sort();
  const shown = rows.filter(
    (d) =>
      (place === "all" || documentPlace(d.resource_type) === place) &&
      (label === "all" || (d.tags ?? []).includes(label)),
  );
  const hasFilters = q.trim() !== "" || place !== "all" || label !== "all" || extraFilterActive;
  const places = DOCUMENT_PLACES.filter(
    (p) => p.value !== "contracts" || (counts.get("contracts") ?? 0) > 0 || place === "contracts",
  );

  // Back to the first page whenever the list underneath changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, place, label, extraFilterActive, setPage]);

  const pageRows = shown.slice((page - 1) * pageSize, page * pageSize);
  const showPagination = shown.length > 25 || page > 1 || pageSize !== 25;

  const clearFilters = () => {
    setQ("");
    setPlace("all");
    setLabel("all");
    onClearExtraFilter?.();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title or file name"
              aria-label="Search by title or file name"
              className="pl-7"
            />
          </div>
          {labels.length > 0 && (
            <Select value={label} onValueChange={setLabel}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All labels</SelectItem>
                {labels.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {extraFilter}
        </div>
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Where it's attached"
        >
          <span className="mr-1 text-xs text-muted-foreground">Attached to:</span>
          {[{ value: "all" as const, label: "Everywhere" }, ...places].map((p) => {
            const active = place === p.value;
            const count = p.value === "all" ? rows.length : (counts.get(p.value) ?? 0);
            return (
              <Button
                key={p.value}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                onClick={() => setPlace(p.value)}
                className="h-7 rounded-full px-3 text-xs"
              >
                {p.label}
                {documentsQ.data && <span className="ml-1 opacity-70">{count}</span>}
              </Button>
            );
          })}
        </div>
      </div>

      {documentsQ.isLoading ? (
        <div className="space-y-2 rounded-lg border bg-card p-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : documentsQ.isError ? (
        <LoadError what={what} error={documentsQ.error} onRetry={() => documentsQ.refetch()} />
      ) : shown.length === 0 ? (
        hasFilters ? (
          <EmptyBox
            title="No matches"
            action={
              <Button size="sm" variant="outline" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" /> Clear filters
              </Button>
            }
          />
        ) : (
          empty
        )
      ) : (
        <DocumentList
          documents={pageRows}
          canManage={canManage}
          showResourceType
          footer={
            showPagination ? (
              <PaginationBar
                page={page}
                pageSize={pageSize}
                total={shown.length}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            ) : undefined
          }
          onDelete={(doc) =>
            deleteDocument
              .mutateAsync(doc.id)
              .then(() => toast.success(`Deleted "${doc.title}"`))
              .catch((err) =>
                toast.error(err instanceof Error ? err.message : "Couldn't delete the file"),
              )
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
