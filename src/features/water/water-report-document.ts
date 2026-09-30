import type {
  WaterHouseholdFlagRow,
  WaterReportSummary,
  WaterTrendPoint,
} from "@/features/water/use-water";
import {
  WATER_BALANCE_FLAG_LABELS,
  WATER_METER_TYPE_LABELS,
  WATER_VERDICT_LABELS,
} from "@/features/water/use-water";
import { formatPeriodKey } from "@/features/water/water-ui";
import { zoneSetLines } from "@/features/water/zone-tree";
import { formatDate, formatDateTime } from "@/lib/format-date";
import {
  slugForFile,
  type ReportBlock,
  type ReportDocument,
} from "@/features/exports/report-document";

// Above this share of water lost, a figure is marked high (same line the dashboard uses).
const NRW_LIMIT = 8;

const units = (n: number) => Math.round(n).toLocaleString();
const pct = (n: number | null) => (n === null ? "—" : `${n.toFixed(1)}%`);
const kes = (n: number) => `KES ${Math.round(n).toLocaleString()}`;

function change(curr: number, prev: number) {
  if (prev === 0) return "—";
  const d = ((curr - prev) / prev) * 100;
  return Math.abs(d) < 0.5 ? "No change" : `${d > 0 ? "+" : ""}${d.toFixed(1)}%`;
}

// Negative means more left the tank than was pumped in: it came from stock.
const stock = (held: number | null) =>
  held === null ? "—" : held >= 0 ? units(held) : `${units(-held)} drawn from stock`;
const perMeter = (n: number | null) => (n === null ? "—" : n.toFixed(1));
// A dial not read twice has no figure; it is never shown as 0.
const volume = (f: { units: number; measured: boolean } | null) =>
  f?.measured ? units(f.units) : "Not read";
const share = (n: number | null) => (n === null ? "—" : `${n.toFixed(1)}%`);

function pointsChange(curr: number | null, prev: number | null) {
  if (curr === null || prev === null) return "—";
  const d = curr - prev;
  return Math.abs(d) < 0.05 ? "No change" : `${d > 0 ? "+" : ""}${d.toFixed(1)} points`;
}

