import { Link } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import {
  IT_SYSTEM_STATUS_LABELS,
  IT_SYSTEM_STATUS_STYLES,
  useItSystems,
  type ItSystemStatus,
} from "@/features/it/use-it-systems";
import { formatUptimeMonth, formatUptimePercent, useLatestUptimes } from "@/features/it/use-uptime";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_ORDER: ItSystemStatus[] = ["active", "inactive", "deprecated"];

const uptimeTone = (percent: number) =>
  percent >= 99.5 ? "text-success" : percent >= 98 ? "text-warning" : "text-destructive";

const dotTone = (percent: number) =>
  percent >= 99.5 ? "bg-success" : percent >= 98 ? "bg-warning" : "bg-destructive";

/** Which websites and systems are live, and how much of last month they stayed up. */
export function SystemsHealthPanel({ canManage }: { canManage: boolean }) {
  const systemsQ = useItSystems();
  const systems = systemsQ.data ?? [];
  const live = systems.filter((s) => s.status === "active");
  const uptimes = useLatestUptimes(live.map((s) => s.id));

  const measured = live
    .flatMap((system) => {
      const record = uptimes[system.id]?.record;
      return record ? [{ system, record }] : [];
    })
    .sort((a, b) => a.record.uptimePercent - b.record.uptimePercent)
    .slice(0, 6);

  const floor = Math.min(95, ...measured.map((m) => Math.floor(m.record.uptimePercent)));

  return (
    <section className="rounded-xl border bg-card" aria-labelledby="systems-health-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="systems-health-heading" className="text-sm font-semibold">
          Websites and systems we look after
        </h2>
        <Link to="/it/systems-sites" className="text-xs font-medium text-primary hover:underline">
          All systems and sites
        </Link>
      </div>

      {systemsQ.isError ? (
        <div className="p-4">
          <LoadError
            what="systems and sites"
            error={systemsQ.error}
            onRetry={() => systemsQ.refetch()}
          />
        </div>
      ) : systemsQ.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : systems.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-sm font-medium">No systems or sites listed yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            List the websites, client systems and hosting IT looks after, then record how much of
            each month they stayed up.
          </p>
          {canManage && (
            <Button size="sm" asChild>
              <Link to="/it/systems-sites" search={{ new: 1 }}>
                <Plus className="mr-1 h-4 w-4" /> Add system or site
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4 p-4">
          <ul className="grid grid-cols-3 gap-2">
            {STATUS_ORDER.map((status) => (
              <li key={status}>
                <Link
                  to="/it/systems-sites"
                  className="block rounded-lg border px-3 py-2 hover:border-primary/50"
                >
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      IT_SYSTEM_STATUS_STYLES[status],
                    )}
                  >
                    {IT_SYSTEM_STATUS_LABELS[status]}
                  </span>
                  <span className="mt-1 block text-lg font-semibold tabular-nums">
                    {systems.filter((s) => s.status === status).length}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div>
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
              How much of last month each one stayed up
            </h3>
            {measured.length === 0 ? (
              <div className="rounded-lg border border-dashed px-3 py-6 text-center">
                <p className="text-sm">No uptime written down yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Record last month&apos;s figure against each system so outages show up here.
                </p>
                <Link
                  to="/it/systems-sites"
                  className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                >
                  Record uptime
                </Link>
              </div>
            ) : (
              <>
                <ul className="space-y-2.5">
                  {measured.map(({ system, record }) => {
                    const position = ((record.uptimePercent - floor) / (100 - floor)) * 100;
                    return (
                      <li key={system.id}>
                        <Link
                          to="/it/systems-sites"
                          className="block rounded px-1 py-0.5 -mx-1 hover:bg-secondary/40"
                        >
                          <span className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="truncate font-medium">{system.name}</span>
                            <span
                              className={cn(
                                "shrink-0 tabular-nums font-semibold",
                                uptimeTone(record.uptimePercent),
                              )}
                            >
                              {formatUptimePercent(record.uptimePercent)}
                            </span>
                          </span>
                          <span className="relative mt-1.5 block h-1.5 rounded-full bg-secondary">
                            <span
                              className={cn(
                                "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full",
                                dotTone(record.uptimePercent),
                              )}
                              style={{ left: `${Math.max(0, Math.min(100, position))}%` }}
                            />
                          </span>
                          <span className="mt-0.5 block text-[0.625rem] text-muted-foreground">
                            {formatUptimeMonth(record.month)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-1 flex justify-between text-[0.625rem] text-muted-foreground">
                  <span>{floor}% up</span>
                  <span>100% up</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
