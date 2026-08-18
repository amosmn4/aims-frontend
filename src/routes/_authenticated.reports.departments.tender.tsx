import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { RequireRole } from "@/components/require-role";
import {
  useTenders,
  useTenderPipelineSummary,
  TENDER_STAGE_LABELS,
  TENDER_STAGE_STYLES,
  type TenderStage,
} from "@/features/tender/use-tender";
import { formatCurrency } from "@/features/finance/finance";
import { FunnelChart } from "@/components/funnel-chart";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/reports/departments/tender")({
  head: () => ({ meta: [{ title: "Tender Report — AIMS" }] }),
  component: TenderReport,
});

const FUNNEL_STAGES: TenderStage[] = [
  "identified",
  "applying",
  "submitted",
  "won",
  "lost",
  "withdrawn",
];
const FUNNEL_COLORS: Record<string, string> = {
  identified: "#8C8C8C",
  applying: "#085599",
  submitted: "#F5821F",
  won: "#2E9E4F",
  lost: "#D64545",
  withdrawn: "#94a3b8",
};

// Exported so the Tender department hub (_authenticated.tender.tsx) can embed this report as a
// tab alongside the rest of the tender workflow.
export function TenderReport() {
  return (
    <RequireRole
      roles={["tender"]}
      message="The Tender report is restricted to the Tender team, CEO and System Administrator."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">Tender</div>
            <div className="text-xs text-muted-foreground">
              Bid pipeline summary · win rate, active value, recent activity.
            </div>
          </div>
          <Link to="/tender" className="text-xs text-primary hover:underline">
            Open Tender workspace
          </Link>
        </div>
        <PipelineSummary />
        <RecentTenders />
      </div>
    </RequireRole>
  );
}

function PipelineSummary() {
  const summaryQ = useTenderPipelineSummary();
  const summary = summaryQ.data ?? [];
  const totalTenders = summary.reduce((sum, s) => sum + s.count, 0);
  const wonCount = summary.find((s) => s.stage === "won")?.count ?? 0;
  const lostCount = summary.find((s) => s.stage === "lost")?.count ?? 0;
  const winRate = wonCount + lostCount > 0 ? wonCount / (wonCount + lostCount) : null;
  const pipelineValue = summary
    .filter((s) => s.stage === "identified" || s.stage === "applying" || s.stage === "submitted")
    .reduce((sum, s) => sum + s.total_value, 0);

  // Pass-through funnel — see _authenticated.tender.index.tsx's identical comment.
  const funnelData = FUNNEL_STAGES.map((s) => ({
    stage: TENDER_STAGE_LABELS[s],
    value: summary.find((r) => r.stage === s)?.cumulative_count ?? 0,
    color: FUNNEL_COLORS[s],
  }));

  return (
    <div className="rounded-lg border bg-card p-4">
      {summaryQ.isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : totalTenders === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center">
          No tenders recorded yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 min-w-0 overflow-hidden">
            <FunnelChart stages={funnelData} formatValue={(v) => v.toLocaleString()} />
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Pipeline value
              </div>
              <div className="text-xl font-semibold tabular-nums">
                {formatCurrency(pipelineValue)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Win rate</div>
              <div className="text-xl font-semibold tabular-nums">
                {winRate != null ? `${(winRate * 100).toFixed(0)}%` : "—"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecentTenders() {
  const tendersQ = useTenders();
  const rows = (tendersQ.data ?? []).slice(0, 5);

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-sm font-semibold mb-2">Recent tenders</div>
      {tendersQ.isLoading ? (
        <div className="py-4 flex justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2">No tenders yet.</div>
      ) : (
        <div className="divide-y">
          {rows.map((t) => (
            <Link
              key={t.id}
              to="/tender/$tenderId"
              params={{ tenderId: t.id }}
              className="flex items-center gap-2 py-2 hover:bg-secondary/50 rounded px-1"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{t.title}</div>
                <div className="text-[0.6875rem] text-muted-foreground">
                  {t.department_name}
                  {(t.client_name ?? t.prospect_client_name) &&
                    ` · ${t.client_name ?? t.prospect_client_name}`}
                </div>
              </div>
              <Badge className={TENDER_STAGE_STYLES[t.stage]} variant="secondary">
                {TENDER_STAGE_LABELS[t.stage]}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
