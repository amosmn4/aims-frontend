import type { HouseholdReconciliation } from "./use-water";

export function HouseholdReconciliationPanel({ value }: { value: HouseholdReconciliation }) {
  const units = (number: number | null) =>
    number === null
      ? "Not available"
      : `${number.toLocaleString(undefined, { maximumFractionDigits: 2 })} m³`;
  return (
    <section
      className="rounded-lg border bg-card p-4 space-y-3"
      aria-label="Household reconciliation"
    >
      <div>
        <h2 className="text-sm font-semibold">Household reconciliation</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {value.metersRead} of {value.metersTotal} meters have usable pairs of readings.{" "}
          {value.counterMetersRead} also have lifetime usage counters.
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: "Opening prepaid balance", number: value.openingBalance },
          { label: "Purchases for meters read", number: value.purchases },
          { label: "Remaining prepaid units", number: value.closingBalance },
          { label: "Usage from prepaid credit", number: value.creditUsed },
          { label: "Usage from lifetime counters", number: value.measuredUsed },
          { label: "Counter / credit difference", number: value.difference },
        ].map((row) => (
          <div key={row.label} className="min-w-0 rounded-md bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">{row.label}</p>
            <p className="mt-1 text-lg font-semibold break-words">{units(row.number)}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Usage from credit = opening balance + purchases - remaining balance. Counter usage is the
        change in lifetime units used. The difference compares only meters with both calculations.
      </p>
      {(!value.complete || value.estimated) && (
        <p className="text-xs text-warning">
          This period is not fully covered by exact readings. Figures cover the captured intervals,
          with estimates where intervals cross period boundaries. Capture both figures at the
          beginning and end of the month.
        </p>
      )}
      {value.issues > 0 && (
        <p className="text-xs text-warning">
          Some counter readings and prepaid balances do not reconcile. Check the household readings
          and purchase uploads.
        </p>
      )}
    </section>
  );
}
