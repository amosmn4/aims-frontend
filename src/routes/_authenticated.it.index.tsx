import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Activity, Hammer, Laptop, LifeBuoy, Loader2, Plus, Server, Timer } from "lucide-react";
import {
  useProjects,
  PROJECT_STATUS_LABELS,
  SDLC_STAGES,
  SDLC_STAGE_LABELS,
  type SdlcStage,
} from "@/features/projects/use-projects";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { useItSystems } from "@/features/it/use-it-systems";
import { formatUptimePercent, useLatestUptimes } from "@/features/it/use-uptime";
import { useTicketInsights } from "@/features/it/ticket-insights";
import { TicketPressurePanel } from "@/features/it/ticket-pressure-panel";
import { TicketFlowChart } from "@/features/it/ticket-flow-chart";
import { SystemsHealthPanel } from "@/features/it/systems-health-panel";
import { InventoryAttentionPanel } from "@/features/it/inventory-attention-panel";
import { HrmsLicencesPanel } from "@/features/it/hrms-licences-panel";
import { TicketFormDialog } from "@/features/it/tickets/ticket-form-dialog";
import { NewProjectDialog } from "@/features/projects/new-project-dialog";
import { MyWorkPanel } from "@/features/my-work/my-work-panel";
import { StartHerePanel } from "@/features/start-here/start-here-panel";
import { PageHeader } from "@/components/app-shell";
import { QuickLinks } from "@/components/quick-links";
import { SectionHeading } from "@/components/section-heading";
import { DEPARTMENT_QUICK_LINKS } from "@/lib/department-quick-links";
import { StatLink } from "@/components/stat-link";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/it/")({
  head: () => ({ meta: [{ title: "IT Overview — AIMS" }] }),
  component: ItOverview,
});

const BUILDING = new Set(["planning", "active"]);

