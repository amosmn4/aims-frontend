import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { LoadError } from "@/components/load-error";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useAssignMetersToZone,
  useUnassignedWaterMeters,
  type UnassignedMeter,
} from "@/features/water/use-water";

/** Puts meters that are in no zone yet into this one, several at a time. */
export function PlaceMetersDialog({
  zoneId,
  zoneName,
  open,
  onClose,
}: {
  zoneId: string;
  zoneName: string;
  open: boolean;
  onClose: () => void;
}) {
  const metersQ = useUnassignedWaterMeters(undefined, open);
  const assign = useAssignMetersToZone();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const search = useDebouncedValue(q.trim().toLowerCase(), 250);

  const meters = useMemo(() => metersQ.data ?? [], [metersQ.data]);
  const shown = useMemo(() => {
    if (!search) return meters;
    return meters.filter((m) =>
      [m.meter_number, m.plot_no, m.customer?.name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(search)),
    );
  }, [meters, search]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allShownPicked = shown.length > 0 && shown.every((m) => picked.has(m.id));
  const toggleAllShown = () =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const m of shown) {
        if (allShownPicked) next.delete(m.id);
        else next.add(m.id);
      }
      return next;
    });

  const close = () => {
    setPicked(new Set());
    setQ("");
    onClose();
  };

  const save = async () => {
    const meterIds = [...picked];
    if (meterIds.length === 0) return;
    try {
      await assign.mutateAsync({ zoneId, meterIds });
      toast.success(
        `${meterIds.length} meter${meterIds.length === 1 ? "" : "s"} moved into ${zoneName}`,
      );
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't move the meters");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Place meters in {zoneName}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search
            className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Meter number, plot or name"
            className="pl-8"
            aria-label="Search meters not in a zone"
          />
        </div>

        {metersQ.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : metersQ.isError ? (
          <LoadError what="meters" error={metersQ.error} onRetry={() => void metersQ.refetch()} />
        ) : meters.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Every meter is already in a zone.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b pb-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={allShownPicked}
                  onCheckedChange={toggleAllShown}
                  aria-label="Select all shown"
                />
                Select all shown
              </label>
              <span className="text-xs text-muted-foreground">
                {picked.size} of {shown.length}
              </span>
            </div>
            <ul className="divide-y">
              {shown.map((m) => (
                <MeterRow
                  key={m.id}
                  meter={m}
                  checked={picked.has(m.id)}
                  onToggle={() => toggle(m.id)}
                />
              ))}
            </ul>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button onClick={save} disabled={picked.size === 0 || assign.isPending}>
            {assign.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Move {picked.size || ""} into {zoneName}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MeterRow({
  meter,
  checked,
  onToggle,
}: {
  meter: UnassignedMeter;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-3 py-2.5">
        <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={meter.meter_number} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {meter.plot_no ?? meter.meter_number}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {meter.meter_number}
            {meter.customer?.name ? ` · ${meter.customer.name}` : ""}
          </span>
        </span>
        {meter.meter_type === "bulk" && <Badge variant="outline">Bulk</Badge>}
        {!meter.is_active && <Badge variant="secondary">Inactive</Badge>}
      </label>
    </li>
  );
}
