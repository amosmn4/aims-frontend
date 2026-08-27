import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type DateRange = { from?: string; to?: string };

type Preset = "all" | "this_month" | "last_30" | "this_quarter" | "this_year" | "custom";

const PRESET_LABELS: Record<Preset, string> = {
  all: "All time",
  this_month: "This month",
  last_30: "Last 30 days",
  this_quarter: "This quarter",
  this_year: "This year",
  custom: "Custom range",
};

const PRESETS: Preset[] = ["all", "this_month", "last_30", "this_quarter", "this_year", "custom"];

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangeForPreset(preset: Preset): DateRange {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  switch (preset) {
    case "this_month":
      return {
        from: toDateOnly(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: toDateOnly(startOfDay(now)),
      };
    case "last_30": {
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      return { from: toDateOnly(from), to: toDateOnly(startOfDay(now)) };
    }
    case "this_quarter": {
      const q = Math.floor(now.getMonth() / 3);
      return {
        from: toDateOnly(new Date(now.getFullYear(), q * 3, 1)),
        to: toDateOnly(startOfDay(now)),
      };
    }
    case "this_year":
      return {
        from: toDateOnly(new Date(now.getFullYear(), 0, 1)),
        to: toDateOnly(startOfDay(now)),
      };
    case "all":
    case "custom":
      return {};
  }
}

// Reusable period filter for funnels/reports/lists: a preset dropdown (All time / This month /
// Last 30 days / This quarter / This year) that resolves to a concrete `{from, to}` range, plus
// a "Custom range" option that reveals two date inputs. Presets are computed once on selection —
// not re-derived on every render — so "This month" doesn't silently drift as the clock ticks
// past midnight mid-session.
export function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const [preset, setPreset] = useState<Preset>(value.from || value.to ? "custom" : "all");

  const handlePresetChange = (p: Preset) => {
    setPreset(p);
    onChange(p === "custom" ? value : rangeForPreset(p));
  };

  const customInputs = useMemo(() => preset === "custom", [preset]);

  return (
    <div className="flex items-center gap-2">
      <Select value={preset} onValueChange={(v) => handlePresetChange(v as Preset)}>
        <SelectTrigger className="w-40 h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((p) => (
            <SelectItem key={p} value={p}>
              {PRESET_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {customInputs && (
        <>
          <Input
            type="date"
            value={value.from ?? ""}
            onChange={(e) => onChange({ ...value, from: e.target.value || undefined })}
            className="h-9 w-36"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={value.to ?? ""}
            onChange={(e) => onChange({ ...value, to: e.target.value || undefined })}
            className="h-9 w-36"
          />
        </>
      )}
    </div>
  );
}