function ItOverview() {
  const { isAdminOrCeo, hasRole, canWriteDepartment } = useAuth();
  const canManageSystems = isAdminOrCeo || hasRole("it");
  const canAddProjects = canWriteDepartment("it");
  const navigate = useNavigate();
  const [logging, setLogging] = useState(false);

  const departmentsQ = useDepartments();
  const departmentId = departmentsQ.data?.find((d) => d.code === "it")?.id;
  const projectsQ = useProjects({ departmentId, enabled: !!departmentId });
  const systemsQ = useItSystems();
  const { unfinished, breaching, openCount } = useTicketInsights();

  const systems = systemsQ.data ?? [];
  const live = systems.filter((s) => s.status === "active");
  const uptimes = useLatestUptimes(live.map((s) => s.id));
  const measured = live.flatMap((s) => {
    const record = uptimes[s.id]?.record;
    return record ? [record.uptimePercent] : [];
  });
  const averageUptime =
    measured.length > 0 ? measured.reduce((sum, v) => sum + v, 0) / measured.length : null;

  const builds = (projectsQ.data ?? []).filter((p) => BUILDING.has(p.status));
  const byStage = new Map<SdlcStage, number>();
  for (const p of builds) {
    if (p.sdlc_stage) byStage.set(p.sdlc_stage, (byStage.get(p.sdlc_stage) ?? 0) + 1);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Information Technology"
        description="What staff need fixed, how our websites and systems are holding up, and what IT is building."
        actions={
          canManageSystems ? (
            <>
              <Button variant="outline" asChild>
                <Link to="/it/systems-sites">
                  <Server className="mr-1 h-4 w-4" /> Manage systems
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/it/inventory">
                  <Laptop className="mr-1 h-4 w-4" /> Manage inventory
                </Link>
              </Button>
              <Button onClick={() => setLogging(true)}>
                <Plus className="mr-1 h-4 w-4" /> Log a ticket
              </Button>
            </>
          ) : (
            <Button asChild>
              <Link to="/it-help">
                <LifeBuoy className="mr-1 h-4 w-4" /> Ask IT for help
              </Link>
            </Button>
          )
        }
      />

      {!canManageSystems && <ViewOnlyBanner area="IT" action="add systems or work on tickets" />}

      <section aria-labelledby="it-glance">
        <SectionHeading id="it-glance">At a glance</SectionHeading>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatLink
            to="/it/tickets"
            search={{ view: "list" }}
            label="Tickets waiting for IT"
            value={unfinished.length}
            hint={`${openCount} not started yet`}
            icon={LifeBuoy}
            tone={unfinished.length > 0 ? "warning" : "default"}
          />
          <StatLink
            to="/it/tickets"
            search={{ view: "list" }}
            label="Waited longer than we aim to"
            value={breaching.length}
            hint={breaching.length > 0 ? "Pick these up first" : "Everything picked up in time"}
            icon={Timer}
            tone={breaching.length > 0 ? "danger" : "positive"}
          />
          <StatLink
            to="/it/systems-sites"
            label="Websites and systems live"
            value={live.length}
            hint={`${systems.length} listed in total`}
            icon={Server}
          />
          <StatLink
            to="/it/systems-sites"
            label="Average uptime last month"
            value={averageUptime === null ? "—" : formatUptimePercent(averageUptime)}
            hint={`Across ${measured.length} system${measured.length === 1 ? "" : "s"}`}
            icon={Activity}
            tone={averageUptime !== null && averageUptime < 99 ? "warning" : "default"}
            emptyText={averageUptime === null ? "No uptime written down yet" : undefined}
          />
        </div>
      </section>

      <QuickLinks links={DEPARTMENT_QUICK_LINKS.it} />

      <div className="grid gap-4 lg:grid-cols-2">
        <TicketPressurePanel
          canLogTickets={canManageSystems}
          onLogTicket={() => setLogging(true)}
        />
        <SystemsHealthPanel canManage={canManageSystems} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TicketFlowChart />
        <section className="rounded-xl border bg-card" aria-labelledby="builds-heading">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <h2 id="builds-heading" className="flex items-center gap-1.5 text-sm font-semibold">
              <Hammer className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> What IT is
              building
            </h2>
            {departmentId && (
              <Link
                to="/projects"
                search={{ dept: departmentId, status: "active" }}
                className="text-xs font-medium text-primary hover:underline"
              >
                All IT projects
              </Link>
            )}
          </div>

          {projectsQ.isError ? (
            <div className="p-4">
              <LoadError
                what="IT projects"
                error={projectsQ.error}
                onRetry={() => projectsQ.refetch()}
              />
            </div>
          ) : departmentsQ.isLoading || projectsQ.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : builds.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <p className="text-sm font-medium">Nothing being built right now</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                A new website, an integration or an internal system goes here, with the stage it has
                reached.
              </p>
              {canAddProjects && departmentId && (
                <NewProjectDialog fixedDepartmentId={departmentId} />
              )}
            </div>
          ) : (
            <div className="space-y-3 p-4">
              <ul className="flex flex-wrap gap-1.5">
                {SDLC_STAGES.map((stage) => (
                  <li key={stage}>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                        (byStage.get(stage) ?? 0) > 0
                          ? "border-primary/40 text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {SDLC_STAGE_LABELS[stage]}
                      <span className="font-semibold tabular-nums">{byStage.get(stage) ?? 0}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <ul className="divide-y">
                {builds.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: p.id }}
                      className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-secondary/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {p.client_name ?? "Internal"} · {PROJECT_STATUS_LABELS[p.status]}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs">
                        {p.sdlc_stage ? SDLC_STAGE_LABELS[p.sdlc_stage] : "Stage not set"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <InventoryAttentionPanel />
        <HrmsLicencesPanel />
      </div>

      <StartHerePanel departmentCode="it" />
      <MyWorkPanel departmentCode="it" />

      <TicketFormDialog
        open={logging}
        mode="new"
        canManage={canManageSystems}
        onClose={() => setLogging(false)}
        onSaved={(id) => {
          setLogging(false);
          navigate({ to: "/it/tickets", search: { ticket: id } });
        }}
      />
    </div>
  );
}
