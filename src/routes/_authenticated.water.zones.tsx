import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Search } from "lucide-react";
import {
  useWaterZones,
  useWaterAllZones,
  useWaterMeters,
  useWaterZoneComparison,
  useCreateWaterZone,
  useUpdateWaterZone,
  useDeleteWaterZone,
  useCanManageWater,
  WATER_VERDICT_LABELS,
  WATER_VERDICT_TONES,
  type WaterVerdict,
  type WaterZoneComparisonRow,
  type WaterZoneRow,
} from "@/features/water/use-water";
import { currentMonth, orderZoneTree, zoneIndent } from "@/features/water/zone-tree";
import { formatUnits } from "@/features/water/chart-periods";
import { ListEmpty, ListNoMatches } from "@/features/water/water-ui";
import { RowActions } from "@/components/row-actions";
import { confirmDeleteZone, deleteErrorToast } from "@/features/water/water-delete";
import { PageHeader } from "@/components/app-shell";
import { formatDate } from "@/lib/format-date";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/water/zones")({
  head: () => ({ meta: [{ title: "Water Project — Zones — AIMS" }] }),
  component: WaterZonesPage,
});

const NONE = "__none__";

/** Loss for a whole zone or the zone only. Water bought ahead of use is never shown as a loss. */
function LossCell({
  stats,
  units,
  pct,
  verdict,
}: {
  stats: WaterZoneComparisonRow | undefined;
  units: number;
  pct: number | null;
  verdict: WaterVerdict;
}) {
  const base = "text-right text-xs tabular-nums";
  if (!stats?.has_bulk_meter) {
    return <TableCell className={`${base} text-muted-foreground`}>Not measured</TableCell>;
  }
  if (verdict === "not_measured") {
    return (
      <TableCell className={`${base} text-muted-foreground`}>
        Not read
        <span className="block">Needs two readings</span>
      </TableCell>
    );
  }
  if (verdict === "bought_ahead" || verdict === "over_read") {
    return (
      <TableCell className={`${base} ${WATER_VERDICT_TONES[verdict]}`}>
        None
        <span className="block">
          {verdict === "bought_ahead"
            ? `${formatUnits(-units)} m³ bought ahead`
            : `${formatUnits(-units)} m³ over, check readings`}
        </span>
      </TableCell>
    );
  }
  return (
    <TableCell
      className={`${base} ${verdict === "within_limit" ? "" : WATER_VERDICT_TONES[verdict]}`}
    >
      {formatUnits(units)}
      {pct !== null && ` · ${pct.toFixed(1)}%`}
      <span className="block">{WATER_VERDICT_LABELS[verdict]}</span>
    </TableCell>
  );
}

function indentLabel(name: string, depth: number): string {
  return `${"  ".repeat(depth)}${depth > 0 ? "↳ " : ""}${name}`;
}

