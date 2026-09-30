import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_STYLES,
  useCampaigns,
} from "@/features/marketing/use-campaigns";
import { useLeadInsights } from "@/features/marketing/lead-insights";
import { NewCampaignDialog } from "@/features/marketing/new-campaign-dialog";
import { formatCurrency } from "@/features/finance/finance";
import { LoadError } from "@/components/load-error";
import { formatDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";

const RUNNING = new Set(["active", "planned"]);

/** What each campaign costs and what it brings back in leads and clients. */
export function CampaignResultsPanel({ canManage }: { canManage: boolean }) {
  const campaignsQ = useCampaigns();
  const { leads } = useLeadInsights();
  const campaigns = campaignsQ.data ?? [];
  const running = campaigns.filter((c) => RUNNING.has(c.status));
  const shown = [...running, ...campaigns.filter((c) => !RUNNING.has(c.status))].slice(0, 6);
  const runningSpend = running.reduce((sum, c) => sum + (c.budget ?? 0), 0);
  const leadsFromCampaigns = leads.filter((l) => l.campaign_id).length;

  return (
    <section className="rounded-xl border bg-card" aria-labelledby="campaigns-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="campaigns-heading" className="text-sm font-semibold">
          Campaigns and what they bring in
        </h2>
        <div className="flex items-center gap-3">
          <Link
            to="/marketing/campaigns"
            className="text-xs font-medium text-primary hover:underline"
          >
            All campaigns
          </Link>
          {canManage && <NewCampaignDialog />}
        </div>
      </div>

      {campaignsQ.isError ? (
        <div className="p-4">
          <LoadError
            what="campaigns"
            error={campaignsQ.error}
            onRetry={() => campaignsQ.refetch()}
          />
        </div>
      ) : campaignsQ.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-sm font-medium">No campaigns yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            A campaign is anything you run to bring in work — a webinar, an advert, an email push.
            Add one, then link new leads to it to see what it brings back.
          </p>
          {canManage && <NewCampaignDialog />}
        </div>
      ) : (
        <div className="p-4">
          <p className="mb-3 text-xs text-muted-foreground">
            {running.length} running · {formatCurrency(runningSpend)} budgeted ·{" "}
            {leadsFromCampaigns} lead{leadsFromCampaigns === 1 ? "" : "s"} came from a campaign
          </p>
          <ul className="divide-y">
            {shown.map((c) => {
              const became = leads.filter(
                (l) => l.campaign_id === c.id && l.stage === "converted",
              ).length;
              const perLead = c.budget && c.leadsCount > 0 ? c.budget / c.leadsCount : null;
              return (
                <li key={c.id}>
                  <Link
                    to="/marketing/campaigns"
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 hover:bg-secondary/40"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{c.name}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            CAMPAIGN_STATUS_STYLES[c.status],
                          )}
                        >
                          {CAMPAIGN_STATUS_LABELS[c.status]}
                        </span>
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {c.channel ?? "No channel set"}
                        {c.endDate ? ` · ends ${formatDate(c.endDate)}` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-4 text-right">
                      <span>
                        <span className="block text-sm font-semibold tabular-nums">
                          {c.budget !== null ? formatCurrency(c.budget) : "—"}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {perLead !== null ? `${formatCurrency(perLead)} a lead` : "No budget set"}
                        </span>
                      </span>
                      <span>
                        <span className="block text-sm font-semibold tabular-nums">
                          {c.leadsCount}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {became} became clients
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
