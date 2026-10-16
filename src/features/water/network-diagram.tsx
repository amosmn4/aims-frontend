import { useMemo, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  mainStageFromName,
  useWaterAllZones,
  useWaterMeters,
  WATER_MAIN_STAGE_LABELS,
  type WaterMainStage,
  type WaterMeterRow,
  type WaterZoneTreeNode,
} from "@/features/water/use-water";
import { ZONE_COLORS } from "@/features/water/chart-periods";
import { SectionHeading } from "@/components/section-heading";
import { LoadError } from "@/components/load-error";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ZoneNode extends WaterZoneTreeNode {
  children: ZoneNode[];
  bulk: WaterMeterRow[];
  households: number;
  inactive: number;
  tint: string;
}

function stageOf(m: WaterMeterRow): WaterMainStage | null {
  return m.main_stage ?? mainStageFromName(m.name);
}

/** Depth-first, alphabetical, with each zone's meters already attached. */
function buildTree(zones: WaterZoneTreeNode[], meters: WaterMeterRow[]): ZoneNode[] {
  const bulkByZone = new Map<string, WaterMeterRow[]>();
  const counts = new Map<string, { active: number; inactive: number }>();
  for (const m of meters) {
    if (!m.zone_id) continue;
    if (m.meter_type === "bulk") {
      bulkByZone.set(m.zone_id, [...(bulkByZone.get(m.zone_id) ?? []), m]);
    } else if (m.meter_type === "household") {
      const at = counts.get(m.zone_id) ?? { active: 0, inactive: 0 };
      if (m.is_active) at.active += 1;
      else at.inactive += 1;
      counts.set(m.zone_id, at);
    }
  }
  const known = new Set(zones.map((z) => z.id));
  const childrenOf = new Map<string, WaterZoneTreeNode[]>();
  const roots: WaterZoneTreeNode[] = [];
  for (const z of zones) {
    const parent = z.parent_zone_id;
    if (parent && known.has(parent)) {
      childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), z]);
    } else {
      roots.push(z);
    }
  }
  let tint = 0;
  const walk = (list: WaterZoneTreeNode[]): ZoneNode[] =>
    [...list]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((z) => {
        const at = counts.get(z.id) ?? { active: 0, inactive: 0 };
        return {
          ...z,
          children: walk(childrenOf.get(z.id) ?? []),
          bulk: bulkByZone.get(z.id) ?? [],
          households: at.active,
          inactive: at.inactive,
          tint: ZONE_COLORS[tint++ % ZONE_COLORS.length],
        };
      });
  return walk(roots);
}

function Pipe() {
  return <span className="ml-6 block h-4 w-px bg-border" aria-hidden="true" />;
}

function Node({
  tag,
  name,
  number,
  tint,
  dashed,
  extra,
}: {
  tag?: string;
  name: string;
  number?: string;
  tint?: string;
  dashed?: boolean;
  extra?: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-2 rounded-md border px-3 py-1.5",
        dashed ? "border-dashed bg-transparent" : "bg-secondary/30",
      )}
      style={tint ? { borderLeft: `3px solid ${tint}` } : undefined}
    >
      {tag && (
        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-primary">
          {tag}
        </span>
      )}
      <span className={cn("truncate text-sm", dashed ? "text-muted-foreground" : "font-semibold")}>
        {name}
      </span>
      {number && <span className="font-mono text-xs text-muted-foreground">{number}</span>}
      {extra}
    </span>
  );
}

function MeterCount({ active, inactive }: { active: number; inactive: number }) {
  return (
    <span className="block pl-6 pt-1 font-mono text-xs text-muted-foreground">
      └ {active.toLocaleString()} meters
      {inactive > 0 && ` · ${inactive.toLocaleString()} inactive`}
    </span>
  );
}

