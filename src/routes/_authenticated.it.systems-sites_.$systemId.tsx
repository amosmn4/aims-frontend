import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Activity, ArrowLeft, ExternalLink, LifeBuoy, Loader2, Pencil } from "lucide-react";
import {
  useItSystem,
  IT_SYSTEM_STATUS_LABELS,
  IT_SYSTEM_STATUS_STYLES,
  IT_SYSTEM_TYPE_LABELS,
  SDLC_STEP_HINTS,
  SDLC_STEP_LABELS,
  type ItSystemDetail,
} from "@/features/it/use-it-systems";
import { formatUptimeMonth, formatUptimePercent } from "@/features/it/use-uptime";
import { UptimeDialog } from "@/features/it/uptime-dialog";
import { SystemFormDialog } from "@/features/it/systems/system-form-dialog";
import { SystemPurposeCard } from "@/features/it/systems/system-purpose-card";
import { SystemTagsCard } from "@/features/it/systems/system-tags-card";
import { SystemStepsCard } from "@/features/it/systems/system-steps-card";
import { SystemFeaturesCard } from "@/features/it/systems/system-features-card";
import { AttachmentsPanel } from "@/features/documents/attachments-panel";
import { EntityBreadcrumb } from "@/components/entity-breadcrumb";
import { ActionHint } from "@/components/help-link";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/it/systems-sites_/$systemId")({
  head: () => ({ meta: [{ title: "System or site — AIMS" }] }),
  component: SystemDetailPage,
});

function BackLink() {
  return (
    <Button size="sm" variant="outline" asChild>
      <Link to="/it/systems-sites">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Systems & Sites
      </Link>
    </Button>
  );
}

