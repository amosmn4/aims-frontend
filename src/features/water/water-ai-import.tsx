import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { confirmDialog } from "@/components/confirm-dialog";
import { apiJson } from "@/lib/api-client";
import { removeWaterUpload } from "./water-upload-removal";
import { formatDateTime } from "@/lib/format-date";
import { useCanManageWater } from "./use-water";
import {
  downloadImportSource,
  useConfirmWaterImport,
  useUpdateWaterImportRow,
  useUploadWaterImport,
  useWaterImport,
  useWaterImports,
  type ImportData,
  type ImportKind,
  type ImportRow,
} from "./use-water-imports";

const KINDS: Record<ImportKind, string> = {
  reading: "Meter or household reading",
  purchase: "Payment and units purchased",
  usage: "Consumption over a date range",
  meter: "New meter registration",
  customer: "New customer registration",
  unresolved: "Needs classification",
  ignored: "Exclude with a reason",
};
const DESTINATIONS: Record<ImportKind, string> = {
  reading: "Meter readings and household balances",
  purchase: "Payments and units purchased",
  usage: "Measured consumption history",
  meter: "Meter register",
  customer: "Customer register",
  unresolved: "Awaiting a destination",
  ignored: "Retained in import history",
};
const FIELDS: Record<
  string,
  { label: string; type?: "number"; options?: string[]; hint?: string }
> = {
  meterNumber: { label: "Meter number" },
  meterType: { label: "Meter type", options: ["main", "bulk", "household"] },
  date: {
    label: "Date and time",
    hint: "YYYY-MM-DD or YYYY-MM-DDTHH:mm. Times without an offset use Nairobi time.",
  },
  dialReading: { label: "Main or bulk dial total (m³)", type: "number" },
  remainingBalance: { label: "Household units remaining", type: "number" },
  cumulativeUsage: { label: "Household lifetime units used", type: "number" },
  units: { label: "Units", type: "number" },
  amountPaid: { label: "Amount paid (KES)", type: "number" },
  periodStart: { label: "Period starts", hint: "YYYY-MM-DD or a full timestamp" },
  periodEnd: {
    label: "Period ends",
    hint: "End is exclusive. For a full month, use the first day of the following month.",
  },
  customerName: { label: "Customer name" },
  zone: { label: "Zone", hint: "Use a full path if names repeat, such as Estate / Zone A." },
  name: { label: "Meter name" },
  location: { label: "Location" },
  plotNo: { label: "Plot number" },
  phone: { label: "Phone" },
  vendingSystem: { label: "Vending system", options: ["amsol", "mpaya"] },
  mainStage: { label: "Main meter stage", options: ["borehole_to_tank", "tank_to_network"] },
  volumeUnit: { label: "Source volume unit", options: ["m3", "litres"] },
  notes: { label: "Notes or exclusion reason" },
};
const KIND_FIELDS: Record<ImportKind, string[]> = {
  reading: [
    "meterNumber",
    "date",
    "dialReading",
    "remainingBalance",
    "cumulativeUsage",
    "volumeUnit",
    "notes",
  ],
  purchase: ["meterNumber", "date", "units", "amountPaid", "customerName", "volumeUnit", "notes"],
  usage: ["meterNumber", "periodStart", "periodEnd", "units", "volumeUnit", "notes"],
  meter: [
    "meterNumber",
    "meterType",
    "mainStage",
    "name",
    "customerName",
    "zone",
    "location",
    "plotNo",
    "phone",
    "vendingSystem",
    "notes",
  ],
  customer: ["customerName", "zone", "phone", "notes"],
  unresolved: ["meterNumber", "date", "notes"],
  ignored: ["notes"],
};
const selectStyle = "h-9 w-full rounded-md border bg-background px-3 text-sm";
type Selection = { reviewToken: string; reviewReason?: string };