function Branch({ zones }: { zones: ZoneNode[] }) {
  return (
    <div className="ml-6 border-l border-border">
      {zones.map((z) => (
        <div key={z.id} className="pl-0">
          <div className="flex items-center pt-3">
            <span className="h-px w-5 shrink-0 bg-border" aria-hidden="true" />
            <Node
              tag={z.bulk.length > 0 ? "Bulk" : undefined}
              name={z.name}
              number={z.bulk.map((m) => m.meter_number).join(", ") || undefined}
              tint={z.tint}
              extra={
                z.bulk.length === 0 ? (
                  <Badge variant="secondary" className="bg-warning/15 text-warning">
                    No bulk meter
                  </Badge>
                ) : undefined
              }
            />
          </div>
          <div className="pl-5">
            <MeterCount active={z.households} inactive={z.inactive} />
            {z.children.length > 0 && <Branch zones={z.children} />}
          </div>
        </div>
      ))}
    </div>
  );
}

/** The borehole, the tanks and every zone beneath them, drawn from the live records. */
export function NetworkDiagram() {
  const zonesQ = useWaterAllZones();
  const metersQ = useWaterMeters();

  const model = useMemo(() => {
    const meters = metersQ.data ?? [];
    const mains = meters.filter((m) => m.meter_type === "main");
    const mainLine = meters.filter((m) => m.meter_type === "household" && !m.zone_id);
    return {
      borehole: mains.find((m) => stageOf(m) === "borehole_to_tank") ?? null,
      network: mains.find((m) => stageOf(m) === "tank_to_network") ?? null,
      tree: buildTree(zonesQ.data ?? [], meters),
      mainLineActive: mainLine.filter((m) => m.is_active).length,
      mainLineInactive: mainLine.filter((m) => !m.is_active).length,
    };
  }, [zonesQ.data, metersQ.data]);

  const isLoading = zonesQ.isLoading || metersQ.isLoading;
  const isError = zonesQ.isError || metersQ.isError;

  return (
    <div className="rounded-lg border bg-card p-4">
      <SectionHeading>The network</SectionHeading>
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
        </div>
      ) : isError ? (
        <LoadError
          what="the network"
          error={zonesQ.error ?? metersQ.error}
          onRetry={() => {
            void zonesQ.refetch();
            void metersQ.refetch();
          }}
        />
      ) : (
        <div className="overflow-x-auto">
          <div className="flex flex-col items-start">
            <Node name="Borehole" dashed />
            <Pipe />
            <Node
              tag="Main 1"
              name={model.borehole?.name ?? WATER_MAIN_STAGE_LABELS.borehole_to_tank}
              number={model.borehole?.meter_number}
              extra={
                model.borehole ? undefined : (
                  <Badge variant="secondary" className="bg-warning/15 text-warning">
                    Not recorded
                  </Badge>
                )
              }
            />
            <Pipe />
            <Node name="Tanks" dashed />
            <Pipe />
            <Node
              tag="Main 2"
              name={model.network?.name ?? WATER_MAIN_STAGE_LABELS.tank_to_network}
              number={model.network?.meter_number}
              extra={
                model.network ? undefined : (
                  <Badge variant="secondary" className="bg-warning/15 text-warning">
                    Not recorded
                  </Badge>
                )
              }
            />
          </div>
          {model.tree.length === 0 ? (
            <p className="ml-6 border-l border-border pl-5 pt-3 text-sm text-muted-foreground">
              No zones yet
            </p>
          ) : (
            <Branch zones={model.tree} />
          )}
          {model.mainLineActive + model.mainLineInactive > 0 && (
            <div className="ml-6 border-l border-border">
              <div className="flex items-center pt-3">
                <span className="h-px w-5 shrink-0 bg-border" aria-hidden="true" />
                <Node
                  name="Main line"
                  extra={
                    <Badge variant="secondary" className="bg-warning/15 text-warning">
                      No zone
                    </Badge>
                  }
                />
              </div>
              <div className="pl-5">
                <MeterCount active={model.mainLineActive} inactive={model.mainLineInactive} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