function SystemDetailPage() {
  const { systemId } = Route.useParams();
  const { isAdminOrCeo, hasRole } = useAuth();
  const canManage = isAdminOrCeo || hasRole("it");
  const systemQ = useItSystem(systemId);
  const [editing, setEditing] = useState(false);
  const [uptimeOpen, setUptimeOpen] = useState(false);

  if (systemQ.isLoading) {
    return (
      <div className="flex justify-center py-16" role="status" aria-label="Loading the system">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const system = systemQ.data;
  if (systemQ.isError || !system) {
    return (
      <div className="space-y-4">
        <BackLink />
        <LoadError
          what="this system or site"
          error={systemQ.error}
          onRetry={() => systemQ.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <EntityBreadcrumb
          segments={[{ label: "Systems & sites", to: "/it/systems-sites" }, { label: system.name }]}
        />
        <BackLink />
      </div>

      {!canManage && <ViewOnlyBanner area="Systems & sites" action="change anything here" />}

      <SystemHeader
        system={system}
        canManage={canManage}
        onEdit={() => setEditing(true)}
        onUptime={() => setUptimeOpen(true)}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SystemPurposeCard system={system} canManage={canManage} />
          <SystemStepsCard system={system} canManage={canManage} />
          <SystemFeaturesCard system={system} canManage={canManage} />
        </div>

        <div className="space-y-4">
          <SystemTagsCard
            systemId={system.id}
            field="techStack"
            title="Tech stack"
            hint="What it's built with."
            names={system.techStack}
            placeholder="e.g. React"
            addLabel="Add to tech stack"
            emptyText="Nothing listed yet."
            canManage={canManage}
          />
          <SystemTagsCard
            systemId={system.id}
            field="tools"
            title="Tools"
            hint="What the team uses to build and run it."
            names={system.tools}
            placeholder="e.g. GitHub"
            addLabel="Add tool"
            emptyText="Nothing listed yet."
            canManage={canManage}
          />
          <TicketsCard system={system} />
          <UptimeCard system={system} canManage={canManage} onOpen={() => setUptimeOpen(true)} />
          <section className="rounded-lg border bg-card p-4">
            <AttachmentsPanel
              resourceType="it_system"
              resourceId={system.id}
              canManage={canManage}
            />
            <ActionHint className="mt-2">
              Keep this system's write-ups and hand-over notes here.
            </ActionHint>
          </section>
        </div>
      </div>

      <SystemFormDialog value={editing ? system : null} onClose={() => setEditing(false)} />
      <UptimeDialog
        system={uptimeOpen ? system : null}
        canManage={canManage}
        onClose={() => setUptimeOpen(false)}
      />
    </div>
  );
}

function SystemHeader({
  system,
  canManage,
  onEdit,
  onUptime,
}: {
  system: ItSystemDetail;
  canManage: boolean;
  onEdit: () => void;
  onUptime: () => void;
}) {
  const links = [
    { url: system.liveUrl, label: "Open the site" },
    { url: system.repoUrl, label: "Open the code" },
    { url: system.docsUrl, label: "Open the documentation" },
  ].filter((l): l is { url: string; label: string } => !!l.url);
  const percent = system.progressPercent;
  const step = system.currentStage;

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">{system.name}</h1>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {IT_SYSTEM_TYPE_LABELS[system.type]}
            {system.owner ? ` · Looked after by ${system.owner}` : " · No owner set"}
          </div>
          {system.notes && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{system.notes}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className={IT_SYSTEM_STATUS_STYLES[system.status]}>
            {IT_SYSTEM_STATUS_LABELS[system.status]}
          </Badge>
          <Button size="sm" variant="outline" onClick={onUptime}>
            <Activity className="mr-1 h-3.5 w-3.5" />
            {canManage ? "Record uptime" : "Uptime history"}
          </Button>
          {canManage && (
            <Button size="sm" onClick={onEdit}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit details
            </Button>
          )}
        </div>
      </div>

      {links.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              {link.label}
            </a>
          ))}
        </div>
      )}

      {percent != null || step ? (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {step
                ? `Now on ${SDLC_STEP_LABELS[step]} — ${SDLC_STEP_HINTS[step].toLowerCase()}`
                : "How far along it is"}
            </span>
            <span className="text-sm font-medium tabular-nums">
              {percent == null ? "Not set" : `${percent}%`}
            </span>
          </div>
          <Progress value={percent ?? 0} aria-label={`${percent ?? 0}% done`} />
        </div>
      ) : (
        canManage && (
          <ActionHint>
            Use Edit details to record which step it's on and how far along it is.
          </ActionHint>
        )
      )}
    </div>
  );
}

function TicketsCard({ system }: { system: ItSystemDetail }) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Tickets</h2>
        <p className="text-xs text-muted-foreground">Problems people reported about this.</p>
      </div>
      <p className="text-sm">
        <span className="font-medium tabular-nums">{system.openTickets}</span> still open
        <span className="text-muted-foreground"> · {system.ticketCount} in total</span>
      </p>
      <Button size="sm" variant="outline" asChild>
        <Link to="/it/tickets" search={{ system: system.id }}>
          <LifeBuoy className="mr-1 h-3.5 w-3.5" /> See tickets for this system
        </Link>
      </Button>
    </section>
  );
}

function UptimeCard({
  system,
  canManage,
  onOpen,
}: {
  system: ItSystemDetail;
  canManage: boolean;
  onOpen: () => void;
}) {
  const latest = system.latestUptime;
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Uptime</h2>
        <p className="text-xs text-muted-foreground">
          How much of the month it was up and working.
        </p>
      </div>
      {latest ? (
        <div>
          <p className="text-sm">
            <span className="font-medium tabular-nums">
              {formatUptimePercent(latest.uptimePercent)}
            </span>
            <span className="text-muted-foreground"> · {formatUptimeMonth(latest.month)}</span>
          </p>
          {latest.notes && <p className="mt-1 text-xs text-muted-foreground">{latest.notes}</p>}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No month recorded yet.</p>
      )}
      <Button size="sm" variant="outline" onClick={onOpen}>
        <Activity className="mr-1 h-3.5 w-3.5" />
        {canManage ? "Record uptime" : "Uptime history"}
      </Button>
    </section>
  );
}