export function WaterAiImport() {
  const canManage = useCanManageWater();
  const picker = useRef<HTMLInputElement>(null);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [previewAccepted, setPreviewAccepted] = useState(false);
  const [selected, setSelected] = useState<Record<string, Selection>>({});
  const [busy, setBusy] = useState(false);
  const imports = useWaterImports();
  const detail = useWaterImport(selectedBatch, page, status);
  const upload = useUploadWaterImport();
  const confirm = useConfirmWaterImport(selectedBatch, detail.data?.previewToken);
  const client = useQueryClient();

  useEffect(() => {
    setPage(1);
    setSelected({});
  }, [selectedBatch, status]);
  useEffect(() => {
    setPreviewAccepted(false);
    setSelected({});
  }, [selectedBatch, detail.data?.previewToken]);
  const handleFile = async (file?: File) => {
    if (!file || !canManage) return;
    if (file.size > 25 * 1024 * 1024)
      return void toast.error("Split files larger than 25 MB before uploading.");
    try {
      const batch = await upload.mutateAsync(file);
      setSelectedBatch(batch.id);
      setStatus("");
      toast.success("File uploaded. Extraction is running; records will be saved after review.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      if (picker.current) picker.current.value = "";
    }
  };
  const confirmSelected = async () => {
    if (!previewAccepted || !detail.data?.previewToken) return;
    const entries = Object.entries(selected);
    if (!entries.length) return;
    setBusy(true);
    let processed = 0;
    try {
      for (let offset = 0; offset < entries.length; offset += 50) {
        const chunk = entries.slice(offset, offset + 50);
        const result = await confirm.mutateAsync(
          chunk.map(([id, selection]) => ({ id, ...selection })),
        );
        processed += result.processed;
        setSelected((current) => {
          const next = { ...current };
          for (const [id] of chunk) delete next[id];
          return next;
        });
      }
      toast.success(
        `${processed} reviewed records processed. Reports and meter histories are up to date.`,
      );
    } catch (error) {
      setSelected({});
      await client.invalidateQueries({ queryKey: ["water", "import", selectedBatch] });
      toast.error(
        error instanceof Error
          ? error.message
          : "Import confirmation failed. Refresh and review again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const recordReady = async () => {
    if (!selectedBatch || !previewAccepted || !detail.data?.previewToken) return;
    const approved = await confirmDialog({
      title: "Record all rows without warnings?",
      description:
        "All pages will be checked and matching records will be saved in the background. Warnings and unresolved rows stay available for your review.",
      confirmLabel: "Record validated rows",
    });
    if (!approved) return;
    setBusy(true);
    try {
      await apiJson("/water/imports/" + selectedBatch + "/confirm-ready", {
        method: "POST",
        body: JSON.stringify({ approved: true, previewToken: detail.data.previewToken }),
      });
      setSelected({});
      await client.invalidateQueries({ queryKey: ["water"] });
      toast.success(
        "Validated rows are being recorded. You can return to this import to review any exceptions.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start recording");
    } finally {
      setBusy(false);
    }
  };
  const batch = detail.data;
  const inProgress = batch && ["queued", "processing", "recording"].includes(batch.status);
  const readyRows = (batch?.rows ?? []).filter(
    (row) =>
      row.status === "pending" &&
      row.assessment &&
      row.assessment.status !== "blocked" &&
      !row.assessment.warnings.length,
  );
  const chooseBatch = (id: string) => {
    setSelectedBatch(id || null);
    setSelected({});
  };
  const deleteBatch = async () => {
    if (!selectedBatch) return;
    setBusy(true);
    try {
      const result = await removeWaterUpload("ai", selectedBatch);
      if (result) {
        setSelectedBatch(null);
        await client.invalidateQueries({ queryKey: ["water"] });
        toast.success(
          result.sourceFilePendingRemoval
            ? "Upload records removed. Source file cleanup is queued for retry."
            : "Upload and the records it created have been removed.",
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove this upload.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Import water records"
        description="Upload readings, household balances, usage, payments, or registrations. Review the matched meters and warnings before recording."
        actions={
          canManage ? (
            <Button onClick={() => picker.current?.click()} disabled={upload.isPending}>
              {upload.isPending ? "Uploading..." : "Upload a file"}
            </Button>
          ) : undefined
        }
      />
      {canManage && (
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (!upload.isPending) handleFile(event.dataTransfer.files[0]);
          }}
          className="rounded-lg border-2 border-dashed p-6 text-center"
        >
          <input
            ref={picker}
            type="file"
            aria-label="Upload water data"
            className="sr-only"
            accept=".png,.jpg,.jpeg,.webp,.pdf,.doc,.docx,.csv,.xls,.xlsx"
            onChange={(event) => handleFile(event.target.files?.[0])}
            disabled={upload.isPending}
          />
          <p className="font-medium">Drop a file here or choose a file</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Images, PDF, Word, CSV, and Excel. Up to 25 MB. Every sheet and PDF page is processed.
          </p>
          <Button
            className="mt-3"
            variant="outline"
            disabled={upload.isPending}
            onClick={() => picker.current?.click()}
          >
            Choose file
          </Button>
        </div>
      )}
      {imports.isError && (
        <LoadError what="import history" error={imports.error} onRetry={() => imports.refetch()} />
      )}
      <FormField id="water-import-batch" label="Import history">
        <select
          id="water-import-batch"
          className={selectStyle}
          value={selectedBatch ?? ""}
          onChange={(event) => chooseBatch(event.target.value)}
        >
          <option value="">Choose an import</option>
          {imports.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.fileName} · {item.status} · {formatDateTime(item.createdAt)}
            </option>
          ))}
        </select>
      </FormField>
      {detail.isLoading && selectedBatch && (
        <p role="status" className="text-sm">
          Loading import preview...
        </p>
      )}
      {detail.isError && (
        <LoadError what="import preview" error={detail.error} onRetry={() => detail.refetch()} />
      )}
      {batch && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
            <div>
              <p className="font-medium">{batch.fileName}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {batch.status} · {batch.totalRows.toLocaleString()} extracted records
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                downloadImportSource(batch.id, batch.fileName).catch((error) =>
                  toast.error(error.message),
                )
              }
            >
              Download original
            </Button>
            {canManage && (
              <Button variant="destructive" disabled={busy} onClick={deleteBatch}>
                Delete upload and its records
              </Button>
            )}
          </div>
          {inProgress && (
            <div role="status" className="rounded-lg border p-4">
              <p className="font-medium">
                {batch.status === "recording"
                  ? "Checking and recording validated rows"
                  : "Reading your file"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {batch.totalParts
                  ? `${batch.processedParts} of ${batch.totalParts} ${batch.status === "recording" ? "record checks completed" : "source parts processed"}.`
                  : "Waiting for extraction to start."}{" "}
                You can leave this page and return to the import history.
              </p>
            </div>
          )}
          {batch.status === "failed" && (
            <div
              role="alert"
              className="space-y-3 rounded-lg border border-destructive bg-destructive/5 p-4"
            >
              <p className="font-semibold text-destructive">Extraction needs attention</p>
              <p className="text-sm">{batch.error}</p>
              {canManage && (
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await apiJson(`/water/imports/${batch.id}/retry`, { method: "POST" });
                      await client.invalidateQueries({ queryKey: ["water"] });
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not retry");
                    }
                  }}
                >
                  Retry extraction
                </Button>
              )}
            </div>
          )}
          {batch.status === "review" && batch.error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive p-4 text-sm text-destructive"
            >
              Recording paused: {batch.error}. Confirmed records have been retained. Review the
              remaining rows and try again.
            </p>
          )}
          {["review", "completed"].includes(batch.status) && (
            <>
              <div className="space-y-2 rounded-lg border p-4">
                <h2 className="font-semibold">Full extraction preview</h2>
                <p className="text-sm text-muted-foreground">
                  All {batch.totalRows.toLocaleString()} extracted records are available below,
                  including clean rows and warnings. Source values and proposed destinations are
                  visible before recording. Use the page controls to inspect the complete file.
                </p>
                {batch.status === "review" && canManage && (
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      aria-label="I reviewed the complete extraction preview"
                      checked={previewAccepted}
                      onChange={(event) => setPreviewAccepted(event.target.checked)}
                      className="mt-1"
                      disabled={busy || !batch.previewToken}
                    />
                    <span>
                      I reviewed the complete extraction preview, including rows without warnings.
                      Record only the rows I confirm below.
                    </span>
                  </label>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(batch.counts).map(([label, count]) => (
                  <Badge key={label} variant="secondary">
                    {count.toLocaleString()} {label}
                  </Badge>
                ))}
              </div>
              {batch.status === "review" && canManage && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
                  <Button
                    disabled={busy || !previewAccepted || !batch.previewToken}
                    onClick={recordReady}
                  >
                    Record all rows without warnings
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Checks every page. Rows needing attention remain for individual review.
                  </p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm" htmlFor="water-import-filter">
                  Show
                </label>
                <select
                  id="water-import-filter"
                  className={`${selectStyle} w-auto`}
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="pending">Awaiting review</option>
                  <option value="">All records</option>
                  <option value="imported">Imported</option>
                  <option value="duplicate">Duplicates</option>
                  <option value="ignored">Excluded</option>
                </select>
                <Button
                  variant="outline"
                  disabled={busy || !readyRows.length || !canManage}
                  onClick={() =>
                    setSelected((current) => ({
                      ...current,
                      ...Object.fromEntries(
                        readyRows.map((row) => [
                          row.id,
                          { reviewToken: row.assessment!.reviewToken },
                        ]),
                      ),
                    }))
                  }
                >
                  Select this page without warnings
                </Button>
                <Button
                  disabled={
                    busy ||
                    !canManage ||
                    !previewAccepted ||
                    !batch.previewToken ||
                    !Object.keys(selected).length
                  }
                  onClick={confirmSelected}
                >
                  {busy
                    ? "Recording..."
                    : `Confirm ${Object.keys(selected).length} selected records`}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Rows with warnings need an explanation and explicit selection. Missing or
                conflicting data stays unresolved. Repeating a confirmation does not import a record
                twice.
              </p>
              {!batch.rows.length && (
                <p className="rounded-lg border p-6 text-sm text-muted-foreground">
                  No records in this view.
                </p>
              )}
              <div className="space-y-3">
                {batch.rows.map((row) => (
                  <ImportRowCard
                    key={`${row.id}:${row.updatedAt}`}
                    batchId={batch.id}
                    row={row}
                    disabled={busy || !canManage}
                    selection={selected[row.id]}
                    onSelect={(selection) =>
                      setSelected((current) => {
                        const next = { ...current };
                        if (selection) next[row.id] = selection;
                        else delete next[row.id];
                        return next;
                      })
                    }
                  />
                ))}
              </div>
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  disabled={page <= 1 || busy}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </Button>
                <p className="text-sm">
                  Page {page} of {Math.max(1, Math.ceil(batch.total / 50))} ·{" "}
                  {batch.total.toLocaleString()} records
                </p>
                <Button
                  variant="outline"
                  disabled={page * 50 >= batch.total || busy}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function ImportRowCard({
  batchId,
  row,
  disabled,
  selection,
  onSelect,
}: {
  batchId: string;
  row: ImportRow;
  disabled: boolean;
  selection?: Selection;
  onSelect: (selection?: Selection) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ImportData>(row.data);
  const [reason, setReason] = useState(selection?.reviewReason ?? "");
  const update = useUpdateWaterImportRow(batchId);
  const assessment = row.assessment;
  const warnings = assessment?.warnings ?? row.warnings ?? [];
  const issues = assessment?.issues ?? [];
  const canSelect =
    row.status === "pending" &&
    assessment &&
    assessment.status !== "blocked" &&
    (!warnings.length || reason.trim().length >= 5);
  const invalidSelection = selection && selection.reviewToken !== assessment?.reviewToken;
  const save = async () => {
    try {
      await update.mutateAsync({ id: row.id, data: draft });
      onSelect();
      setEditing(false);
      toast.success("Row corrected. Check the refreshed assessment.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save correction");
    }
  };
  const summary = Object.keys(row.data)
    .filter((key) => key !== "kind" && row.data[key] !== null && row.data[key] !== "")
    .map((key) => `${FIELDS[key]?.label ?? key}: ${row.data[key]}`)
    .join(" · ");
  return (
    <section
      className={`space-y-3 rounded-lg border p-4 ${issues.length || warnings.some((warning) => warning.severity === "danger") ? "border-destructive" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {row.position}. {row.source}
          </p>
          <p className="mt-1 text-sm">{DESTINATIONS[row.data.kind]}</p>
          {assessment?.meterLabel && (
            <p className="mt-1 text-sm text-muted-foreground">{assessment.meterLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={issues.length ? "destructive" : "secondary"}>
            {assessment?.status ?? row.status}
          </Badge>
          {row.status === "pending" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                aria-label={`Confirm record ${row.position}`}
                checked={!!selection && !invalidSelection}
                disabled={disabled || !canSelect}
                onChange={(event) =>
                  onSelect(
                    event.target.checked && assessment
                      ? {
                          reviewToken: assessment.reviewToken,
                          ...(warnings.length && { reviewReason: reason.trim() }),
                        }
                      : undefined,
                  )
                }
              />
              {warnings.length ? "I checked this record" : "Select"}
            </label>
          )}
        </div>
      </div>
      <p className="break-words text-sm text-muted-foreground">
        {summary || "No fields classified yet."}
      </p>
      {!!issues.length && (
        <div
          role="alert"
          className="space-y-1 rounded-md bg-destructive/5 p-3 text-sm text-destructive"
        >
          {issues.map((issue, index) => (
            <p key={index}>{issue}</p>
          ))}
        </div>
      )}
      {!!warnings.length && (
        <div
          role="alert"
          className="space-y-2 rounded-md border border-destructive bg-destructive/5 p-3"
        >
          <p className="text-sm font-semibold text-destructive">Check before recording</p>
          {warnings.map((warning, index) => (
            <p key={index} className="text-sm text-destructive">
              {warning.message}
            </p>
          ))}
          {row.status === "pending" && (
            <FormField id={`reason-${row.id}`} label="Why is this record correct?" required>
              <Input
                id={`reason-${row.id}`}
                value={reason}
                maxLength={300}
                disabled={disabled}
                placeholder="Explain what you verified"
                onChange={(event) => {
                  setReason(event.target.value);
                  onSelect();
                }}
              />
            </FormField>
          )}
        </div>
      )}
      {!!assessment?.suggestions?.length && row.status === "pending" && (
        <div className="space-y-3 rounded-md border bg-secondary/20 p-3">
          <p className="text-sm font-semibold">Suggested corrections and closest records</p>
          {assessment.suggestions.map((suggestion, index) => (
            <div key={index} className="space-y-1">
              <p className="text-sm font-medium">{suggestion.label}</p>
              <p className="text-xs text-muted-foreground">{suggestion.explanation}</p>
              <Button
                variant="outline"
                size="sm"
                disabled={disabled || update.isPending}
                onClick={async () => {
                  try {
                    await update.mutateAsync({
                      id: row.id,
                      data: { ...row.data, ...suggestion.patch },
                    });
                    onSelect();
                    toast.success(
                      "Suggestion applied to the preview. Review the updated assessment before recording.",
                    );
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Could not apply the suggestion.",
                    );
                  }
                }}
              >
                Use suggestion {index + 1}
              </Button>
            </div>
          ))}
        </div>
      )}
      {invalidSelection && (
        <p className="text-sm text-destructive">
          The assessment changed. Check this row and select it again.
        </p>
      )}
      <details open className="text-sm">
        <summary className="cursor-pointer font-medium">View source values</summary>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          {Object.entries(row.raw).map(([key, value]) => (
            <div key={key}>
              <dt className="text-xs text-muted-foreground">{key}</dt>
              <dd className="whitespace-pre-wrap break-words">
                {value === null
                  ? "Blank"
                  : typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      </details>
      {row.status === "pending" && (
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setEditing((current) => !current)}
        >
          {editing ? "Close corrections" : "Correct or classify this record"}
        </Button>
      )}
      {editing && (
        <div className="space-y-4 rounded-md border bg-secondary/20 p-4">
          <FormField id={`kind-${row.id}`} label="Record type">
            <select
              id={`kind-${row.id}`}
              className={selectStyle}
              value={draft.kind}
              onChange={(event) =>
                setDraft((current) => ({ ...current, kind: event.target.value as ImportKind }))
              }
            >
              {Object.entries(KINDS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            {KIND_FIELDS[draft.kind].map((key) => {
              const field = FIELDS[key];
              const id = `${row.id}-${key}`;
              return (
                <FormField key={key} id={id} label={field.label} hint={field.hint}>
                  {field.options ? (
                    <select
                      id={id}
                      className={selectStyle}
                      value={draft[key] ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, [key]: event.target.value || null }))
                      }
                    >
                      <option value="">Not supplied</option>
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={id}
                      type={field.type ?? "text"}
                      min={field.type === "number" ? 0 : undefined}
                      step={field.type === "number" ? "any" : undefined}
                      value={draft[key] ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          [key]:
                            event.target.value === ""
                              ? null
                              : field.type === "number"
                                ? Number(event.target.value)
                                : event.target.value,
                        }))
                      }
                    />
                  )}
                </FormField>
              );
            })}
          </div>
          <Button disabled={disabled || update.isPending} onClick={save}>
            {update.isPending ? "Saving correction..." : "Save correction and recheck"}
          </Button>
        </div>
      )}
    </section>
  );
}
