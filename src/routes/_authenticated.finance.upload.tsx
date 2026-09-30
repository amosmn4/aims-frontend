import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload, Download, CheckCircle2, AlertTriangle, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { confirmDialog } from "@/components/confirm-dialog";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiJson } from "@/lib/api-client";
import { formatDate } from "@/lib/format-date";
import { useClients, useInvoices } from "@/features/finance/use-finance-data";
import { useCompanyCurrency, useFinanceAccess } from "@/features/finance/money";

export const Route = createFileRoute("/_authenticated/finance/upload")({
  head: () => ({ meta: [{ title: "Import invoices from Excel — AIMS Finance" }] }),
  component: UploadPage,
});

interface ParsedRow {
  invoice_number: string;
  client_name: string;
  service_line_code: string;
  issue_date: string;
  due_date: string;
  currency_code: string;
  subtotal: number;
  tax: number;
  direct_cost: number;
  is_recurring: boolean;
  status: string;
  notes?: string;
  contract_number?: string;
  amount_paid?: number;
  paid_on?: string;
  payment_reference?: string;
}

interface UploadResult {
  row: number;
  status: "success" | "error";
  message: string;
}

function toDate(v: unknown): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel stores dates as serial numbers.
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d)).toISOString().slice(0, 10);
  }
  const s = String(v);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function toOptionalNumber(v: unknown): number | undefined {
  if (v === null || v === undefined || String(v).trim() === "") return undefined;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? undefined : n;
}

function toOptionalText(v: unknown): string | undefined {
  const s = String(v ?? "").trim();
  return s || undefined;
}

// "Amount paid", "Amount Paid " and "amount_paid" all become "amount_paid".
function normalizeHeader(key: string) {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function withNormalizedHeaders(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const [k, v] of Object.entries(row)) {
    const nk = normalizeHeader(k);
    if (!(nk in out) || out[nk] === "") out[nk] = v;
  }
  return out;
}

function toBool(v: unknown): boolean {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  return s === "true" || s === "yes" || s === "y" || s === "1" || s === "recurring";
}

