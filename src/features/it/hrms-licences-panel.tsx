import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import {
  HRMS_LICENSE_STATUS_LABELS,
  HRMS_LICENSE_STATUS_STYLES,
  HRMS_LICENSE_TIER_LABELS,
  useHrmsLicenses,
} from "@/features/it/use-hrms-licenses";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";

const inDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const daysUntil = (date: string) =>
  Math.round((new Date(`${date.slice(0, 10)}T00:00:00`).getTime() - Date.now()) / 86400000);

/** Client licences for the HRMS product: who renews soon and who has run out of seats. */
export function HrmsLicencesPanel() {
  const licencesQ = useHrmsLicenses();
  const licences = licencesQ.data ?? [];
  const horizon = inDays(90);

  const renewing = licences
    .filter((l) => l.renewalDate && l.renewalDate.slice(0, 10) <= horizon)
    .sort((a, b) => (a.renewalDate ?? "").localeCompare(b.renewalDate ?? ""));
  const overSeats = licences.filter(
    (l) => l.licensedSeats != null && (l.activeUsers ?? 0) > l.licensedSeats,
  );
  const liveCount = licences.filter((l) => l.status === "active").length;
  const trialCount = licences.filter((l) => l.status === "trial").length;

  return (
    <section className="rounded-xl border bg-card" aria-labelledby="hrms-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="hrms-heading" className="text-sm font-semibold">
          HRMS client licences
        </h2>
        <Link to="/it/hrms-clients" className="text-xs font-medium text-primary hover:underline">
          All HRMS clients ({licences.length})
        </Link>
      </div>

      {licencesQ.isError ? (
        <div className="p-4">
          <LoadError
            what="HRMS licences"
            error={licencesQ.error}
            onRetry={() => licencesQ.refetch()}
          />
        </div>
      ) : licencesQ.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : licences.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-sm font-medium">No HRMS clients yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Add the companies using our HRMS, how many people they pay for and when their licence
            renews.
          </p>
          <Button size="sm" asChild>
            <Link to="/it/hrms-clients">Open HRMS clients</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground">
            {liveCount} paying · {trialCount} on trial
            {overSeats.length > 0 && (
              <span className="font-semibold text-warning">
                {" "}
                · {overSeats.length} over the seats they pay for
              </span>
            )}
          </p>

          <h3 className="text-xs font-semibold text-muted-foreground">
            Renewing in the next 90 days
          </h3>
          {renewing.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nothing renews in the next 90 days. Check back nearer the time.
            </p>
          ) : (
            <ul className="divide-y">
              {renewing.slice(0, 5).map((l) => {
                const days = daysUntil(l.renewalDate!);
                return (
                  <li key={l.id}>
                    <Link
                      to="/it/hrms-clients"
                      className="flex items-start justify-between gap-3 py-2 text-sm hover:bg-secondary/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{l.client.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {HRMS_LICENSE_TIER_LABELS[l.tier]} ·{" "}
                          {l.licensedSeats != null
                            ? `${l.activeUsers ?? 0} of ${l.licensedSeats} seats used`
                            : `${l.activeUsers ?? 0} people using it`}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            HRMS_LICENSE_STATUS_STYLES[l.status],
                          )}
                        >
                          {HRMS_LICENSE_STATUS_LABELS[l.status]}
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 block text-xs tabular-nums",
                            days < 0
                              ? "font-semibold text-destructive"
                              : days <= 30
                                ? "font-semibold text-warning"
                                : "text-muted-foreground",
                          )}
                        >
                          {days < 0 ? `Ran out ${formatDate(l.renewalDate)}` : `${days} days left`}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
