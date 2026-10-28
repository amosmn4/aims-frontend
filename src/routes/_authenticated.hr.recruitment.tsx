import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Pencil, Plus, UserCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  useRecruitmentEngagements,
  RECRUITMENT_SERVICE_LINE,
  FUNNEL_STAGE_LABELS,
  type RecruitmentEngagementRow,
} from "@/features/hr/use-recruitment";
import { RecruitmentFunnelPanel, FUNNEL_STAGES } from "@/features/hr/recruitment-funnel-panel";
import { RecruitmentPlacementsPanel } from "@/features/hr/recruitment-placements-panel";
import { useHrDepartment } from "@/features/hr/use-hr";
import { NewProjectDialog } from "@/features/projects/new-project-dialog";
import { useHereHref } from "@/features/projects/project-back-link";
import { PageHeader } from "@/components/app-shell";
import { ActionHint } from "@/components/help-link";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { formatDate } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/hr/recruitment")({
  head: () => ({ meta: [{ title: "Recruitment — AIMS" }] }),
  component: RecruitmentPage,
});

function RecruitmentPage() {
  const { canWriteDepartment } = useAuth();
  const canManage = canWriteDepartment("hr");
  const { department } = useHrDepartment();
  const engagementsQ = useRecruitmentEngagements();
  const here = useHereHref();
  const [editing, setEditing] = useState<RecruitmentEngagementRow | null>(null);
  const [numbersDirty, setNumbersDirty] = useState(false);
  const { guardClose } = useUnsavedChanges(!!editing && numbersDirty);
  const engagements = useMemo(() => engagementsQ.data ?? [], [engagementsQ.data]);

  const closeEditing = () => {
    setNumbersDirty(false);
    setEditing(null);
  };

  const totals = useMemo(
    () =>
      Object.fromEntries(
        FUNNEL_STAGES.map((k) => [k, engagements.reduce((s, e) => s + (e.funnel?.[k] ?? 0), 0)]),
      ) as Record<(typeof FUNNEL_STAGES)[number], number>,
    [engagements],
  );
  const placementRate = totals.applications_received
    ? Math.round((totals.placed / totals.applications_received) * 1000) / 10
    : null;

  const newProject =
    canManage && department ? (
      <NewProjectDialog
        fixedDepartmentId={department.id}
        defaultServiceLineCode={RECRUITMENT_SERVICE_LINE}
        trigger={
          <Button>
            <Plus className="h-4 w-4 mr-1" /> New recruitment project
          </Button>
        }
      />
    ) : null;

  const missingProjectHint = (
    <ActionHint topic="recruitment service line">
      Don&apos;t see a project? It needs the Recruitment service line.{" "}
      <Link
        to="/hr/projects"
        search={{ notLine: RECRUITMENT_SERVICE_LINE, status: "all" }}
        className="font-medium text-primary hover:underline"
      >
        Show HR projects without it
      </Link>
    </ActionHint>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Recruitment"
        description="Candidate numbers for every project on the Recruitment service line."
        actions={newProject}
      />
      {!canManage && <ViewOnlyBanner area="Recruitment" action="update numbers or placements" />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {FUNNEL_STAGES.map((k) => (
          <div key={k} className="rounded-lg border bg-card p-4">
            <div className="text-xs text-muted-foreground">{FUNNEL_STAGE_LABELS[k]}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {engagementsQ.isSuccess ? totals[k] : "—"}
            </div>
          </div>
        ))}
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Placement rate</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {placementRate != null ? `${placementRate}%` : "—"}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {missingProjectHint}
        <div className="overflow-hidden rounded-lg border bg-card">
          {engagementsQ.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : engagementsQ.isError ? (
            <LoadError
              what="recruitment projects"
              error={engagementsQ.error}
              onRetry={() => engagementsQ.refetch()}
              className="m-4"
            />
          ) : engagements.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-primary">
                <UserCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="text-sm font-medium">No recruitment projects yet</div>
              <p className="max-w-sm text-sm text-muted-foreground">
                Projects on the Recruitment service line show up here automatically.
              </p>
              {newProject}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-4 py-2.5 font-medium">Project</th>
                    {FUNNEL_STAGES.map((k) => (
                      <th key={k} className="px-3 py-2.5 text-right font-medium">
                        {FUNNEL_STAGE_LABELS[k]}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 font-medium">Updated</th>
                    <th className="w-12">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {engagements.map((e) => (
                    <tr key={e.project_id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          to="/projects/$projectId"
                          params={{ projectId: e.project_id }}
                          search={{ from: here }}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {e.project_name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {e.client_name ?? "No client"}
                        </div>
                      </td>
                      {FUNNEL_STAGES.map((k) => (
                        <td key={k} className="px-3 py-3 text-right tabular-nums">
                          {e.funnel ? (
                            e.funnel[k]
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {formatDate(e.funnel?.updated_at, "Never")}
                      </td>
                      <td className="px-2 py-3">
                        {canManage && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditing(e)}
                            aria-label={`Update numbers for ${e.project_name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && guardClose(closeEditing)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Recruitment numbers</DialogTitle>
            <DialogDescription>{editing?.project_name}</DialogDescription>
          </DialogHeader>
          {editing && (
            <>
              <RecruitmentFunnelPanel
                projectId={editing.project_id}
                canManage={canManage}
                onSaved={closeEditing}
                onDirtyChange={setNumbersDirty}
              />
              <div className="border-t pt-4">
                <RecruitmentPlacementsPanel projectId={editing.project_id} canManage={canManage} />
              </div>
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => guardClose(closeEditing)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
