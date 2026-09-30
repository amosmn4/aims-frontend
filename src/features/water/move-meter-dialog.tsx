import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useMoveWaterMeterZone, useWaterAllZones } from "@/features/water/use-water";
import { orderZoneTree } from "@/features/water/zone-tree";
import { FormField } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
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

const MAIN_LINE = "__main_line__";

export interface MoveMeterTarget {
  id: string;
  meter_number: string;
  zone_id: string | null;
}

/** Changes only which zone a meter sits in; every other detail is left alone. */
export function MoveMeterDialog({
  meter,
  onClose,
}: {
  meter: MoveMeterTarget | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!meter} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{meter && <MoveMeterForm meter={meter} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function MoveMeterForm({ meter, onClose }: { meter: MoveMeterTarget; onClose: () => void }) {
  const allZonesQ = useWaterAllZones();
  const move = useMoveWaterMeterZone();
  const [zoneId, setZoneId] = useState(meter.zone_id ?? MAIN_LINE);

  const rows = orderZoneTree(allZonesQ.data ?? []);
  const target = zoneId === MAIN_LINE ? null : zoneId;
  const submit = () => {
    move.mutate(
      { id: meter.id, zoneId: target },
      {
        onSuccess: () => {
          const name = rows.find((z) => z.id === target)?.name;
          toast.success(`Meter ${meter.meter_number} moved to ${name ?? "the main line"}`);
          onClose();
        },
        onError: (err: unknown) =>
          toast.error(err instanceof Error ? err.message : "Couldn't move the meter"),
      },
    );
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
        <DialogTitle>Move meter {meter.meter_number}</DialogTitle>
      </DialogHeader>
      {allZonesQ.isError ? (
        <LoadError what="zones" error={allZonesQ.error} onRetry={() => allZonesQ.refetch()} />
      ) : (
        <FormField id="move-meter-zone" label="Zone">
          <Select value={zoneId} onValueChange={setZoneId}>
            <SelectTrigger id="move-meter-zone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MAIN_LINE}>On the main line</SelectItem>
              {rows.map((z) => (
                <SelectItem key={z.id} value={z.id}>
                  {`${"  ".repeat(z.depth)}${z.depth > 0 ? "↳ " : ""}${z.name}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      )}
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={move.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={move.isPending || (meter.zone_id ?? MAIN_LINE) === zoneId}>
          {move.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Move meter
        </Button>
      </DialogFooter>
    </form>
  );
}