// Loose form of a client name, to spot "Acme Ltd" vs "ACME LTD." near-duplicates.
const looseName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[.,'’&()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

function UploadPage() {
  const qc = useQueryClient();
  const clientsQ = useClients();
  const invoicesQ = useInvoices();
  const companyCurrency = useCompanyCurrency();
  const { canRaiseInvoices, canWrite } = useFinanceAccess();
  const canImport = canRaiseInvoices && canWrite;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [fileName, setFileName] = useState("");

  const handleDownloadTemplate = () => {
    const example = [
      {
        invoice_number: "INV-2026-001",
        client_name: "Acme Ltd",
        service_line_code: "PAYROLL",
        issue_date: "2026-01-15",
        due_date: "2026-02-14",
        currency_code: companyCurrency,
        subtotal: 100000,
        tax: 16000,
        direct_cost: 40000,
        is_recurring: "yes",
        status: "sent",
        notes: "January payroll processing",
        contract_number: "CT-2026-004",
        amount_paid: 116000,
        paid_on: "2026-02-10",
        payment_reference: "QJK4H7PL2M",
      },
      {
        invoice_number: "INV-2026-002",
        client_name: "Beta Corp",
        service_line_code: "TRAINING",
        issue_date: "2026-01-20",
        due_date: "2026-02-19",
        currency_code: companyCurrency,
        subtotal: 250000,
        tax: 40000,
        direct_cost: 80000,
        is_recurring: "no",
        status: "sent",
        notes: "Leadership training",
        contract_number: "",
        amount_paid: "",
        paid_on: "",
        payment_reference: "",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(example);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");
    XLSX.writeFile(wb, "aims-finance-invoice-template.xlsx");
  };

  const clearFile = () => {
    setParsed([]);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    setParsing(true);
    setResults([]);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils
        .sheet_to_json<Record<string, unknown>>(ws, { defval: "" })
        .map(withNormalizedHeaders);
      const mapped: ParsedRow[] = rows.map((r) => ({
        invoice_number: String(r.invoice_number ?? r["Invoice #"] ?? "").trim(),
        client_name: String(r.client_name ?? r.client ?? "").trim(),
        service_line_code: String(r.service_line_code ?? r.service_line ?? "")
          .trim()
          .toUpperCase(),
        issue_date: toDate(r.issue_date ?? r.issued),
        due_date: toDate(r.due_date ?? r.due),
        currency_code:
          String(r.currency_code ?? r.currency ?? companyCurrency)
            .trim()
            .toUpperCase() || companyCurrency,
        subtotal: toNumber(r.subtotal ?? r.amount),
        tax: toNumber(r.tax ?? r.vat),
        direct_cost: toNumber(r.direct_cost ?? r.cost),
        is_recurring: toBool(r.is_recurring ?? r.recurring),
        status:
          String(r.status ?? "sent")
            .trim()
            .toLowerCase() || "sent",
        notes: r.notes ? String(r.notes) : undefined,
        contract_number: toOptionalText(r.contract_number ?? r.contract),
        amount_paid: toOptionalNumber(r.amount_paid ?? r.paid_amount),
        paid_on: toOptionalText(r.paid_on ?? r.payment_date)
          ? toDate(r.paid_on ?? r.payment_date)
          : undefined,
        payment_reference: toOptionalText(r.payment_reference ?? r.reference),
      }));
      if (mapped.length === 0) {
        toast.error("The first sheet has no rows to import");
        clearFile();
        return;
      }
      setParsed(mapped);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read that file");
      clearFile();
    } finally {
      setParsing(false);
    }
  };

  // What the import will do: clients it creates, invoices it updates, rows likely to fail.
  const check = useMemo(() => {
    const clients = clientsQ.data ?? [];
    const exact = new Set(clients.map((c) => c.name));
    const loose = new Map(clients.map((c) => [looseName(c.name), c.name]));
    const newClients = new Map<string, { names: Set<string>; lookalike?: string }>();
    for (const r of parsed) {
      if (!r.client_name || exact.has(r.client_name)) continue;
      const key = looseName(r.client_name);
      const entry = newClients.get(key) ?? { names: new Set<string>(), lookalike: loose.get(key) };
      entry.names.add(r.client_name);
      newClients.set(key, entry);
    }
    const existingNumbers = new Set((invoicesQ.data ?? []).map((i) => i.invoice_number));
    const updates = parsed.filter((r) => existingNumbers.has(r.invoice_number)).length;
    const broken = parsed.filter(
      (r) =>
        !r.invoice_number || !r.client_name || !isIsoDate(r.issue_date) || !isIsoDate(r.due_date),
    ).length;
    return { newClients: Array.from(newClients.values()), updates, broken };
  }, [parsed, clientsQ.data, invoicesQ.data]);

  const newClientNames = check.newClients.flatMap((c) => Array.from(c.names));
  const lookalikes = check.newClients.filter((c) => c.lookalike);
  const spellings = check.newClients.filter((c) => c.names.size > 1);

  const handleImport = async () => {
    if (parsed.length === 0) return;
    if (newClientNames.length > 0) {
      const ok = await confirmDialog({
        title: `Add ${newClientNames.length} new client${newClientNames.length === 1 ? "" : "s"}?`,
        description: `Importing will add these clients to AIMS: ${newClientNames.join(", ")}.`,
        confirmLabel: `Import and add ${newClientNames.length} client${newClientNames.length === 1 ? "" : "s"}`,
      });
      if (!ok) return;
    }
    setImporting(true);
    try {
      const { results, successCount, errorCount } = await apiJson<{
        results: UploadResult[];
        successCount: number;
        errorCount: number;
      }>("/finance-uploads/invoices", {
        method: "POST",
        body: JSON.stringify({
          fileName,
          rows: parsed.map((row) => ({
            invoiceNumber: row.invoice_number,
            clientName: row.client_name,
            serviceLineCode: row.service_line_code || undefined,
            issueDate: row.issue_date,
            dueDate: row.due_date,
            currencyCode: row.currency_code,
            subtotal: row.subtotal,
            tax: row.tax,
            directCost: row.direct_cost,
            isRecurring: row.is_recurring,
            status: row.status,
            notes: row.notes,
            contractNumber: row.contract_number,
            amountPaid: row.amount_paid,
            paidOn: row.paid_on,
            paymentReference: row.payment_reference,
          })),
        }),
      });
      setResults(results);
      void qc.invalidateQueries({ queryKey: ["finance"] });
      void qc.invalidateQueries({ queryKey: ["contracts"] });
      if (errorCount === 0) {
        toast.success(`Imported ${successCount} invoice${successCount === 1 ? "" : "s"}`);
        clearFile();
      } else {
        toast.warning(`Imported ${successCount} · ${errorCount} failed — see the results below`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    }
    setImporting(false);
  };

  const checking = parsed.length > 0 && (clientsQ.isLoading || invoicesQ.isLoading);
  const checkFailed = parsed.length > 0 ? [clientsQ, invoicesQ].find((q) => q.isError) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import invoices from Excel"
        description="Add or update many invoices at once from a spreadsheet. Check the preview before you import."
        actions={
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="mr-2 h-4 w-4" /> Download template
          </Button>
        }
      />
      {!canImport && <ViewOnlyBanner area="Finance" action="import invoices" />}

      <div className="rounded-lg border bg-card p-4 sm:p-6">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Columns:{" "}
          <span className="font-mono text-xs">
            invoice_number, client_name, service_line_code, issue_date, due_date, currency_code,
            subtotal, tax, direct_cost, is_recurring, status, notes
          </span>
          . Optional:{" "}
          <span className="font-mono text-xs">
            contract_number, amount_paid, paid_on, payment_reference
          </span>
          . Headings like &ldquo;Contract number&rdquo; also work. If &ldquo;Paid on&rdquo; is
          empty, the issue date is used. A client name that doesn&rsquo;t exactly match a client in
          AIMS creates a new client.
        </p>

        <div className="mt-6 rounded-lg border-2 border-dashed p-6 text-center sm:p-8">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            aria-label="Excel file to import"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <Upload className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <div className="mt-3 font-medium">{fileName || "No file chosen"}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            .xlsx, .xls or .csv, up to a few thousand rows
          </p>
          <Button
            className="mt-4"
            variant={parsed.length ? "outline" : "default"}
            onClick={() => fileInputRef.current?.click()}
            disabled={parsing}
          >
            {parsing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {parsed.length ? "Choose a different file" : "Choose Excel file"}
          </Button>
        </div>
      </div>

      {parsed.length > 0 && (
        <div className="space-y-4 rounded-lg border bg-card p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Check before importing — {parsed.length} rows</h2>
              <p className="text-xs text-muted-foreground">
                {check.updates > 0
                  ? `${parsed.length - check.updates} new invoice${parsed.length - check.updates === 1 ? "" : "s"}; ${check.updates} existing invoice${check.updates === 1 ? "" : "s"} with the same number will be updated.`
                  : "Every row is a new invoice."}
                {check.broken > 0 &&
                  ` ${check.broken} row${check.broken === 1 ? " is" : "s are"} missing an invoice number, client or valid date and will fail.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={clearFile} disabled={importing}>
                <X className="mr-1 h-4 w-4" /> Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || checking || !!checkFailed || !canImport}
                title={!canImport ? "Only Finance can import invoices" : undefined}
              >
                {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import {parsed.length} invoices
              </Button>
            </div>
          </div>

          {checkFailed ? (
            <LoadError
              what="existing clients and invoices, so we can't check for duplicates"
              error={checkFailed.error}
              onRetry={() => {
                void clientsQ.refetch();
                void invoicesQ.refetch();
              }}
            />
          ) : checking ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking which clients are already in
              AIMS…
            </p>
          ) : newClientNames.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> Every client in this file is already in AIMS.
            </p>
          ) : (
            <div
              role="status"
              className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm"
            >
              <div className="flex items-center gap-2 font-medium">
                <UserPlus className="h-4 w-4 text-warning" aria-hidden="true" />
                These clients aren&rsquo;t in AIMS yet and will be added:{" "}
                {newClientNames.join(", ")}
              </div>
              {lookalikes.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-6 text-xs">
                  {lookalikes.map((c) => (
                    <li key={c.lookalike}>
                      &ldquo;{Array.from(c.names).join("”, “")}&rdquo; looks like{" "}
                      <strong>{c.lookalike}</strong>, already in AIMS. Change the file to match it
                      exactly, or a duplicate client will be created.
                    </li>
                  ))}
                </ul>
              )}
              {spellings.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-6 text-xs">
                  {spellings.map((c) => (
                    <li key={Array.from(c.names).join("|")}>
                      The file spells one client more than one way (&ldquo;
                      {Array.from(c.names).join("”, “")}&rdquo;). Each spelling becomes a separate
                      client — use one spelling.
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="max-h-96 overflow-auto rounded border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Service line</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">Amount before VAT</TableHead>
                  <TableHead className="text-right">VAT</TableHead>
                  <TableHead className="text-right">Direct cost</TableHead>
                  <TableHead>Recurring</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Paid on</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.slice(0, 100).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">
                      {r.invoice_number || <span className="text-destructive">Missing</span>}
                    </TableCell>
                    <TableCell>
                      {r.client_name || <span className="text-destructive">Missing</span>}
                      {r.client_name && newClientNames.includes(r.client_name) && (
                        <span className="ml-1 text-xs text-warning">(new)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{r.service_line_code}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDate(r.issue_date, r.issue_date || "Missing")}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDate(r.due_date, r.due_date || "Missing")}
                    </TableCell>
                    <TableCell className="text-xs">{r.currency_code}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.subtotal.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.tax.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.direct_cost.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs">{r.is_recurring ? "Yes" : "No"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.contract_number ?? ""}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.amount_paid != null ? r.amount_paid.toLocaleString() : ""}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {r.paid_on ? formatDate(r.paid_on, r.paid_on) : ""}
                    </TableCell>
                    <TableCell className="text-xs">{r.payment_reference ?? ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {parsed.length > 100 && (
              <div className="border-t p-3 text-center text-xs text-muted-foreground">
                … and {parsed.length - 100} more rows
              </div>
            )}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="rounded-lg border bg-card p-4 sm:p-6">
          <h2 className="mb-4 font-semibold">Import results</h2>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {results.map((r) => (
              <div
                key={r.row}
                className={`flex items-center gap-2 rounded px-3 py-1.5 text-sm ${
                  r.status === "success" ? "bg-success/5" : "bg-destructive/5"
                }`}
              >
                {r.status === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="Imported" />
                ) : (
                  <AlertTriangle
                    className="h-4 w-4 shrink-0 text-destructive"
                    aria-label="Failed"
                  />
                )}
                <span className="w-16 shrink-0 text-xs text-muted-foreground">Row {r.row}</span>
                <span className="truncate">{r.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
