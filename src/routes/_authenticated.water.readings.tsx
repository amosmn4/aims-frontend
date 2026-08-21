import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { confirmDialog } from "@/components/confirm-dialog";
import {
  useWaterReadings,
  useLogWaterReading,
  useDeleteWaterReading,
  useWaterMeters,
  WATER_METER_TYPE_LABELS,
} from "@/features/water/use-water";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/pagination-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/water/readings")({
  head: () => ({ meta: [{ title: "Water Project — Readings — AIMS" }] }),
  component: WaterReadingsPage,
});

function WaterReadingsPage() {
  const { page, pageSize, setPage, setPageSize } = usePagination(25);
  const chartReadingsQ = useWaterReadings();
  const pagedReadingsQ = useWaterReadings({}, { page, pageSize });
  const deleteReading = useDeleteWaterReading();

  const chartReadings = chartReadingsQ.data ?? [];
  const pagedResult = pagedReadingsQ.data;
  const readings = pagedResult ? (Array.isArray(pagedResult) ? pagedResult : pagedResult.data) : [];
  const total = pagedResult && !Array.isArray(pagedResult) ? pagedResult.total : readings.length;

  // Group into one row per date, one column per meter, for the reading history chart —
  // mirrors the reference dashboard's main/zone-bulk comparison table.
  const byMeter = new Map<string, { number: string; type: string }>();
  for (const r of chartReadings)
    byMeter.set(r.meter_id, { number: r.meter_number, type: r.meter_type });
  const meterIds = [...byMeter.keys()];

  const dates = [...new Set(chartReadings.map((r) => r.reading_date.slice(0, 10)))].sort();
  const chartData = dates.map((date) => {
    const row: Record<string, string | number> = { date };
    for (const id of meterIds) {
      const match = chartReadings.find(
        (r) => r.meter_id === id && r.reading_date.slice(0, 10) === date,
      );
      if (match) row[byMeter.get(id)!.number] = match.value;
    }
    return row;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Bulk & Main Readings</h1>
        <p className="text-xs text-muted-foreground">
          Dial readings for the borehole / main meter and each zone&apos;s bulk meter.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">Capture a new reading</div>
        </div>
        <LogReadingForm />
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-semibold mb-2">Reading history</div>
        {chartReadingsQ.isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">
            No readings logged yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {meterIds.map((id, i) => (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={byMeter.get(id)!.number}
                  stroke={["#0F7A78", "#B9762A", "#D4953F", "#8C5A1E", "#2E9E4F"][i % 5]}
                  strokeWidth={2}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="p-4 pb-0 text-sm font-semibold">Raw readings</div>
        {pagedReadingsQ.isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : readings.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">No readings yet.</div>
        ) : (
          <div className="overflow-x-auto mt-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & time</TableHead>
                  <TableHead>Meter</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-14" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {readings.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">
                      {new Date(r.reading_date).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.meter_number}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{WATER_METER_TYPE_LABELS[r.meter_type]}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {r.value.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.notes ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          const ok = await confirmDialog({
                            title: "Remove this reading?",
                            confirmLabel: "Remove",
                            destructive: true,
                            description: "This can't be undone.",
                          });
                          if (!ok) return;
                          deleteReading.mutate(r.id, {
                            onError: (err) =>
                              toast.error(err instanceof Error ? err.message : "Failed to delete"),
                          });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationBar
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function LogReadingForm() {
  const metersQ = useWaterMeters();
  const logReading = useLogWaterReading();
  const [meterId, setMeterId] = useState("");
  const [readingDate, setReadingDate] = useState(new Date().toISOString().slice(0, 16));
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");

  const meterList = metersQ.data ?? [];
  const mainAndBulkMeters = meterList.filter((m) => m.meter_type !== "household");

  const submit = () => {
    if (!meterId || !value) {
      toast.error("Meter and reading value are required");
      return;
    }
    logReading.mutate(
      { meterId, readingDate, value: Number(value), notes: notes || undefined },
      {
        onSuccess: () => {
          toast.success("Reading logged");
          setValue("");
          setNotes("");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to log reading"),
      },
    );
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-45 flex-1">
        <Label>Meter</Label>
        <Select value={meterId} onValueChange={setMeterId}>
          <SelectTrigger>
            <SelectValue placeholder="Select meter…" />
          </SelectTrigger>
          <SelectContent>
            {mainAndBulkMeters.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.meter_number} — {WATER_METER_TYPE_LABELS[m.meter_type]}
                {m.zone_name ? ` (${m.zone_name})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-48">
        <Label>Reading date & time</Label>
        <Input
          type="datetime-local"
          value={readingDate}
          onChange={(e) => setReadingDate(e.target.value)}
        />
      </div>
      <div className="w-36">
        <Label>Reading value</Label>
        <Input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 1420"
        />
      </div>
      <div className="min-w-40 flex-1">
        <Label>Notes (optional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button onClick={submit} disabled={logReading.isPending}>
        {logReading.isPending ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Plus className="h-4 w-4 mr-1" />
        )}
        Log reading
      </Button>
    </div>
  );
}
