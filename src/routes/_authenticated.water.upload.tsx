import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { AlertTriangle, FileSpreadsheet, Loader2, Search, UploadCloud, X } from "lucide-react";
import {
  useCreateWaterUpload,
  useDeleteWaterUpload,
  useWaterMeterNumbers,
  useWaterUploads,
  useCanManageWater,
  type WaterUsageUploadRow,
} from "@/features/water/use-water";
import { MAX_UPLOAD_ROWS, parseUsageFile, type ParsedUsageFile } from "@/features/water/usage-file";
import { ListEmpty, ListNoMatches, WithTerm } from "@/features/water/water-ui";
import { RowActions } from "@/components/row-actions";
import { confirmDeleteUpload, deleteErrorToast } from "@/features/water/water-delete";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/pagination-bar";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const PREVIEW_ROWS = 200;
const FORMAT_LABELS: Record<ParsedUsageFile["format"], string> = {
  mpaya: "mPaya payments export",
  amsol: "Amsol usage CSV",
  other: "Usage file",
};

const plural = (n: number, noun: string) => `${n.toLocaleString()} ${noun}${n === 1 ? "" : "s"}`;
const kes = (n: number) => `KES ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPeriod(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const from = formatDate(start);
  const to = formatDate(end);
  return from === to ? from : `${from} – ${to}`;
}

function WaterUploadPage() {
  const canManage = useCanManageWater();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [parsed, setParsed] = useState<ParsedUsageFile | null>(null);
  const [parseError, setParseError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const create = useCreateWaterUpload();
  const meterNumbersQ = useWaterMeterNumbers(!!parsed);

  const openPicker = () => fileInput.current?.click();

  const newMeters = useMemo(() => {
    if (!parsed || !meterNumbersQ.data) return [];
    const known = meterNumbersQ.data;
    return [...new Set(parsed.rows.map((r) => r.meterNumber))].filter((n) => !known.has(n)).sort();
  }, [parsed, meterNumbersQ.data]);
  const newMeterSet = useMemo(() => new Set(newMeters), [newMeters]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setIsParsing(true);
    setParseError("");
    try {
      const result = parseUsageFile(await file.arrayBuffer(), file.name);
      if (result.rows.length === 0) {
        setParsed(null);
        setParseError(
          `No payments found in ${file.name}. The file needs Meter, Amount and a Date (or Created At) column, with one payment per row.`,
        );
        return;
      }
      setParsed(result);
      setFileName(file.name);
      setFileSize(file.size);
    } catch {
      setParsed(null);
      setParseError(`Couldn't read ${file.name}. Make sure it is a CSV or Excel file.`);
    } finally {
      setIsParsing(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const clearFile = () => {
    setParsed(null);
    setFileName("");
    setFileSize(0);
    setParseError("");
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const tooMany = !!parsed && parsed.rows.length > MAX_UPLOAD_ROWS;
  const canConfirm =
    !!parsed && !tooMany && meterNumbersQ.isSuccess && !create.isPending && !isParsing;

  const confirmUpload = () => {
    if (!parsed || !canConfirm) return;
    create.mutate(
      {
        fileName,
        rows: parsed.rows,
        vendingSystem:
          parsed.format === "mpaya" ? "mpaya" : parsed.format === "amsol" ? "amsol" : undefined,
      },
      {
        onSuccess: (result) => {
          const dupeNote =
            result.duplicatesSkipped > 0
              ? ` (${plural(result.duplicatesSkipped, "duplicate")} already on file, skipped)`
              : "";
          toast.success(`${plural(result.recordCount, "payment")} added${dupeNote}`);
          const inactive = result.inactiveMeterNumbers ?? [];
          if (inactive.length > 0) {
            toast.warning(
              `${inactive.length} meter${inactive.length === 1 ? " is" : "s are"} marked inactive but had sales in this file: ${inactive.slice(0, 5).join(", ")}${inactive.length > 5 ? "…" : ""}. Check whether they are back in use.`,
              { duration: 12000 },
            );
          }
          clearFile();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Upload failed"),
      },
    );
  };

  const skipped = parsed
    ? parsed.skippedTotalRows + parsed.skippedBlankRows + parsed.skippedInvalidRows
    : 0;
  const dates = parsed?.rows.map((r) => r.recordedAt).sort() ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Upload usage file"
        description="Add meter payments from an Amsol or mPaya export so usage and revenue figures stay up to date."
        actions={
          canManage ? (
            <Button size="sm" onClick={openPicker} disabled={isParsing || create.isPending}>
              <UploadCloud className="h-4 w-4 mr-1" /> Upload usage file
            </Button>
          ) : undefined
        }
      />
      {!canManage && <ViewOnlyBanner area="the Water Project" action="upload usage files" />}

      {canManage && (
        <div className="rounded-lg border bg-card p-4">
          <input
            id="water-upload-input"
            ref={fileInput}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />

          {!parsed ? (
            <>
              <label
                htmlFor="water-upload-input"
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-secondary/40",
                )}
              >
                {isParsing ? (
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                ) : (
                  <UploadCloud
                    className={cn(
                      "h-8 w-8",
                      isDragging ? "text-primary" : "text-muted-foreground/70",
                    )}
                    aria-hidden="true"
                  />
                )}
                <div className="text-sm font-medium text-foreground">
                  {isParsing ? "Reading file…" : "Choose a file, or drag and drop it here"}
                </div>
                <p className="text-xs text-muted-foreground">
                  CSV or Excel. Nothing is saved until you check the preview and confirm.
                </p>
              </label>
              {parseError && (
                <p role="alert" className="mt-2 text-xs text-destructive">
                  {parseError}
                </p>
              )}
              <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div className="rounded-md border p-2.5">
                  <div className="font-medium text-foreground">mPaya payments export</div>
                  Columns: Date, Customer, Meter, Amount, Units. The TOTAL row is skipped.
                </div>
                <div className="rounded-md border p-2.5">
                  <div className="font-medium text-foreground">Amsol usage CSV</div>
                  Columns: Meter, Customer, Amount, Units, Created At.
                </div>
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                <WithTerm term="units">Units</WithTerm>
                <WithTerm term="vending">Vending system</WithTerm>
              </p>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-secondary/40 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileSpreadsheet className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{fileName}</div>
                  <div className="text-xs text-muted-foreground">
                    {FORMAT_LABELS[parsed.format]} · {formatFileSize(fileSize)}
                  </div>
                </div>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={clearFile}
                disabled={create.isPending}
                aria-label={`Remove file ${fileName}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {parsed && (
            <div className="mt-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Check these figures against the file before confirming. Nothing is saved yet.
              </p>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Payments to add" value={parsed.rows.length.toLocaleString()} />
                <Stat
                  label="File's total amount"
                  value={kes(parsed.totalAmount)}
                  note={
                    parsed.fileTotal === null
                      ? undefined
                      : Math.abs(parsed.fileTotal - parsed.totalAmount) < 0.01
                        ? "Matches the file's TOTAL row"
                        : `File's TOTAL row says ${kes(parsed.fileTotal)}`
                  }
                  warn={
                    parsed.fileTotal !== null &&
                    Math.abs(parsed.fileTotal - parsed.totalAmount) >= 0.01
                  }
                />
                <Stat
                  label="Rows with no units"
                  value={parsed.unitsMissing.toLocaleString()}
                  note={parsed.unitsMissing > 0 ? "Imported as 0 m³" : undefined}
                  warn={parsed.unitsMissing > 0}
                />
                <Stat
                  label="Rows skipped"
                  value={skipped.toLocaleString()}
                  note={
                    skipped > 0
                      ? [
                          parsed.skippedTotalRows > 0 && `${parsed.skippedTotalRows} TOTAL`,
                          parsed.skippedBlankRows > 0 && `${parsed.skippedBlankRows} blank`,
                          parsed.skippedInvalidRows > 0 &&
                            `${parsed.skippedInvalidRows} unreadable`,
                        ]
                          .filter(Boolean)
                          .join(", ")
                      : undefined
                  }
                />
              </div>
              {dates.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Payments from {formatDateTime(dates[0])} to{" "}
                  {formatDateTime(dates[dates.length - 1])}.
                </p>
              )}

              <div className="rounded-md border p-3">
                {meterNumbersQ.isLoading ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking which meters are
                    already registered…
                  </p>
                ) : meterNumbersQ.isError ? (
                  <LoadError
                    what="the meter list to check this file against"
                    error={meterNumbersQ.error}
                    onRetry={() => meterNumbersQ.refetch()}
                  />
                ) : newMeters.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Every meter number in this file is already registered.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
                      New meters that will be created ({newMeters.length.toLocaleString()})
                    </div>
                    <p className="text-xs text-muted-foreground">
                      These meter numbers aren&apos;t registered yet. Check them for typos — each
                      one becomes a new household meter.
                      {parsed.format === "mpaya" && " They'll be set to the mPaya vending system."}
                    </p>
                    <ul className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                      {newMeters.map((n) => (
                        <li
                          key={n}
                          className="rounded border bg-secondary/40 px-1.5 py-0.5 font-mono text-xs"
                        >
                          {n}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {tooMany && (
                <p role="alert" className="text-xs text-destructive">
                  This file has {parsed.rows.length.toLocaleString()} payments. Upload at most{" "}
                  {MAX_UPLOAD_ROWS.toLocaleString()} at a time — split the file by month and upload
                  each part.
                </p>
              )}

              <div>
                <div className="text-xs text-muted-foreground mb-2">
                  {parsed.rows.length > PREVIEW_ROWS
                    ? `Showing the first ${PREVIEW_ROWS} of ${parsed.rows.length.toLocaleString()} payments.`
                    : `All ${plural(parsed.rows.length, "payment")}.`}
                </div>
                <div className="max-h-80 overflow-y-auto overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead>Date & time</TableHead>
                        <TableHead>Meter</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Units (m³)</TableHead>
                        <TableHead className="text-right">Amount (KES)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsed.rows.slice(0, PREVIEW_ROWS).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {formatDateTime(r.recordedAt)}
                          </TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {r.meterNumber}
                            {newMeterSet.has(r.meterNumber) && (
                              <Badge
                                variant="secondary"
                                className="ml-1.5 bg-warning/15 text-warning font-sans"
                              >
                                New
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{r.customerName}</TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {r.unitsSold}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {r.amountPaid.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={confirmUpload} disabled={!canConfirm}>
                  {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add {plural(parsed.rows.length, "payment")}
                  {newMeters.length > 0 ? ` and ${plural(newMeters.length, "new meter")}` : ""}
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
      )}

      <UploadHistory canManage={canManage} onUpload={openPicker} />
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  warn,
}: {
  label: string;
  value: string;
  note?: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
      {note && (
        <div className={cn("text-xs", warn ? "text-warning" : "text-muted-foreground")}>{note}</div>
      )}
    </div>
  );
}

function UploadHistory({ canManage, onUpload }: { canManage: boolean; onUpload: () => void }) {
  const [q, setQ] = useState("");
  const [month, setMonth] = useState("");
  const { page, pageSize, setPage, setPageSize } = usePagination(25);
  const uploadsQ = useWaterUploads(
    { q: q.trim() || undefined, month: month || undefined },
    { page, pageSize },
  );
  const deleteUpload = useDeleteWaterUpload();

  const result = uploadsQ.data;
  const uploads = result ? (Array.isArray(result) ? result : result.data) : [];
  const total = result && !Array.isArray(result) ? result.total : uploads.length;
  const hasFilters = !!q.trim() || !!month;

  const clearFilters = () => {
    setQ("");
    setMonth("");
    setPage(1);
  };

  const handleDelete = async (u: WaterUsageUploadRow) => {
    if (!(await confirmDeleteUpload(u))) return;
    deleteUpload.mutate(u.id, {
      onSuccess: (res) =>
        toast.success(`Upload deleted — ${plural(res.recordsDeleted, "usage record")} removed`),
      onError: deleteErrorToast,
    });
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="p-4 pb-0 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Upload history</div>
          <p className="text-xs text-muted-foreground">
            Files already added. Delete one to remove its payments, then upload a corrected file.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search file name…"
              aria-label="Search uploads by file name"
              className="h-9 pl-7"
            />
          </div>
          <Input
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setPage(1);
            }}
            aria-label="Show uploads with payments from this month"
            className="h-9 w-40"
          />
        </div>
      </div>
      {uploadsQ.isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : uploadsQ.isError ? (
        <LoadError
          what="upload history"
          error={uploadsQ.error}
          onRetry={() => uploadsQ.refetch()}
          className="m-4"
        />
      ) : uploads.length === 0 ? (
        hasFilters ? (
          <ListNoMatches onClear={clearFilters} />
        ) : (
          <ListEmpty
            message="No uploads yet"
            action={
              canManage ? (
                <Button size="sm" onClick={onUpload}>
                  <UploadCloud className="h-4 w-4 mr-1" /> Upload usage file
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          <div className="overflow-x-auto mt-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Payments dated</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead className="text-right">Records</TableHead>
                  {canManage && (
                    <TableHead className="w-14">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploads.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDateTime(u.created_at)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{u.file_name}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatPeriod(u.period_start, u.period_end)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.uploaded_by_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {u.record_count.toLocaleString()}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <RowActions
                          label={`upload ${u.file_name}`}
                          onDelete={() => handleDelete(u)}
                          disabled={deleteUpload.isPending}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}
    </div>
  );
}
