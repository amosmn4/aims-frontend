import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  Loader2,
  Upload,
  FileText,
  Trash2,
  Download,
  AlertTriangle,
  Calendar,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import {
  useContract,
  useContractDocuments,
  useDeleteContract,
  useDepartments,
  useProfilesLite,
  uploadContractDocument,
  deleteContractDocument,
  openContractDocument,
  getRenewalInfo,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_STYLES,
  BILLING_LABELS,
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_CATEGORY_STYLES,
  type DocumentCategory,
  type ContractDocumentRow,
} from "@/features/clients/use-clients-contracts";
import { useClients, useServiceLines } from "@/features/finance/use-finance-data";
import { ContractFormDialog } from "@/features/clients/contract-form-dialog";
import { formatCurrency } from "@/features/finance/finance";
import { RelatedRecords, type RelatedRecordItem } from "@/components/related-records";
import { EntityBreadcrumb, type BreadcrumbSegment } from "@/components/entity-breadcrumb";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { formatDate } from "@/lib/format-date";
import { useAuth, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/clients/contracts/$id")({
  component: ContractDetail,
});

function buildContractRelated(
  c: NonNullable<ReturnType<typeof useContract>["data"]>,
  clientName: string | null,
): RelatedRecordItem[] {
  const items: RelatedRecordItem[] = [];
  if (c.tender_id) {
    items.push({
      label: "Tender",
      title: c.tender_title ?? "Tender",
      to: `/tender/${c.tender_id}`,
    });
  }
  if (c.client_request_id) {
    items.push({
      label: "Client request",
      title: c.client_request_title ?? "Client request",
      to: `/requests/${c.client_request_id}`,
    });
  }
  for (const p of c.project_ids) {
    items.push({ label: "Project", title: p.name, to: `/projects/${p.id}` });
  }
  if (clientName) {
    items.push({
      label: "Client",
      title: clientName,
      to: `/clients?q=${encodeURIComponent(clientName)}`,
    });
  }
  return items;
}

// Plain-language file type, e.g. "PDF" or "Word document", instead of a raw mime type.
function friendlyFileType(fileName: string, mime: string | null): string {
  const m = (mime ?? "").toLowerCase();
  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  if (m === "application/pdf" || ext === "pdf") return "PDF";
  if (m.includes("wordprocessingml") || m === "application/msword" || ["doc", "docx"].includes(ext))
    return "Word document";
  if (
    m.includes("spreadsheetml") ||
    m === "application/vnd.ms-excel" ||
    ["xls", "xlsx", "csv"].includes(ext)
  )
    return "Excel sheet";
  if (m.startsWith("image/")) return "Image";
  return ext ? ext.toUpperCase() : "File";
}

function buildContractBreadcrumb(
  c: NonNullable<ReturnType<typeof useContract>["data"]>,
): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [];
  if (c.tender_id) {
    segments.push({ label: "Tenders", to: "/tender" });
    segments.push({ label: c.tender_title ?? "Tender", to: `/tender/${c.tender_id}` });
  } else if (c.client_request_id) {
    segments.push({ label: "Client requests", to: "/requests" });
    segments.push({
      label: c.client_request_title ?? "Request",
      to: `/requests/${c.client_request_id}`,
    });
  } else {
    segments.push({ label: "Contracts", to: "/clients/contracts" });
  }
  segments.push({ label: c.title });
  return segments;
}

function ContractDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdminOrCeo, hasRole } = useAuth();
  const contractQ = useContract(id);
  const docsQ = useContractDocuments(id);
  const clientsQ = useClients();
  const deptsQ = useDepartments();
  const profilesQ = useProfilesLite();
  const linesQ = useServiceLines();
  const deleteContract = useDeleteContract();
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>("signed");
  const [filterCat, setFilterCat] = useState<DocumentCategory | "all">("all");
  const [editing, setEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const docs = useMemo(() => (docsQ.data ?? []) as ContractDocumentRow[], [docsQ.data]);
  const catCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of docs) m[d.category ?? "other"] = (m[d.category ?? "other"] ?? 0) + 1;
    return m;
  }, [docs]);

  if (contractQ.isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (contractQ.isError) {
    return (
      <div className="space-y-3">
        <LoadError
          what="this contract"
          error={contractQ.error}
          onRetry={() => contractQ.refetch()}
        />
        <Link to="/clients/contracts" className="text-sm text-primary underline">
          Back to contracts
        </Link>
      </div>
    );
  }
  const c = contractQ.data;
  if (!c) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Contract not found.{" "}
        <Link to="/clients/contracts" className="text-primary underline">
          Back to contracts
        </Link>
      </div>
    );
  }

  const client = clientsQ.data?.find((x) => x.id === c.client_id);
  const dept = c.department_id ? deptsQ.data?.find((d) => d.id === c.department_id) : null;
  const line = c.service_line_id ? linesQ.data?.find((l) => l.id === c.service_line_id) : null;
  const mgr = c.account_manager_id
    ? profilesQ.data?.find((p) => p.id === c.account_manager_id)
    : null;
  const renewal = getRenewalInfo(c.end_date);
  // Mirrors the backend's assertContractDeptAccess exactly — same rule as the Contracts list.
  const canManage = c.department_id
    ? isAdminOrCeo || (!!dept?.code && hasRole(dept.code as AppRole))
    : isAdminOrCeo;

  const handleDelete = async () => {
    const ok = await confirmDialog({
      title: `Delete contract "${c.title}"?`,
      description: "Attached documents will also be removed.",
      confirmLabel: "Delete contract",
      destructive: true,
    });
    if (!ok) return;
    deleteContract.mutate(c.id, {
      onSuccess: () => {
        toast.success("Contract deleted");
        navigate({ to: "/clients/contracts" });
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
    });
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadContractDocument(c.id, file, uploadCategory);
      qc.invalidateQueries({ queryKey: ["contract-documents", c.id] });
      toast.success(`Uploaded as ${DOCUMENT_CATEGORY_LABELS[uploadCategory]}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const openDoc = async (doc: ContractDocumentRow) => {
    try {
      await openContractDocument(doc);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open file");
    }
  };

  const removeDoc = async (docId: string) => {
    const doc = (docsQ.data ?? []).find((d) => d.id === docId);
    if (!doc) return;
    const ok = await confirmDialog({
      title: `Delete ${doc.file_name}?`,
      description: "The file will be removed from this contract.",
      confirmLabel: "Delete document",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteContractDocument(doc);
      qc.invalidateQueries({ queryKey: ["contract-documents", c.id] });
      toast.success("Document deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const filteredDocs =
    filterCat === "all" ? docs : docs.filter((d) => (d.category ?? "other") === filterCat);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <EntityBreadcrumb segments={buildContractBreadcrumb(c)} />
        {canManage && (
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit contract
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              disabled={deleteContract.isPending}
              onClick={handleDelete}
            >
              {deleteContract.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1" />
              )}
              Delete contract
            </Button>
          </div>
        )}
      </div>

      {!canManage && !deptsQ.isLoading && (
        <ViewOnlyBanner area="this contract" action="edit or delete it" />
      )}

      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold">{c.title}</h1>
              <span
                className={`text-[0.625rem] px-1.5 py-0.5 rounded ${CONTRACT_STATUS_STYLES[c.status]}`}
              >
                {CONTRACT_STATUS_LABELS[c.status]}
              </span>
              {c.auto_renew && (
                <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  Auto-renew
                </span>
              )}
              {(renewal.status === "critical" ||
                renewal.status === "expired" ||
                renewal.status === "soon") && (
                <span
                  className={`text-[0.625rem] px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${renewal.className}`}
                >
                  <AlertTriangle className="h-3 w-3" /> {renewal.label}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {c.contract_number ?? "No number"} · {client?.name ?? "—"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Value</div>
            <div className="text-xl font-semibold tabular-nums">
              {formatCurrency(Number(c.value))}{" "}
              <span className="text-xs text-muted-foreground">{c.currency}</span>
            </div>
          </div>
        </div>

        {c.description && <p className="text-sm mt-3 whitespace-pre-wrap">{c.description}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
          <Field label="Department" value={dept?.name ?? "—"} />
          <Field label="Service line" value={line?.name ?? "—"} />
          <Field label="Account manager" value={mgr ? (mgr.full_name ?? mgr.email) : "—"} />
          <Field label="Billing" value={BILLING_LABELS[c.billing_frequency]} />
          <Field label="Start" value={formatDate(c.start_date)} />
          <Field label="End" value={formatDate(c.end_date)} />
          <Field label="Next invoice" value={formatDate(c.next_invoice_date)} />
          <Field label="Created" value={formatDate(c.created_at)} />
        </div>

        {c.notes && (
          <div className="mt-4 rounded bg-secondary/40 p-2 text-xs">
            <div className="font-semibold mb-1">Internal notes</div>
            <div className="whitespace-pre-wrap">{c.notes}</div>
          </div>
        )}
      </div>

      <ContractMoneySummary contract={c} />

      <RelatedRecords
        items={buildContractRelated(c, client?.name ?? null)}
        engagementTo={`/engagements/contract/${c.id}`}
      />

      {/* Renewal / expiry timeline */}
      <RenewalTimeline startDate={c.start_date} endDate={c.end_date} autoRenew={c.auto_renew} />

      {/* Documents */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="text-sm font-semibold">Documents ({docs.length})</div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={filterCat}
              onValueChange={(v) => setFilterCat(v as DocumentCategory | "all")}
            >
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {DOCUMENT_CATEGORIES.map((k) => (
                  <SelectItem key={k} value={k}>
                    {DOCUMENT_CATEGORY_LABELS[k]} ({catCounts[k] ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={uploadCategory}
              onValueChange={(v) => setUploadCategory(v as DocumentCategory)}
            >
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((k) => (
                  <SelectItem key={k} value={k}>
                    Upload as: {DOCUMENT_CATEGORY_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
              onChange={onUpload}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              {uploading ? "Uploading…" : "Upload document"}
            </Button>
          </div>
        </div>

        {/* Category summary chips */}
        <div className="flex gap-1.5 flex-wrap mb-3">
          {DOCUMENT_CATEGORIES.filter((k) => (catCounts[k] ?? 0) > 0).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={filterCat === k}
              onClick={() => setFilterCat(filterCat === k ? "all" : k)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${DOCUMENT_CATEGORY_STYLES[k]} ${filterCat === k ? "ring-2 ring-primary/40" : ""}`}
            >
              {DOCUMENT_CATEGORY_LABELS[k]} · {catCounts[k]}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          {docsQ.isLoading ? (
            <div className="py-4 flex justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          ) : docsQ.isError ? (
            <LoadError what="documents" error={docsQ.error} onRetry={() => docsQ.refetch()} />
          ) : docs.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">
              No documents yet. Upload the signed contract so everyone works from the same copy.
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-4 text-xs text-muted-foreground">
              <span>No documents in this category</span>
              <Button size="sm" variant="outline" onClick={() => setFilterCat("all")}>
                Show all categories
              </Button>
            </div>
          ) : (
            filteredDocs.map((d) => {
              const cat = (d.category ?? "other") as DocumentCategory;
              return (
                <div
                  key={d.id}
                  className="flex items-center gap-2 border rounded px-2 py-1.5 text-sm"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium flex items-center gap-2">
                      {d.file_name}
                      <span
                        className={`text-[0.625rem] px-1.5 py-0.5 rounded ${DOCUMENT_CATEGORY_STYLES[cat]}`}
                      >
                        {DOCUMENT_CATEGORY_LABELS[cat]}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {d.size_bytes ? `${(d.size_bytes / 1024).toFixed(1)} KB · ` : ""}
                      {friendlyFileType(d.file_name, d.mime_type)} · {formatDate(d.created_at)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openDoc(d)}
                    title={`Download ${d.file_name}`}
                    aria-label={`Download ${d.file_name}`}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeDoc(d.id)}
                    title={`Delete ${d.file_name}`}
                    aria-label={`Delete ${d.file_name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {editing && (
        <ContractFormDialog
          key={c.id}
          draft={{
            id: c.id,
            title: c.title,
            contract_number: c.contract_number ?? "",
            client_id: c.client_id,
            department_id: c.department_id ?? "",
            service_line_id: c.service_line_id ?? "",
            account_manager_id: c.account_manager_id ?? "",
            status: c.status,
            billing_frequency: c.billing_frequency,
            start_date: c.start_date,
            end_date: c.end_date ?? "",
            value: String(c.value),
            currency: c.currency,
            next_invoice_date: c.next_invoice_date ?? "",
            auto_renew: c.auto_renew,
            description: c.description ?? "",
            notes: c.notes ?? "",
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

// Money in and owed on this contract, from its invoices (void invoices excluded).
function ContractMoneySummary({
  contract: c,
}: {
  contract: NonNullable<ReturnType<typeof useContract>["data"]>;
}) {
  const value = Number(c.value);
  const pct = value > 0 ? (c.invoiced_total / value) * 100 : 0;
  const money = (n: number) => formatCurrency(n, c.currency);
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm font-semibold mb-3">Money summary</div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
        <Field label="Contract value" value={money(value)} />
        <div className="col-span-2 sm:col-span-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Invoiced so far
          </div>
          <div className="mt-0.5 tabular-nums">{money(c.invoiced_total)}</div>
          <Progress
            value={Math.min(100, pct)}
            className="mt-1.5 h-1.5"
            aria-label={`${pct.toFixed(0)}% of the contract value invoiced`}
          />
          <div className="mt-0.5 text-xs text-muted-foreground">
            {value > 0 ? `${pct.toFixed(0)}% of value` : "No contract value set"}
          </div>
        </div>
        <Field label="Paid" value={money(c.paid_total)} />
        <Field label="Outstanding" value={money(c.outstanding_total)} />
        <Field label="Invoices" value={String(c.invoice_count ?? 0)} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}

function RenewalTimeline({
  startDate,
  endDate,
  autoRenew,
}: {
  startDate: string;
  endDate: string | null;
  autoRenew: boolean;
}) {
  const info = getRenewalInfo(endDate);
  const start = new Date(startDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end: Date | null = endDate ? new Date(endDate + "T00:00:00") : null;
  const totalMs = end ? end.getTime() - start.getTime() : today.getTime() - start.getTime();
  const elapsedMs = today.getTime() - start.getTime();
  const pct = end && totalMs > 0 ? Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100)) : 100;

  const totalDays = end ? Math.max(1, Math.round(totalMs / 86400000)) : null;
  const elapsedDays = Math.max(0, Math.round(elapsedMs / 86400000));

  const barColor =
    info.status === "expired"
      ? "bg-destructive"
      : info.status === "critical"
        ? "bg-destructive"
        : info.status === "soon"
          ? "bg-warning"
          : info.status === "no_end"
            ? "bg-muted-foreground/40"
            : "bg-success";

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="text-sm font-semibold inline-flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-primary" /> Renewal / expiry timeline
        </div>
        <span className={`text-[0.625rem] px-1.5 py-0.5 rounded ${info.className}`}>
          {info.label}
        </span>
      </div>

      <div className="relative mt-3">
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
        </div>
        {/* Today marker */}
        {end && pct > 0 && pct < 100 && (
          <div
            className="absolute -top-1 h-4 w-0.5 bg-foreground"
            style={{ left: `${pct}%` }}
            title="Today"
          />
        )}
      </div>

      <div className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground mt-1.5">
        <span>Start · {formatDate(startDate)}</span>
        <span>Today · {formatDate(today)}</span>
        <span>{end ? `End · ${formatDate(endDate)}` : "No end date"}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
        <MiniStat label="Elapsed" value={`${elapsedDays}d`} />
        <MiniStat label="Total term" value={totalDays ? `${totalDays}d` : "—"} />
        <MiniStat
          label="Remaining"
          value={info.daysRemaining !== null ? `${Math.max(0, info.daysRemaining)}d` : "—"}
        />
        <MiniStat label="Auto-renew" value={autoRenew ? "Yes" : "No"} />
      </div>

      {(info.status === "critical" || info.status === "expired") && (
        <div className="mt-3 rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive inline-flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            {info.status === "expired"
              ? "This contract has expired. Renew, extend or mark as terminated."
              : "This contract is up for renewal within 30 days. Confirm renewal terms with the client."}
          </span>
        </div>
      )}
      {info.status === "soon" && (
        <div className="mt-3 rounded border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning inline-flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Renewal is due within 90 days — start renewal negotiations now.</span>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-2">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
