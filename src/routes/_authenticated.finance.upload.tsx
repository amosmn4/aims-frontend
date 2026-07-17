import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Loader2, Upload, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
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
import { useClients } from "@/features/finance/use-finance-data";

export const Route = createFileRoute("/_authenticated/finance/upload")({
  head: () => ({ meta: [{ title: "Excel Upload — AIMS Finance" }] }),
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
    // Excel serial
    const d = XLSX.SSF.parse_date_code(v);
    if (d) {
      const iso = new Date(Date.UTC(d.y, d.m - 1, d.d)).toISOString().slice(0, 10);
      return iso;
    }
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

function toBool(v: unknown): boolean {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  return s === "true" || s === "yes" || s === "y" || s === "1" || s === "recurring";
}

function UploadPage() {
  const clientsQ = useClients();
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
        currency_code: "KES",
        subtotal: 100000,
        tax: 16000,
        direct_cost: 40000,
        is_recurring: "yes",
        status: "sent",
        notes: "January payroll processing",
      },
      {
        invoice_number: "INV-2026-002",
        client_name: "Beta Corp",
        service_line_code: "TRAINING",
        issue_date: "2026-01-20",
        due_date: "2026-02-19",
        currency_code: "KES",
        subtotal: 250000,
        tax: 40000,
        direct_cost: 80000,
        is_recurring: "no",
        status: "sent",
        notes: "Leadership training",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(example);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");
    XLSX.writeFile(wb, "aims-finance-invoice-template.xlsx");
  };

  const handleFile = async (file: File) => {
    setParsing(true);
    setResults([]);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const mapped: ParsedRow[] = rows.map((r) => ({
        invoice_number: String(r.invoice_number ?? r["Invoice #"] ?? "").trim(),
        client_name: String(r.client_name ?? r.client ?? "").trim(),
        service_line_code: String(r.service_line_code ?? r.service_line ?? "")
          .trim()
          .toUpperCase(),
        issue_date: toDate(r.issue_date ?? r.issued),
        due_date: toDate(r.due_date ?? r.due),
        currency_code:
          String(r.currency_code ?? r.currency ?? "KES")
            .trim()
            .toUpperCase() || "KES",
        subtotal: toNumber(r.subtotal ?? r.amount),
        tax: toNumber(r.tax ?? r.vat),
        direct_cost: toNumber(r.direct_cost ?? r.cost),
        is_recurring: toBool(r.is_recurring ?? r.recurring),
        status:
          String(r.status ?? "sent")
            .trim()
            .toLowerCase() || "sent",
        notes: r.notes ? String(r.notes) : undefined,
      }));
      setParsed(mapped);
      toast.success(`Parsed ${mapped.length} rows`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (parsed.length === 0) return;
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
          })),
        }),
      });

      setResults(results);
      if (errorCount === 0) {
        toast.success(`Imported ${successCount} invoices`);
        setParsed([]);
        clientsQ.refetch();
      } else {
        toast.warning(`Imported ${successCount} · Failed ${errorCount}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    }
    setImporting(false);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold">Import invoices from Excel</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Upload an .xlsx or .csv with columns:{" "}
              <span className="font-mono text-xs">
                invoice_number, client_name, service_line_code, issue_date, due_date, currency_code,
                subtotal, tax, direct_cost, is_recurring, status, notes
              </span>
              . Unknown clients are created automatically.
            </p>
          </div>
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-2" /> Download template
          </Button>
        </div>

        <div className="mt-6 border-2 border-dashed rounded-lg p-8 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
          <div className="mt-3 font-medium">{fileName || "Choose an Excel file"}</div>
          <p className="text-xs text-muted-foreground mt-1">
            .xlsx, .xls or .csv up to a few thousand rows
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={parsing}
          >
            {parsing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Select file
          </Button>
        </div>
      </div>

      {parsed.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Preview — {parsed.length} rows</h2>
              <p className="text-xs text-muted-foreground">
                Review, then confirm import. Existing invoice numbers will be updated.
              </p>
            </div>
            <Button onClick={handleImport} disabled={importing}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Import {parsed.length} rows
            </Button>
          </div>
          <div className="overflow-x-auto max-h-96 border rounded">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Rec.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.slice(0, 100).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{r.invoice_number}</TableCell>
                    <TableCell>{r.client_name}</TableCell>
                    <TableCell className="text-xs">{r.service_line_code}</TableCell>
                    <TableCell className="text-xs">{r.issue_date}</TableCell>
                    <TableCell className="text-xs">{r.due_date}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.subtotal.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.tax.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.direct_cost.toLocaleString()}
                    </TableCell>
                    <TableCell>{r.is_recurring ? "✓" : ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {parsed.length > 100 && (
              <div className="p-3 text-xs text-muted-foreground text-center border-t">
                … and {parsed.length - 100} more rows
              </div>
            )}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-4">Import results</h2>
          <div className="max-h-72 overflow-y-auto space-y-1">
            {results.map((r) => (
              <div
                key={r.row}
                className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded ${
                  r.status === "success" ? "bg-success/5" : "bg-destructive/5"
                }`}
              >
                {r.status === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                )}
                <span className="text-muted-foreground text-xs w-16 shrink-0">Row {r.row}</span>
                <span className="truncate">{r.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
