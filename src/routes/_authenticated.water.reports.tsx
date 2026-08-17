import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, ArrowUpRight, Loader2 } from "lucide-react";
import { useWaterReportSummary } from "@/features/water/use-water";
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

export const Route = createFileRoute("/_authenticated/water/reports")({
  head: () => ({ meta: [{ title: "Water Project — Reports — AIMS" }] }),
  component: WaterReportsPage,
});

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

function pct(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(1)}%`;
}

function WaterReportsPage() {
  const [month, setMonth] = useState(currentMonth());
  const summaryQ = useWaterReportSummary({ month });
  const s = summaryQ.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Reports</h1>
          <p className="text-xs text-muted-foreground">Period summary, trends and per-zone loss.</p>
        </div>
        <div>
          <Label className="text-xs">Period</Label>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-9 w-40"
          />
        </div>
      </div>

      {summaryQ.isLoading || !s ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-semibold mb-2">Period summary — {s.month}</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-sm">Main meter volume drawn</TableCell>
                  <TableCell className="text-right text-sm font-mono tabular-nums">
                    {fmt(s.dashboard.main_reading_total)} units
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm">Zone bulk meters total</TableCell>
                  <TableCell className="text-right text-sm font-mono tabular-nums">
                    {fmt(s.dashboard.bulk_reading_total)} units
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm">Household billed consumption</TableCell>
                  <TableCell className="text-right text-sm font-mono tabular-nums">
                    {fmt(s.dashboard.units_sold)} units
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm">Non-revenue water (main → household)</TableCell>
                  <TableCell className="text-right text-sm">
                    <span
                      className={
                        s.dashboard.nrw_main_to_household_pct !== null &&
                        s.dashboard.nrw_main_to_household_pct > 8
                          ? "text-destructive"
                          : "text-success"
                      }
                    >
                      {pct(s.dashboard.nrw_main_to_household_pct)}
                    </span>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm">Estimated revenue</TableCell>
                  <TableCell className="text-right text-sm font-mono tabular-nums">
                    KES {fmt(s.dashboard.revenue)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-semibold mb-2">Trends and insights</div>
            {s.insights.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2">
                Not enough data yet to generate insights for this period.
              </div>
            ) : (
              <ul className="space-y-2.5">
                {s.insights.map((line, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    {i === 0 ? (
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning" />
                    ) : (
                      <ArrowUpRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                    )}
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-semibold mb-2">Zone-level loss this period</div>
            {s.zone_loss.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2">No zones registered yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zone</TableHead>
                    <TableHead>Bulk → household loss</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s.zone_loss.map((z) => (
                    <TableRow key={z.zone_id}>
                      <TableCell className="text-sm">{z.zone_name}</TableCell>
                      <TableCell className="text-sm">{pct(z.loss_pct)}</TableCell>
                      <TableCell>
                        {z.loss_pct !== null && z.loss_pct > 8 ? (
                          <Badge className="bg-destructive/15 text-destructive" variant="secondary">
                            Investigate
                          </Badge>
                        ) : (
                          <Badge className="bg-success/15 text-success" variant="secondary">
                            Normal
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
