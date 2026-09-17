import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import { formatDateTime } from "@/lib/format-date";

// Shared delete confirmations so list rows and detail pages describe the same consequences.

function plural(count: number, noun: string): string {
  return `${count.toLocaleString()} ${noun}${count === 1 ? "" : "s"}`;
}

function joinWithAnd(items: string[]): string {
  return items.length <= 1
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function deleteErrorToast(err: unknown) {
  toast.error(err instanceof Error ? err.message : "Failed to delete");
}

export function confirmDeleteZone(zone: {
  name: string;
  child_count: number;
  meter_count: number;
  customer_count: number;
}): Promise<boolean> {
  const blockers: string[] = [];
  if (zone.child_count > 0) blockers.push(plural(zone.child_count, "sub-zone"));
  if (zone.meter_count > 0) blockers.push(plural(zone.meter_count, "meter"));
  if (zone.customer_count > 0) blockers.push(plural(zone.customer_count, "customer"));
  if (blockers.length > 0) {
    toast.error(
      `Can't delete zone "${zone.name}" — it still has ${joinWithAnd(blockers)}. Move or delete them first.`,
    );
    return Promise.resolve(false);
  }
  return confirmDialog({
    title: `Delete zone "${zone.name}"?`,
    description: "The zone will be permanently deleted. This can't be undone.",
    confirmLabel: "Delete zone",
    destructive: true,
  });
}

export function confirmDeleteCustomer(customer: {
  name: string;
  meter_count: number;
}): Promise<boolean> {
  const meterNote =
    customer.meter_count > 0
      ? ` Their ${plural(customer.meter_count, "meter")} will stay in the registry as unassigned, and past vending history is kept.`
      : "";
  return confirmDialog({
    title: `Delete customer "${customer.name}"?`,
    description: `${customer.name} will be permanently deleted.${meterNote} This can't be undone.`,
    confirmLabel: "Delete customer",
    destructive: true,
  });
}

export function confirmDeleteMeter(meter: {
  meter_number: string;
  vend_count: number;
  reading_count: number;
}): Promise<boolean> {
  const history: string[] = [];
  if (meter.reading_count > 0) history.push(plural(meter.reading_count, "reading"));
  if (meter.vend_count > 0) history.push(plural(meter.vend_count, "vending record"));
  const description =
    history.length > 0
      ? `Meter ${meter.meter_number} will be permanently deleted together with its ${joinWithAnd(history)}, and usage figures will be recalculated. This can't be undone. To keep its history, edit the meter and switch it to Inactive instead.`
      : `Meter ${meter.meter_number} will be permanently deleted. This can't be undone.`;
  return confirmDialog({
    title: `Delete meter ${meter.meter_number}?`,
    description,
    confirmLabel: "Delete meter",
    destructive: true,
  });
}

export function confirmDeleteReading(reading: {
  meter_number: string;
  value: number;
  reading_date: string;
}): Promise<boolean> {
  return confirmDialog({
    title: "Delete this reading?",
    description: `The reading of ${reading.value.toLocaleString()} on meter ${reading.meter_number}, taken ${formatDateTime(reading.reading_date)}, will be permanently deleted and usage figures recalculated. This can't be undone.`,
    confirmLabel: "Delete reading",
    destructive: true,
  });
}

export function confirmDeleteUpload(upload: {
  file_name: string;
  record_count: number;
}): Promise<boolean> {
  return confirmDialog({
    title: `Delete upload "${upload.file_name}"?`,
    description: `This permanently removes the ${plural(upload.record_count, "usage record")} imported from this file and recalculates analytics. Meters and customers it registered stay in the registry. To correct a file, delete it and upload the fixed version. This can't be undone.`,
    confirmLabel: "Delete upload",
    destructive: true,
  });
}
