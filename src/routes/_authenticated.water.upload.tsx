import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Loader2, UploadCloud } from "lucide-react";
import {
  useCreateWaterUpload,
  useWaterUploads,
  type UsageUploadRowInput,
} from "@/features/water/use-water";
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

function normalizeRow(row: Record<string, unknown>): UsageUploadRowInput | null {
  const meterNumber = get(row, ["meter", "meter_number", "meter no", "meter number"]);
  const customerName = get(row, ["customer", "name", "customer_name"]);
  const unitsSold = Number(get(row, ["units", "units_sold", "units sold", "consumption"]));
  const amountPaid = Number(get(row, ["amount", "payment", "amount paid", "amount_paid"]));
  const rawDate = get(row, ["created at", "date", "transaction date", "period", "recorded_at"]);
  if (
    !meterNumber ||
    !customerName ||
    !rawDate ||
    !Number.isFinite(unitsSold) ||
    !Number.isFinite(amountPaid)
  ) {
    return null;
  }
  const recordedAt = new Date(rawDate);
  if (Number.isNaN(recordedAt.getTime())) return null;
  return { meterNumber, customerName, unitsSold, amountPaid, recordedAt: recordedAt.toISOString() };
}

function WaterUploadPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<UsageUploadRowInput[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const create = useCreateWaterUpload();
  const uploadsQ = useWaterUploads();
  const uploads = Array.isArray(uploadsQ.data) ? uploadsQ.data : (uploadsQ.data?.data ?? []);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    const parsed = json.map(normalizeRow);
    const valid = parsed.filter((r): r is UsageUploadRowInput => r !== null);
    setSkipped(parsed.length - valid.length);
    setRows(valid);
    setFileName(file.name);
  };

  const confirmUpload = () => {
    if (!rows || rows.length === 0) return;
    create.mutate(
      { fileName, rows },
      {
        onSuccess: () => {
          toast.success(`${rows.length} usage records added`);
          setRows(null);
          setFileName("");
          if (fileInput.current) fileInput.current.value = "";
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
        <div className="rounded-lg border border-dashed p-6 text-center">
          <UploadCloud className="h-6 w-6 mx-auto text-muted-foreground opacity-60" />
          <p className="text-xs text-muted-foreground mt-2 mb-3">
            Expected columns: Meter, Customer, Units, Amount, and a date column (Created At / Date).
            CSV or Excel.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="text-xs mx-auto"
          />
        </div>

        {rows && (
          <div className="mt-4">
            <div className="text-xs text-muted-foreground mb-2">
              Parsed {rows.length} valid row{rows.length === 1 ? "" : "s"} from{" "}
              <span className="font-mono">{fileName}</span>
              {skipped > 0 &&
                ` — ${skipped} row${skipped === 1 ? "" : "s"} skipped (missing fields)`}
              .
            </div>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Meter</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 8).map((r, i) => (
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
              {rows.length > 8 && (
                <div className="text-xs text-muted-foreground text-center py-2 border-t">
                  + {rows.length - 8} more row{rows.length - 8 === 1 ? "" : "s"}
                </div>
              )}
            </div>
            <Button className="mt-3" onClick={confirmUpload} disabled={create.isPending}>
              {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm and add to analytics
            </Button>
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
