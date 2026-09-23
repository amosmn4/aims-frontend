import { useState } from "react";
import { Droplets, Gauge, Loader2, Wallet } from "lucide-react";
import {
  useWaterMonthBalance,
  useWaterSettled,
  WATER_ADJUSTMENT_LABELS,
  type WaterBalance as Balance,
} from "@/features/water/use-water";
import { formatUnits } from "@/features/water/chart-periods";
import { StatTile } from "@/features/finance/stat-tile";
import { SectionHeading } from "@/components/section-heading";
import { LoadError } from "@/components/load-error";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const THIS_MONTH = "month";
const NRW_LIMIT = 8;

const WINDOWS = [
  { value: THIS_MONTH, label: "This month" },
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "12", label: "12 months" },
  { value: "24", label: "24 months" },
];

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-secondary/20 px-3 py-2">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-sm tabular-nums">{value}</div>
    </div>
  );
}

/** Released, used and bought kept as three figures, with what explains the gap. */
export function WaterBalance({ month }: { month: string }) {
  const [window, setWindow] = useState(THIS_MONTH);
  const isMonth = window === THIS_MONTH;
  const months = isMonth ? 6 : Number(window);

  const monthQ = useWaterMonthBalance({ month });
  const settledQ = useWaterSettled(months, !isMonth);
  const query = isMonth ? monthQ : settledQ;
  const b: Balance | null | undefined = isMonth ? monthQ.data : settledQ.data;

  const settled = !isMonth || !b?.provisional;
  const highLoss = b?.unaccounted_pct !== null && (b?.unaccounted_pct ?? 0) > NRW_LIMIT;
  const kinds = Object.entries(b?.adjustments_by_kind ?? {});

  return (
    <div className="rounded-lg border bg-card p-4">
      <SectionHeading
        action={
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={settled ? "" : "bg-warning/15 text-warning"}>
              {settled ? "Settled" : "Provisional"}
            </Badge>
            <Select value={window} onValueChange={setWindow}>
              <SelectTrigger className="h-8 w-32" aria-label="Period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WINDOWS.map((w) => (
                  <SelectItem key={w.value} value={w.value}>
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        Water balance
      </SectionHeading>

      {query.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
        </div>
      ) : query.isError || !b ? (
        <LoadError
          what="the water balance"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile label="Released" value={`${formatUnits(b.released)} m³`} icon={Gauge} />
            <StatTile label="Used" value={`${formatUnits(b.used)} m³`} icon={Droplets} />
            <StatTile label="Bought" value={`${formatUnits(b.bought)} m³`} icon={Wallet} />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Figure label="Into network" value={`${formatUnits(b.into_network)} m³`} />
            <Figure label="Adjustments" value={`${formatUnits(b.accounted_adjustments)} m³`} />
            <div className="rounded-md border bg-secondary/20 px-3 py-2">
              <div className="text-xs font-semibold text-muted-foreground">Unaccounted</div>
              <div
                className={`mt-0.5 font-mono text-sm tabular-nums ${
                  highLoss ? "text-destructive" : ""
                }`}
              >
                {formatUnits(b.unaccounted)} m³
                {b.unaccounted_pct !== null && ` · ${b.unaccounted_pct.toFixed(1)}%`}
              </div>
            </div>
            <Figure
              label={isMonth ? "Unused credit" : "Bought less used"}
              value={
                isMonth
                  ? b.unused_credit === null
                    ? "—"
                    : `${formatUnits(b.unused_credit)} m³`
                  : `${formatUnits(settledQ.data?.bought_less_used ?? 0)} m³`
              }
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {b.consumption_basis === "readings" ? "From readings" : "From tokens"}
            </Badge>
            {b.consumption_basis === "readings" && (
              <Badge variant="outline">
                {b.household_meters_read.toLocaleString()} meters read
              </Badge>
            )}
            {kinds.map(([kind, units]) => (
              <Badge key={kind} variant="secondary">
                {WATER_ADJUSTMENT_LABELS[kind] ?? kind} {formatUnits(units)}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
