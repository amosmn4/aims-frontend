import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import {
  useRecruitmentEngagements,
  type RecruitmentEngagementRow,
} from "@/features/hr/use-recruitment";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STAGE_STYLES: Record<string, string> = {
  "Not started": "bg-secondary text-secondary-foreground",
  "Taking applications": "bg-primary/10 text-primary",
  Screening: "bg-primary/10 text-primary",
  Interviewing: "bg-warning/15 text-warning",
  "Offers out": "bg-accent/15 text-accent",
  Placed: "bg-success/15 text-success",
};

/** The furthest point this drive has reached, in the client's words. */
function stageOf(row: RecruitmentEngagementRow) {
  const f = row.funnel;
  if (!f) return "Not started";
  if (f.placed > 0) return "Placed";
  if (f.offered > 0) return "Offers out";
  if (f.interviewed > 0) return "Interviewing";
  if (f.screened > 0) return "Screening";
  if (f.applications_received > 0) return "Taking applications";
  return "Not started";
}

/** Recruitment drives we are running for clients, and how far each one has got. */
export function RecruitmentStagePanel() {
  const engagementsQ = useRecruitmentEngagements();
  const engagements = engagementsQ.data ?? [];
  const withFunnel = engagements.filter((e) => e.funnel);
  const sum = (pick: (e: RecruitmentEngagementRow) => number) =>
    withFunnel.reduce((total, e) => total + pick(e), 0);
  const ordered = [...engagements].sort(
    (a, b) => (b.funnel?.applications_received ?? -1) - (a.funnel?.applications_received ?? -1),
  );

  return (
    <section className="rounded-xl border bg-card" aria-labelledby="recruitment-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="recruitment-heading" className="text-sm font-semibold">
          Recruitment drives in flight
        </h2>
        <Link to="/hr/recruitment" className="text-xs font-medium text-primary hover:underline">
          Open recruitment
        </Link>
      </div>

      {engagementsQ.isError ? (
        <div className="p-4">
          <LoadError
            what="recruitment drives"
            error={engagementsQ.error}
            onRetry={() => engagementsQ.refetch()}
          />
        </div>
      ) : engagementsQ.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : engagements.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-sm font-medium">No recruitment drives yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Start a project on the Recruitment service line, then write down how many applied, were
            interviewed and were placed.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link to="/hr/recruitment">Open recruitment</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          <ul className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: "Applied", value: sum((e) => e.funnel?.applications_received ?? 0) },
              { label: "Interviewed", value: sum((e) => e.funnel?.interviewed ?? 0) },
              { label: "Offered", value: sum((e) => e.funnel?.offered ?? 0) },
              { label: "Placed", value: sum((e) => e.funnel?.placed ?? 0) },
            ].map((s) => (
              <li key={s.label} className="rounded-lg border px-2 py-2">
                <span className="block text-lg font-semibold tabular-nums">{s.value}</span>
                <span className="block text-xs text-muted-foreground">{s.label}</span>
              </li>
            ))}
          </ul>

          <ul className="divide-y">
            {ordered.slice(0, 5).map((e) => {
              const stage = stageOf(e);
              return (
                <li key={e.project_id}>
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: e.project_id }}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-secondary/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{e.project_name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {e.client_name ?? "No client set"}
                        {e.funnel
                          ? ` · ${e.funnel.applications_received} applied, ${e.funnel.placed} placed`
                          : " · no numbers written down yet"}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                        STAGE_STYLES[stage],
                      )}
                    >
                      {stage}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {ordered.length > 5 && (
            <Link
              to="/hr/recruitment"
              className="inline-block text-xs font-medium text-primary hover:underline"
            >
              +{ordered.length - 5} more recruitment drives
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