/** The monthly Water Project report, ready to save as PDF or Word. */
export function buildWaterReportDocument({
  summary: s,
  trend,
  flags,
  preparedBy,
}: {
  summary: WaterReportSummary;
  trend: WaterTrendPoint[];
  /** Only for the current month; flags cover the last 30 days. */
  flags: WaterHouseholdFlagRow[] | null;
  preparedBy: string | null;
}): ReportDocument {
  const monthLabel = formatPeriodKey(s.month);
  const d = s.dashboard;
  const p = s.prev_dashboard;
  const nrwNote = (v: number | null) =>
    v === null ? "—" : v > NRW_LIMIT ? `${pct(v)} (high)` : pct(v);

  const blocks: ReportBlock[] = [
    { kind: "heading", text: "Key points" },
    s.insights.length > 0
      ? { kind: "bullets", items: s.insights }
      : {
          kind: "paragraph",
          text: "Not enough data yet to draw out key points for this month.",
          muted: true,
        },

    { kind: "heading", text: "The month in figures" },
    {
      kind: "table",
      columns: ["Measure", monthLabel, "Previous month", "Change"],
      numeric: [1, 2, 3],
      rows: [
        [
          "Water pumped from the borehole (m³)",
          units(d.main_reading_total),
          units(p.main_reading_total),
          change(d.main_reading_total, p.main_reading_total),
        ],
        ...(d.bulk.estate
          ? [
              [
                `Main meter volume: ${d.bulk.estate.name} bulk meter, whole estate (m³)`,
                volume(d.bulk.estate),
                volume(p.bulk.estate),
                d.bulk.estate.measured && p.bulk.estate?.measured
                  ? change(d.bulk.estate.units, p.bulk.estate.units)
                  : "—",
              ],
            ]
          : []),
        [
          `Bulk meters total${d.bulk.zones.names.length > 0 ? `: ${d.bulk.zones.names.join(" + ")}` : ""} (m³)`,
          volume(d.bulk.zones),
          volume(p.bulk.zones),
          d.bulk.zones.measured && p.bulk.zones.measured
            ? change(d.bulk.zones.units, p.bulk.zones.units)
            : "—",
        ],
        [
          "Water paid for by households (m³)",
          units(d.units_sold),
          units(p.units_sold),
          change(d.units_sold, p.units_sold),
        ],
        [
          "Water lost overall (NRW)",
          d.nrw_overall_pct === null
            ? WATER_VERDICT_LABELS[d.reconciliation.verdict]
            : nrwNote(d.nrw_overall_pct),
          pct(p.nrw_overall_pct),
          pointsChange(d.nrw_overall_pct, p.nrw_overall_pct),
        ],
        [
          "Pumped into the tank (m³)",
          units(d.tank.pumped),
          units(p.tank.pumped),
          change(d.tank.pumped, p.tank.pumped),
        ],
        [
          "Sent out of the tank (m³)",
          d.tank.outlet_measured ? units(d.tank.sent_out) : "—",
          p.tank.outlet_measured ? units(p.tank.sent_out) : "—",
          d.tank.outlet_measured && p.tank.outlet_measured
            ? change(d.tank.sent_out, p.tank.sent_out)
            : "—",
        ],
        ["Still in the tank (m³)", stock(d.tank.held), stock(p.tank.held), "—"],
        [
          "Lost between tank and households",
          nrwNote(d.nrw_tank_to_network_pct),
          pct(p.nrw_tank_to_network_pct),
          pointsChange(d.nrw_tank_to_network_pct, p.nrw_tank_to_network_pct),
        ],
        ["Revenue", kes(d.revenue), kes(p.revenue), change(d.revenue, p.revenue)],
        [
          "Households buying water",
          d.active_households.toLocaleString(),
          p.active_households.toLocaleString(),
          change(d.active_households, p.active_households),
        ],
      ],
    },

    { kind: "heading", text: "Water loss by zone" },
    {
      kind: "paragraph",
      text: "A zone with zones inside it is shown twice: the whole zone, then the zone only. The zone only is its bulk meter less the bulk meters inside it, set against its own household meters. Household meter counts never include bulk meters.",
      muted: true,
    },
    {
      kind: "table",
      columns: [
        "Zone",
        "Household meters",
        "Through the meter (m³)",
        "Households (m³)",
        "Gap (m³)",
        "Gap %",
        "Verdict",
      ],
      numeric: [1, 2, 3, 4, 5],
      emptyText: "No zone figures for this month.",
      rows: zoneSetLines(s.zone_loss).map((z) => {
        const showGap = z.measured && z.gap >= 0;
        return [
          `${"↳ ".repeat(z.depth)}${z.name}${z.kind === "whole" ? " (with the zones inside it)" : ""}`,
          z.meters.toLocaleString(),
          z.measured ? units(z.passed) : "—",
          units(z.households),
          showGap ? units(z.gap) : "—",
          showGap ? pct(z.gap_pct) : "—",
          !z.has_bulk_meter
            ? "No bulk meter"
            : `${WATER_VERDICT_LABELS[z.verdict]}${z.gap < 0 ? `: ${units(-z.gap)} m³` : ""}`,
        ];
      }),
    },

    { kind: "heading", text: "Zone usage by meters and spend" },
    {
      kind: "paragraph",
      text: "Water paid for in each zone, set against how many meters the zone has and what they spent.",
      muted: true,
    },
    {
      kind: "table",
      columns: [
        "Zone",
        "Meters in use",
        "Water (m³)",
        "Spend",
        "m³ per meter",
        "Spend per meter",
        "Share of water",
        "Share of meters",
      ],
      numeric: [1, 2, 3, 4, 5, 6, 7],
      emptyText: "No household water paid for this month.",
      rows: s.zone_usage.map((z) => [
        `${"↳ ".repeat(z.depth)}${z.zone_name}${z.includes_sub_zones ? " (with the zones inside it)" : ""}`,
        z.active_meters.toLocaleString(),
        units(z.units),
        kes(z.revenue),
        perMeter(z.units_per_meter),
        z.revenue_per_meter === null ? "—" : kes(z.revenue_per_meter),
        share(z.units_share_pct),
        share(z.meter_share_pct),
      ]),
    },

    { kind: "heading", text: "Highest usage" },
    {
      kind: "paragraph",
      text:
        s.typical_household_units === null
          ? "The meters that paid for the most water this month."
          : `The meters that paid for the most water this month. A typical household paid for ${units(s.typical_household_units)} m³.`,
      muted: true,
    },
    {
      kind: "table",
      columns: ["Meter", "Customer", "Plot", "Zone", "Water (m³)", "Spend", "Against typical"],
      numeric: [4, 5, 6],
      emptyText: "No household water paid for this month.",
      rows: s.high_usage.map((h) => [
        h.meter_number,
        h.customer_name ?? "—",
        h.plot_no ?? "—",
        h.zone_name ?? "—",
        units(h.units),
        kes(h.amount),
        h.times_typical === null ? "—" : `${h.times_typical.toFixed(1)} times`,
      ]),
    },

    { kind: "heading", text: "Meters in use" },
    {
      kind: "table",
      columns: ["Meter type", "In use", "Out of use", "Total"],
      numeric: [1, 2, 3],
      rows: (["main", "bulk", "household"] as const).map((type) => {
        const c = d.meter_status[type];
        return [
          WATER_METER_TYPE_LABELS[type],
          c.active.toLocaleString(),
          c.inactive.toLocaleString(),
          (c.active + c.inactive).toLocaleString(),
        ];
      }),
    },
    {
      kind: "paragraph",
      text: "Meters out of use are replaced or removed. Their past readings and sales still count in the months they happened.",
      muted: true,
    },

    { kind: "heading", text: "The last six months" },
    {
      kind: "table",
      columns: ["Month", "Borehole (m³)", "Estate bulk meter (m³)", "Households (m³)"],
      numeric: [1, 2, 3],
      emptyText: "No readings recorded yet.",
      rows: trend.map((t) => [
        formatPeriodKey(t.month),
        units(t.main_total),
        units(t.bulk_total),
        units(t.household_total),
      ]),
    },
  ];

  if (flags) {
    blocks.push(
      { kind: "heading", text: "Households to check" },
      {
        kind: "paragraph",
        text: "From household meter balances in the last 30 days. A flag is a reason to look, not proof.",
        muted: true,
      },
      {
        kind: "table",
        columns: ["Meter", "Customer", "Zone", "Check", "Period", "Used per day"],
        numeric: [5],
        emptyText: "No household needs checking.",
        rows: flags.map((f) => [
          f.meter_number,
          f.customer_name ?? "—",
          f.zone_name ?? "—",
          WATER_BALANCE_FLAG_LABELS[f.flag],
          `${formatDate(f.period.from)} – ${formatDate(f.period.to)}`,
          f.period.per_day == null ? "—" : f.period.per_day.toFixed(2),
        ]),
      },
    );
  }

  blocks.push(
    { kind: "heading", text: "Terms used" },
    {
      kind: "bullets",
      items: [
        "m³: cubic metre, 1,000 litres. One unit on a prepaid meter.",
        `NRW (non-revenue water): water that left the borehole but was not paid for. Above ${NRW_LIMIT}% is marked high.`,
        "Bulk meter: measures everything that goes into one zone.",
      ],
    },
  );

  return {
    title: "Water Project report",
    subtitle: `Monthly report · ${monthLabel}`,
    meta: [
      ...(preparedBy ? [`Prepared by ${preparedBy}`] : []),
      `Generated ${formatDateTime(new Date())}`,
    ],
    blocks,
    fileName: slugForFile(`water-report-${monthLabel}`),
  };
}
