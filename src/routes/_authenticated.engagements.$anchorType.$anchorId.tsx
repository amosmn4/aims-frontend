import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronRight,
  Eye,
  Loader2,
  Mail,
  Phone,
  StickyNote,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  useEngagement,
  type EngagementAnchorType,
  type EngagementActivity,
} from "@/features/engagements/use-engagement";
import { LoadError } from "@/components/load-error";
import { Thread, type ThreadItem, type ThreadTone } from "@/components/thread/thread";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/engagements/$anchorType/$anchorId")({
  head: () => ({ meta: [{ title: "Activity — AIMS" }] }),
  component: EngagementView,
});

const ACTIVITY_TYPES: Record<string, { label: string; tone: ThreadTone; icon: LucideIcon }> = {
  call: { label: "Call", tone: "primary", icon: Phone },
  email: { label: "Email", tone: "neutral", icon: Mail },
  meeting: { label: "Meeting", tone: "success", icon: Users },
  note: { label: "Note", tone: "neutral", icon: StickyNote },
};

const SOURCE_LABELS: Record<EngagementActivity["source"], string> = {
  lead: "lead",
  request: "client request",
  tender: "tender",
  project: "project",
};

function EngagementView() {
  const { anchorType, anchorId } = Route.useParams();
  const router = useRouter();
  const engagementQ = useEngagement(anchorType as EngagementAnchorType, anchorId);

  if (engagementQ.isLoading) {
    return (
      <div className="py-12 flex justify-center" role="status" aria-label="Loading activity">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  const status = (engagementQ.error as { status?: number } | null)?.status;
  if (engagementQ.isError && status !== 404 && status !== 403) {
    return (
      <LoadError
        what="this activity"
        error={engagementQ.error}
        onRetry={() => engagementQ.refetch()}
      />
    );
  }
  const data = engagementQ.data;
  if (!data) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-8 text-center">
        <p className="text-sm font-medium">
          This record doesn't exist or you don't have access to it.
        </p>
        <Button size="sm" variant="outline" onClick={() => router.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Go back
        </Button>
      </div>
    );
  }

  const { chain, activities } = data;
  const chainSteps: { label: string; title: string; to: string }[] = [];
  if (chain.lead)
    chainSteps.push({ label: "Lead", title: chain.lead.name, to: "/marketing/leads" });
  if (chain.request) {
    chainSteps.push({
      label: "Client request",
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
    chainSteps.push({
      label: "Contract",
      title: chain.contract.contractNumber,
      to: `/clients/contracts/${chain.contract.id}`,
    });
  }
  for (const p of chain.projects) {
    chainSteps.push({ label: "Project", title: p.name, to: `/projects/${p.id}` });
  }

  const onlyProject = chain.projects.length === 1 ? chain.projects[0] : null;
  const sourceLink: Record<EngagementActivity["source"], string | null> = {
    lead: chain.lead ? "/marketing/leads" : null,
    request: chain.request ? `/requests/${chain.request.id}` : null,
    tender: chain.tender ? `/tender/${chain.tender.id}` : null,
    project: null,
  };
  const items: ThreadItem[] = activities.map((a) => {
    const type = ACTIVITY_TYPES[a.type] ?? ACTIVITY_TYPES.note;
    const Icon = type.icon;
    const to = sourceLink[a.source];
    return {
      id: a.id,
      parentId: a.parentId ?? null,
      authorName: a.createdByName ?? "AIMS",
      createdAt: a.occurredAt,
      body: a.summary,
      badge: {
        label: type.label,
        tone: type.tone,
        icon: <Icon className="h-3 w-3" aria-hidden="true" />,
      },
      meta:
        a.source === "project" && onlyProject ? (
          <Link
            to="/projects/$projectId"
            params={{ projectId: onlyProject.id }}
            search={{ view: "comms" }}
            className="text-primary hover:underline"
          >
            On the project
          </Link>
        ) : to ? (
          <Link to={to} className="text-primary hover:underline">
            On the {SOURCE_LABELS[a.source]}
          </Link>
        ) : (
          `On a ${SOURCE_LABELS[a.source]}`
        ),
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Activity</h1>
        <p className="text-xs text-muted-foreground">
          Everything logged on this work, from the first lead or request through to its projects.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold mb-3">How this work progressed</h2>
        {chainSteps.length === 0 ? (
          <div className="text-xs text-muted-foreground">No linked records yet.</div>
        ) : (
          <ol className="flex flex-wrap items-center gap-2">
            {chainSteps.map((step, i) => (
              <li key={`${step.label}-${step.to}`} className="flex items-center gap-2">
                {i > 0 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                )}
                <Link
                  to={step.to}
                  className="flex flex-col rounded-md border px-2.5 py-1.5 text-xs hover:border-primary/50 hover:bg-secondary/40 transition-colors"
                >
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {step.label}
                  </span>
                  <span className="font-medium">{step.title}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="space-y-2">
        <p className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
          To add activity or reply, open the record it belongs to above.
        </p>
        <Thread
          title={`All activity (${activities.length})`}
          items={items}
          newestFirst
          canPost={false}
          onSend={async () => undefined}
          emptyText="Nothing logged on any of these records yet."
        />
      </div>
    </div>
  );
}
