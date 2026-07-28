import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import {
  useEngagement,
  type EngagementAnchorType,
  type EngagementActivity,
} from "@/features/engagements/use-engagement";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/engagements/$anchorType/$anchorId")({
  head: () => ({ meta: [{ title: "Engagement Timeline — AIMS" }] }),
  component: EngagementView,
});

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  note: "Note",
  call: "Call",
  email: "Email",
  meeting: "Meeting",
};

const SOURCE_LABELS: Record<EngagementActivity["source"], string> = {
  lead: "Lead",
  request: "Client Request",
  tender: "Tender",
  project: "Project",
};

const SOURCE_STYLES: Record<EngagementActivity["source"], string> = {
  lead: "bg-accent/15 text-accent",
  request: "bg-primary/10 text-primary",
  tender: "bg-warning/15 text-warning",
  project: "bg-success/15 text-success",
};

function EngagementView() {
  const { anchorType, anchorId } = Route.useParams();
  const engagementQ = useEngagement(anchorType as EngagementAnchorType, anchorId);

  if (engagementQ.isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  const data = engagementQ.data;
  if (!data) return <div className="text-sm text-muted-foreground">Engagement not found.</div>;

  const { chain, activities } = data;
  const chainSteps: { label: string; title: string; to: string }[] = [];
  if (chain.lead) chainSteps.push({ label: "Lead", title: chain.lead.name, to: "/marketing/leads" });
  if (chain.request) {
    chainSteps.push({
      label: "Client Request",
      title: chain.request.referenceNumber ?? chain.request.title,
      to: `/requests/${chain.request.id}`,
    });
  }
  if (chain.tender) {
    chainSteps.push({
      label: "Tender",
      title: chain.tender.referenceNumber ?? chain.tender.title,
      to: `/tender/${chain.tender.id}`,
    });
  }
  if (chain.contract) {
    chainSteps.push({ label: "Contract", title: chain.contract.contractNumber, to: `/clients/contracts/${chain.contract.id}` });
  }
  for (const p of chain.projects) {
    chainSteps.push({ label: "Project", title: p.name, to: `/projects/${p.id}` });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Engagement Timeline</h1>
        <p className="text-xs text-muted-foreground">
          The full story of this engagement, stitched together across every stage it's passed through.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-semibold mb-3">Chain</div>
        {chainSteps.length === 0 ? (
          <div className="text-xs text-muted-foreground">Nothing resolved for this record.</div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {chainSteps.map((step, i) => (
              <div key={`${step.label}-${step.to}`} className="flex items-center gap-2">
                {i > 0 && <span className="text-muted-foreground">→</span>}
                <Link
                  to={step.to}
                  className="flex flex-col rounded-md border px-2.5 py-1.5 text-xs hover:border-primary/50 hover:bg-secondary/40 transition-colors"
                >
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{step.label}</span>
                  <span className="font-medium">{step.title}</span>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-semibold mb-3">Activity ({activities.length})</div>
        {activities.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center">
            No activity logged anywhere in this chain yet.
          </div>
        ) : (
          <div className="divide-y">
            {activities.map((a) => (
              <div key={a.id} className="flex items-start gap-3 py-2.5">
                <Badge variant="secondary" className={SOURCE_STYLES[a.source]}>
                  {SOURCE_LABELS[a.source]}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{a.summary}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {ACTIVITY_TYPE_LABELS[a.type] ?? a.type} · {new Date(a.occurredAt).toLocaleString()}
                    {a.createdByName && ` · ${a.createdByName}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-3 pt-3 border-t">
          This view is read-only — log new activity from whichever record it belongs to, above.
        </p>
      </div>
    </div>
  );
}
