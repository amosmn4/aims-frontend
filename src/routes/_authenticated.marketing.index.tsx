import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Eye, Megaphone, Target, TrendingUp, Users } from "lucide-react";
import { useWebsiteAnalytics } from "@/features/marketing/use-website-analytics";
import { useLeadInsights } from "@/features/marketing/lead-insights";
import { LeadPipelinePanel } from "@/features/marketing/lead-pipeline-panel";
import { LeadTrendPanel } from "@/features/marketing/lead-trend-panel";
import { CampaignResultsPanel } from "@/features/marketing/campaign-results-panel";
import { BlogPerformancePanel } from "@/features/marketing/blog-performance-panel";
import { WebsiteSnapshotPanel } from "@/features/marketing/website-snapshot-panel";
import { NewLeadDialog } from "@/features/marketing/new-lead-dialog";
import { OwnWorkPanels } from "@/features/my-work/own-work-panels";
import { PageHeader } from "@/components/app-shell";
import { QuickLinks } from "@/components/quick-links";
import { SectionHeading } from "@/components/section-heading";
import { DEPARTMENT_QUICK_LINKS } from "@/lib/department-quick-links";
import { Button } from "@/components/ui/button";
import { StatLink } from "@/components/stat-link";
import { ActionHint } from "@/components/help-link";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/marketing/")({
  head: () => ({ meta: [{ title: "Marketing — AIMS" }] }),
  component: MarketingOverview,
});

function MarketingOverview() {
  const { isAdminOrCeo, hasRole } = useAuth();
  const canManage = isAdminOrCeo || hasRole("marketing");
  const navigate = useNavigate();
  const openLead = (id: string) => navigate({ to: "/marketing/leads", search: { lead: id } });

  const { leads, open, converted, lost, conversionRate, addedThisMonth, addedLastMonth } =
    useLeadInsights();
  const analyticsQ = useWebsiteAnalytics();
  const snapshot = analyticsQ.data?.snapshot ?? null;
  const change = addedThisMonth - addedLastMonth;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Marketing"
        description="Bringing in new work: who has shown interest, what the campaigns are doing, and who is reading us."
        actions={
          canManage ? (
            <>
              <Button variant="outline" asChild>
                <Link to="/marketing/leads">
                  <Target className="mr-1 h-4 w-4" /> Manage leads
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/marketing/campaigns">
                  <Megaphone className="mr-1 h-4 w-4" /> Manage campaigns
                </Link>
              </Button>
              <NewLeadDialog onCreated={openLead} />
            </>
          ) : undefined
        }
      />

      {canManage ? (
        <ActionHint topic="convert lead to client request">
          When a lead is ready, use Convert to client request so Operations can route it.
        </ActionHint>
      ) : (
        <ViewOnlyBanner area="Marketing" action="add leads or campaigns" />
      )}

      <section aria-labelledby="mk-glance">
        <SectionHeading id="mk-glance">At a glance</SectionHeading>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatLink
            to="/marketing/leads"
            label="Leads to work on"
            value={open.length}
            hint={`${leads.length} lead${leads.length === 1 ? "" : "s"} in total`}
            icon={Users}
          />
          <StatLink
            to="/marketing/leads"
            label="New leads this month"
            value={addedThisMonth}
            hint={
              change === 0
                ? `Same as last month (${addedLastMonth})`
                : `${Math.abs(change)} ${change > 0 ? "more" : "fewer"} than last month`
            }
            icon={TrendingUp}
            tone={change > 0 ? "positive" : change < 0 ? "warning" : "default"}
          />
          <StatLink
            to="/marketing/leads"
            label="Leads that became clients"
            value={conversionRate === null ? "—" : `${conversionRate}%`}
            hint={`${converted.length} won · ${lost.length} lost`}
            icon={CheckCircle2}
            emptyText={conversionRate === null ? "No lead has been decided yet" : undefined}
          />
          <StatLink
            to="/marketing/website-analytics"
            label="Website visitors"
            value={snapshot ? snapshot.visitors.toLocaleString() : "—"}
            hint="Last reported period"
            icon={Eye}
            emptyText={snapshot ? undefined : "Website analytics isn't connected yet"}
          />
        </div>
      </section>

      <QuickLinks links={DEPARTMENT_QUICK_LINKS.marketing} />

      <div className="grid gap-4 lg:grid-cols-2">
        <LeadPipelinePanel canManage={canManage} onOpenLead={openLead} />
        <LeadTrendPanel />
      </div>

      <CampaignResultsPanel canManage={canManage} />

      <div className="grid gap-4 lg:grid-cols-2">
        <BlogPerformancePanel />
        <WebsiteSnapshotPanel />
      </div>

      <OwnWorkPanels departmentCode="marketing" role="marketing" />
    </div>
  );
}