function WaterZonesPage() {
  const canManage = useCanManageWater();
  const [q, setQ] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const term = useDebouncedValue(q.trim().toLowerCase());

  const zonesQ = useWaterZones();
  const metersQ = useWaterMeters();
  const comparisonQ = useWaterZoneComparison({ month: month || currentMonth() });
  const deleteZone = useDeleteWaterZone();
  const [editing, setEditing] = useState<WaterZoneRow | "new" | null>(null);

  const result = zonesQ.data;
  const zones = useMemo(
    () => (result ? (Array.isArray(result) ? result : result.data) : []),
    [result],
  );
  const meters = useMemo(() => metersQ.data ?? [], [metersQ.data]);
  const comparison = useMemo(() => comparisonQ.data ?? [], [comparisonQ.data]);

  const bulkByZone = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const m of meters) {
      if (!m.zone_id || m.meter_type !== "bulk") continue;
      map.set(m.zone_id, [...(map.get(m.zone_id) ?? []), m.meter_number]);
    }
    return map;
  }, [meters]);

  const statsByZone = useMemo(
    () => new Map(comparison.filter((c) => c.zone_id).map((c) => [c.zone_id as string, c])),
    [comparison],
  );
  const mainLine = comparison.find((c) => c.zone_id === null);

  // A match keeps its ancestors on screen, so the tree never loses its shape.
  const rows = useMemo(() => {
    const ordered = orderZoneTree(zones);
    if (!term) return ordered;
    const byId = new Map(ordered.map((z) => [z.id, z]));
    const keep = new Set<string>();
    for (const zone of ordered) {
      if (!zone.name.toLowerCase().includes(term)) continue;
      let current: (typeof ordered)[number] | undefined = zone;
      while (current && !keep.has(current.id)) {
        keep.add(current.id);
        current = current.parent_zone_id ? byId.get(current.parent_zone_id) : undefined;
      }
    }
    return ordered.filter((z) => keep.has(z.id));
  }, [zones, term]);

  const handleDelete = async (z: WaterZoneRow) => {
    if (!(await confirmDeleteZone(z))) return;
    deleteZone.mutate(z.id, {
      onSuccess: () => toast.success(`Zone "${z.name}" deleted`),
      onError: deleteErrorToast,
    });
  };

  const addButton = (
    <Button size="sm" onClick={() => setEditing("new")}>
      <Plus className="h-4 w-4 mr-1" /> Add zone
    </Button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Zones"
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="zones-month" className="text-xs">
                Month
              </Label>
              <Input
                id="zones-month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="h-9 w-40"
              />
            </div>
            {canManage && addButton}
          </div>
        }
      />
      {!canManage && <ViewOnlyBanner area="the Water Project" />}

      <div className="rounded-lg border bg-card p-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search zones by name…"
            aria-label="Search zones"
            className="pl-7"
          />
        </div>
      </div>

      {zonesQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : zonesQ.isError ? (
        <LoadError what="zones" error={zonesQ.error} onRetry={() => zonesQ.refetch()} />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-card">
          {term ? (
            <ListNoMatches onClear={() => setQ("")} />
          ) : (
            <ListEmpty message="No zones yet" action={canManage ? addButton : undefined} />
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zone</TableHead>
                  <TableHead>Bulk meter</TableHead>
                  <TableHead className="text-right">Meters in use</TableHead>
                  <TableHead className="text-right">Through the meter (m³)</TableHead>
                  <TableHead className="text-right">Plots used (m³)</TableHead>
                  <TableHead className="text-right">Loss</TableHead>
                  {canManage && (
                    <TableHead className="w-20">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((z) => {
                  const bulkMeters = bulkByZone.get(z.id) ?? [];
                  const stats = statsByZone.get(z.id);
                  const hasBulk = bulkMeters.length > 0;
                  // A zone with zones inside it is shown twice: all of it, then itself only.
                  const split = !!stats && (stats.has_sub_zones || stats.is_estate);
                  const measured = hasBulk && !!stats?.bulk_measured;
                  const num = "text-right text-xs tabular-nums";
                  return (
                    <Fragment key={z.id}>
                      <TableRow>
                        <TableCell style={{ paddingLeft: 12 + zoneIndent(z.depth) }}>
                          <Link
                            to="/water/zones/$zoneId"
                            params={{ zoneId: z.id }}
                            className="font-medium text-primary hover:underline"
                          >
                            {z.depth > 0 && (
                              <span className="text-muted-foreground mr-1" aria-hidden="true">
                                ↳
                              </span>
                            )}
                            {z.name}
                          </Link>
                          {split && (
                            <span className="block text-xs text-muted-foreground">
                              {stats.is_estate ? "Whole estate" : "With the zones inside it"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {hasBulk ? (
                            bulkMeters.join(", ")
                          ) : (
                            <Badge variant="secondary" className="font-sans text-warning">
                              No bulk meter
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className={num}>
                          {(stats?.whole_meters ?? 0).toLocaleString()}
                        </TableCell>
                        <TableCell className={num}>
                          {!hasBulk ? "—" : measured ? formatUnits(stats.bulk_total) : "Not read"}
                          {measured && stats.bulk_from && stats.bulk_to && (
                            <span className="block text-muted-foreground">
                              {formatDate(stats.bulk_from)} – {formatDate(stats.bulk_to)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className={num}>
                          {formatUnits(stats?.whole_household_total ?? 0)}
                        </TableCell>
                        <LossCell
                          stats={stats}
                          units={stats?.whole_loss_units ?? 0}
                          pct={stats?.whole_loss_pct ?? null}
                          verdict={stats?.whole_verdict ?? "not_measured"}
                        />
                        {canManage && (
                          <TableCell>
                            <RowActions
                              label={`zone ${z.name}`}
                              onEdit={() => setEditing(z)}
                              onDelete={() => handleDelete(z)}
                            />
                          </TableCell>
                        )}
                      </TableRow>
                      {split && !term && (
                        <TableRow className="bg-muted/30">
                          <TableCell style={{ paddingLeft: 12 + zoneIndent(z.depth + 1) }}>
                            <span className="text-muted-foreground mr-1" aria-hidden="true">
                              ↳
                            </span>
                            <span className="font-medium">{z.name} only</span>
                            <span className="block text-xs text-muted-foreground">
                              {stats.is_estate
                                ? "On the main line, in no inner zone"
                                : "Not in a zone inside it"}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">—</TableCell>
                          <TableCell className={num}>{stats.own_meters.toLocaleString()}</TableCell>
                          <TableCell className={num}>
                            {measured ? formatUnits(stats.own_passed) : "—"}
                            {measured && stats.child_zones_bulk_total > 0 && (
                              <span className="block text-muted-foreground">
                                {formatUnits(stats.bulk_total)} −{" "}
                                {formatUnits(stats.child_zones_bulk_total)} inside
                              </span>
                            )}
                          </TableCell>
                          <TableCell className={num}>
                            {formatUnits(stats.household_total)}
                          </TableCell>
                          <LossCell
                            stats={stats}
                            units={stats.loss_units}
                            pct={stats.loss_pct}
                            verdict={stats.verdict}
                          />
                          {canManage && <TableCell />}
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
                {!term && mainLine && (
                  <TableRow className="bg-muted/30">
                    <TableCell className="font-medium">On the main line</TableCell>
                    <TableCell className="text-xs text-muted-foreground">No zone</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {mainLine.own_meters.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">—</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatUnits(mainLine.household_total)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      Not measured
                    </TableCell>
                    {canManage && <TableCell />}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <EditZoneDialog value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function EditZoneDialog({
  value,
  onClose,
}: {
  value: WaterZoneRow | "new" | null;
  onClose: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const { guardClose } = useUnsavedChanges(dirty);
  const close = () => {
    setDirty(false);
    onClose();
  };
  return (
    <Dialog open={!!value} onOpenChange={(open) => !open && guardClose(close)}>
      <DialogContent>
        {value && (
          <EditZoneForm
            value={value === "new" ? null : value}
            onDirtyChange={setDirty}
            onCancel={() => guardClose(close)}
            onDone={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditZoneForm({
  value,
  onDirtyChange,
  onCancel,
  onDone,
}: {
  value: WaterZoneRow | null;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const create = useCreateWaterZone();
  const update = useUpdateWaterZone();
  const allZonesQ = useWaterAllZones();
  const [name, setName] = useState(value?.name ?? "");
  const [parentZoneId, setParentZoneId] = useState(value?.parent_zone_id ?? "");
  const [nameError, setNameError] = useState<string>();

  const dirty = name !== (value?.name ?? "") || parentZoneId !== (value?.parent_zone_id ?? "");
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  // Excludes only the zone itself; the backend rejects moving a zone under its own sub-zones.
  const parentOptions = orderZoneTree(allZonesQ.data ?? []).filter((z) => z.id !== value?.id);
  const isPending = create.isPending || update.isPending;

  const submit = () => {
    if (!name.trim()) {
      setNameError("Enter a zone name");
      return;
    }
    const callbacks = {
      onSuccess: () => {
        toast.success(value ? `Zone "${name.trim()}" updated` : `Zone "${name.trim()}" added`);
        onDone();
      },
      onError: (err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Couldn't save zone"),
    };
    if (value) {
      update.mutate(
        { id: value.id, name: name.trim(), parentZoneId: parentZoneId || null },
        callbacks,
      );
    } else {
      create.mutate({ name: name.trim(), parentZoneId: parentZoneId || undefined }, callbacks);
    }
  };

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>{value ? `Edit zone ${value.name}` : "Add zone"}</DialogTitle>
      </DialogHeader>
      <RequiredNote />
      <div className="space-y-3">
        <FormField id="zone-name" label="Name" required error={nameError}>
          <Input
            id="zone-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(undefined);
            }}
            placeholder="e.g. Zone A"
            aria-invalid={!!nameError}
            aria-describedby={nameError ? "zone-name-error" : undefined}
          />
        </FormField>
        <FormField
          id="zone-parent"
          label="Sits inside"
          error={
            allZonesQ.isError ? "Couldn't load the zone list. Close and try again." : undefined
          }
        >
          <Select
            value={parentZoneId || NONE}
            onValueChange={(v) => setParentZoneId(v === NONE ? "" : v)}
          >
            <SelectTrigger id="zone-parent">
              <SelectValue placeholder="Nothing — top-level zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nothing — top-level zone</SelectItem>
              {parentOptions.map((z) => (
                <SelectItem key={z.id} value={z.id}>
                  {indentLabel(z.name, z.depth)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {value ? "Save zone" : "Add zone"}
        </Button>
      </DialogFooter>
    </form>
  );
}
