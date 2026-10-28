import type {
  WaterVerdict,
  WaterZoneComparisonRow,
  WaterZoneTreeNode,
} from "@/features/water/use-water";

/** How deep a zone sits, so a list can be indented like the pipework. */
export type ZoneTreeRow<T> = T & { depth: number; child_count: number };

/**
 * Depth-first, alphabetical at every level. A zone whose parent is missing from
 * the list is treated as top-level so nothing ever disappears.
 */
export function orderZoneTree<T extends WaterZoneTreeNode>(zones: T[]): ZoneTreeRow<T>[] {
  const byId = new Map(zones.map((z) => [z.id, z]));
  const childrenOf = new Map<string, T[]>();
  const roots: T[] = [];
  for (const zone of zones) {
    const parentId = zone.parent_zone_id;
    if (parentId && byId.has(parentId)) {
      childrenOf.set(parentId, [...(childrenOf.get(parentId) ?? []), zone]);
    } else {
      roots.push(zone);
    }
  }
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  const rows: ZoneTreeRow<T>[] = [];
  const walk = (list: T[], depth: number) => {
    for (const zone of [...list].sort(byName)) {
      const children = childrenOf.get(zone.id) ?? [];
      rows.push({ ...zone, depth, child_count: children.length });
      walk(children, depth + 1);
    }
  };
  walk(roots, 0);
  return rows;
}

/** Root-to-zone chain, the zone itself last. */
export function zonePathNodes(
  zones: WaterZoneTreeNode[],
  zoneId: string,
): { id: string; name: string }[] {
  const byId = new Map(zones.map((z) => [z.id, z]));
  const chain: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  let current = byId.get(zoneId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift({ id: current.id, name: current.name });
    current = current.parent_zone_id ? byId.get(current.parent_zone_id) : undefined;
  }
  return chain;
}

/** Every zone id the given zone contains, itself included. */
export function zoneAndDescendantIds(zones: WaterZoneTreeNode[], zoneId: string): string[] {
  const ids = new Set([zoneId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const zone of zones) {
      if (zone.parent_zone_id && ids.has(zone.parent_zone_id) && !ids.has(zone.id)) {
        ids.add(zone.id);
        grew = true;
      }
    }
  }
  return [...ids];
}

/** Indent step for a tree row, in pixels. */
export function zoneIndent(depth: number): number {
  return depth * 18;
}

/** First and last day of a YYYY-MM month, as the usage endpoints want them. */
export function monthWindow(month: string): { dateFrom: string; dateTo: string } {
  const [year, m] = month.split("-").map(Number);
  const start = new Date(year, (m ?? 1) - 1, 1);
  const next = new Date(year, m ?? 1, 1);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { dateFrom: iso(start), dateTo: iso(next) };
}

/** Today's month as YYYY-MM. */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** The single top-level zone is the whole estate; meters with no zone are on its main line. */
export function estateZoneOf<T extends WaterZoneTreeNode>(zones: T[]): T | null {
  const ids = new Set(zones.map((z) => z.id));
  const roots = zones.filter((z) => !z.parent_zone_id || !ids.has(z.parent_zone_id));
  return roots.length === 1 ? roots[0] : null;
}

/** A zone that holds other zones is named "… only" wherever its own figures stand alone. */
export function zoneOnlyName(z: WaterZoneComparisonRow): string {
  return z.has_sub_zones || z.is_estate ? `${z.zone_name} only` : z.zone_name;
}

/** One line of a zone table: a whole zone, a zone only, or a zone with nothing inside it. */
export interface ZoneSetLine {
  key: string;
  zone_id: string | null;
  name: string;
  depth: number;
  kind: "whole" | "only" | "single";
  /** Household meters in use in the period. Bulk meters are never counted here. */
  meters: number;
  has_bulk_meter: boolean;
  measured: boolean;
  from: string | null;
  to: string | null;
  /** Through the bulk meter; for a zone only, less the bulk meters inside it. */
  passed: number;
  inner_passed: number;
  households: number;
  gap: number;
  gap_pct: number | null;
  verdict: WaterVerdict;
}

/**
 * Every zone in pipe order. A zone with zones inside it gives two lines: the
 * whole zone, then the zone only (whole less the inner zones), so that each
 * line's meters, water and households always describe the same set.
 */
export function zoneSetLines(rows: WaterZoneComparisonRow[]): ZoneSetLine[] {
  const byId = new Map(rows.flatMap((r) => (r.zone_id ? [[r.zone_id, r] as const] : [])));
  const ordered = orderZoneTree(
    [...byId.values()].map((r) => ({
      id: r.zone_id as string,
      name: r.zone_name,
      parent_zone_id: r.parent_zone_id,
    })),
  );
  const lines: ZoneSetLine[] = [];
  for (const zone of ordered) {
    const r = byId.get(zone.id)!;
    const shared = {
      zone_id: zone.id,
      has_bulk_meter: r.has_bulk_meter,
      measured: r.bulk_measured,
      from: r.bulk_from,
      to: r.bulk_to,
    };
    const own = {
      meters: r.own_meters,
      passed: r.own_passed,
      inner_passed: r.child_zones_bulk_total,
      households: r.household_total,
      gap: r.loss_units,
      gap_pct: r.loss_pct,
      verdict: r.verdict,
    };
    if (!r.has_sub_zones && !r.is_estate) {
      lines.push({
        ...shared,
        ...own,
        key: zone.id,
        name: zone.name,
        depth: zone.depth,
        kind: "single",
      });
      continue;
    }
    lines.push({
      ...shared,
      key: `${zone.id}:whole`,
      name: zone.name,
      depth: zone.depth,
      kind: "whole",
      meters: r.whole_meters,
      passed: r.bulk_total,
      inner_passed: 0,
      households: r.whole_household_total,
      gap: r.whole_loss_units,
      gap_pct: r.whole_loss_pct,
      verdict: r.whole_verdict,
    });
    lines.push({
      ...shared,
      ...own,
      key: zone.id,
      name: `${zone.name} only`,
      depth: zone.depth + 1,
      kind: "only",
    });
  }
  // Meters with no zone recorded: counted in the estate's whole, on a line of their own.
  const loose = rows.find((r) => r.zone_id === null);
  if (loose) {
    lines.push({
      key: "no-zone",
      zone_id: null,
      name: loose.zone_name,
      depth: rows.some((r) => r.is_estate) ? 1 : 0,
      kind: "single",
      meters: loose.own_meters,
      has_bulk_meter: false,
      measured: false,
      from: null,
      to: null,
      passed: 0,
      inner_passed: 0,
      households: loose.household_total,
      gap: 0,
      gap_pct: null,
      verdict: "not_measured",
    });
  }
  return lines;
}
