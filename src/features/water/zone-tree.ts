import type { WaterZoneTreeNode } from "@/features/water/use-water";

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
