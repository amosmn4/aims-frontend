import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, type DragEvent } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react";
import {
  useCreateWaterUpload,
  useWaterUploads,
  type UsageUploadRowInput,
} from "@/features/water/use-water";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/water/upload")({
  head: () => ({ meta: [{ title: "Water Project — Upload — AIMS" }] }),
  component: WaterUploadPage,
});

function get(row: Record<string, unknown>, keys: string[]): string {
  for (const key of Object.keys(row)) {
    if (keys.includes(key.trim().toLowerCase())) return String(row[key] ?? "").trim();
  }
  return "";
}

// Looks up a column's raw parsed value (not string-coerced) — needed for the date column
// specifically, see parseDateValue below.
function getRaw(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of Object.keys(row)) {
    if (keys.includes(key.trim().toLowerCase())) return row[key];
  }
  return undefined;
}

// XLSX.read is called with `cellDates: true`, so a genuinely date-formatted cell already arrives
// as a real JS Date object — go through get()'s generic `String(value)` for that and you get
// Date.prototype.toString()'s locale/timezone-dependent human-readable form (e.g. "Sun Sep 06
// 2026 17:51:40 GMT+0300 (...)")  instead of an unambiguous one, which then has to be re-parsed
// by `new Date(thatString)` — a completely needless round trip through a fragile, ambiguous
// format when the exact instant is already sitting right there on the Date object. That's what
// was producing wrong years (e.g. 2001) instead of the date actually shown in the source file.
// Only fall back to string parsing for a column that's genuinely text (CSV import, or a
// text-formatted Excel cell) rather than a native date cell.
function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value.trim());
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function normalizeRow(row: Record<string, unknown>): UsageUploadRowInput | null {
  const meterNumber = get(row, ["meter", "meter_number", "meter no", "meter number"]);
  const customerName = get(row, ["customer", "name", "customer_name"]);
  const unitsSold = Number(get(row, ["units", "units_sold", "units sold", "consumption"]));
  const amountPaid = Number(get(row, ["amount", "payment", "amount paid", "amount_paid"]));
  const rawDateValue = getRaw(row, [
    "created at",
    "date",
    "transaction date",
    "period",
    "recorded_at",
  ]);
  const recordedAt = parseDateValue(rawDateValue);
  if (
    !meterNumber ||
    !customerName ||
    !recordedAt ||
    !Number.isFinite(unitsSold) ||
    !Number.isFinite(amountPaid)
  ) {
    return null;
  }
  return { meterNumber, customerName, unitsSold, amountPaid, recordedAt: recordedAt.toISOString() };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function WaterUploadPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [rows, setRows] = useState<UsageUploadRowInput[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const create = useCreateWaterUpload();
  const uploadsQ = useWaterUploads();
  const uploads = Array.isArray(uploadsQ.data) ? uploadsQ.data : (uploadsQ.data?.data ?? []);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setIsParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const parsed = json.map(normalizeRow);
      const valid = parsed.filter((r): r is UsageUploadRowInput => r !== null);
      if (valid.length === 0) {
        toast.error(
          "No valid rows found — check the file has Meter, Customer, Units, Amount and a date column.",
        );
        return;
      }
      setSkipped(parsed.length - valid.length);
      setRows(valid);
      setFileName(file.name);
      setFileSize(file.size);
    } catch {
      toast.error("Couldn't read that file — make sure it's a valid CSV or Excel export.");
    } finally {
      setIsParsing(false);
    }
  };

  const clearFile = () => {
    setRows(null);
    setFileName("");
    setFileSize(0);
    setSkipped(0);
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const confirmUpload = () => {
    if (!rows || rows.length === 0) return;
    create.mutate(
      { fileName, rows },
      {
        onSuccess: (result) => {
          const dupeNote =
            result.duplicatesSkipped > 0
              ? ` (${result.duplicatesSkipped} duplicate${result.duplicatesSkipped === 1 ? "" : "s"} already on file, skipped)`
              : "";
          toast.success(
            `${result.recordCount} usage record${result.recordCount === 1 ? "" : "s"} added${dupeNote}`,
          );
          clearFile();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Upload failed"),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Upload & Analytics</h1>
        <p className="text-xs text-muted-foreground">
          Upload a dated CSV/Excel export of meter purchases — matched to registered meters and
          customers by meter number, auto-registering any that aren&apos;t on file yet.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-semibold mb-3">Upload dated usage/payment file</div>

        {!rows ? (
          <label
            htmlFor="water-upload-input"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center cursor-pointer transition-colors",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-secondary/40",
            )}
          >
            {isParsing ? (
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            ) : (
              <UploadCloud
                className={cn("h-8 w-8", isDragging ? "text-primary" : "text-muted-foreground/70")}
              />
            )}
            <div className="text-sm font-medium text-foreground">
              {isParsing ? "Reading file…" : "Click to choose a file, or drag and drop it here"}
            </div>
            <p className="text-xs text-muted-foreground max-w-sm">
              Expected columns: Meter, Customer, Units, Amount, and a date column (Created At /
              Date). CSV or Excel.
            </p>
            <input
              id="water-upload-input"
              ref={fileInput}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="sr-only"
            />
          </label>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-secondary/40 px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <FileSpreadsheet className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{fileName}</div>
                <div className="text-xs text-muted-foreground">{formatFileSize(fileSize)}</div>
              </div>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={clearFile}
              title="Remove file"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {rows && (
          <div className="mt-4">
            <div className="text-xs text-muted-foreground mb-2">
              Review before confirming — parsed {rows.length} valid row
              {rows.length === 1 ? "" : "s"} from <span className="font-mono">{fileName}</span>
              {skipped > 0 &&
                ` — ${skipped} row${skipped === 1 ? "" : "s"} skipped (missing fields)`}
              . Nothing is saved until you confirm.
            </div>
            <div className="max-h-80 overflow-y-auto overflow-x-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead>Meter</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{r.meterNumber}</TableCell>
                      <TableCell className="text-xs">{r.customerName}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {r.unitsSold}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {r.amountPaid}
                      </TableCell>
                      <TableCell className="text-xs">{r.recordedAt.slice(0, 10)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex gap-2 mt-3">
              <Button onClick={confirmUpload} disabled={create.isPending}>
                {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm and add to analytics
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={clearFile}
                disabled={create.isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="p-4 pb-0 text-sm font-semibold">Upload history</div>
        {uploadsQ.isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : uploads.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">No uploads yet.</div>
        ) : (
          <div className="overflow-x-auto mt-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploads.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="text-xs">
                      {new Date(u.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{u.file_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.uploaded_by_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {u.record_count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
