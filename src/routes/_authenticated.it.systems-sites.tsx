import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Activity, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { confirmDialog } from "@/components/confirm-dialog";
import {
  useItSystems,
  useDeleteItSystem,
  IT_SYSTEM_TYPE_LABELS,
  IT_SYSTEM_STATUS_LABELS,
  IT_SYSTEM_STATUS_STYLES,
  SDLC_STEP_LABELS,
  type ItSystemRow,
} from "@/features/it/use-it-systems";
import {
  useLatestUptimes,
  formatUptimeMonth,
  formatUptimePercent,
  type LatestUptime,
} from "@/features/it/use-uptime";
import { UptimeDialog } from "@/features/it/uptime-dialog";
import { SystemFormDialog } from "@/features/it/systems/system-form-dialog";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/it/systems-sites")({
  head: () => ({ meta: [{ title: "Systems & Sites — AIMS" }] }),
  validateSearch: z.object({ new: z.literal(1).optional().catch(undefined) }),
  component: SystemsSites,
});

function SystemsSites() {
  const { isAdminOrCeo, hasRole } = useAuth();
  const canManage = isAdminOrCeo || hasRole("it");
  const systemsQ = useItSystems();
  const deleteSystem = useDeleteItSystem();
  const [editing, setEditing] = useState<ItSystemRow | "new" | null>(null);
  const [uptimeFor, setUptimeFor] = useState<ItSystemRow | null>(null);
  const { new: openNew } = Route.useSearch();
  const navigate = Route.useNavigate();
  const systems = systemsQ.data ?? [];

  // ?new=1 opens the add form once, then drops the flag from the URL.
  useEffect(() => {
    if (openNew !== 1) return;
    if (canManage) setEditing("new");
    navigate({ search: {}, replace: true });
  }, [openNew, canManage, navigate]);
  const latestUptime = useLatestUptimes(systems.map((s) => s.id));

  const handleDelete = async (s: ItSystemRow) => {
    const ok = await confirmDialog({
      title: `Delete "${s.name}"?`,
      description: `${s.name} and everything recorded against it — steps, features, uptime and files — will be removed. This can't be undone.`,
      confirmLabel: "Delete system",
      destructive: true,
    });
    if (!ok) return;
    deleteSystem.mutate(s.id, {
      onSuccess: () => toast.success(`${s.name} deleted`),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't delete it"),
    });
  };

  const addButton = (
    <Button size="sm" onClick={() => setEditing("new")}>
      <Plus className="h-4 w-4 mr-1" /> New system or site
    </Button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Systems & Sites"
        description="What IT builds and looks after — websites, internal systems and integrations. Open one to see what it does, how it's built and how far along it is."
        actions={canManage ? addButton : undefined}
      />
      {!canManage && <ViewOnlyBanner area="Systems & Sites" />}

      {systemsQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : systemsQ.isError ? (
        <LoadError
          what="systems and sites"
          error={systemsQ.error}
          onRetry={() => systemsQ.refetch()}
        />
      ) : systems.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <span>No systems or sites yet</span>
          {canManage && addButton}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Latest uptime</TableHead>
                  <TableHead className="w-44">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systems.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link
                        to="/it/systems-sites/$systemId"
                        params={{ systemId: s.id }}
                        className="text-left font-medium text-primary hover:underline"
                      >
                        {s.name}
                      </Link>
                      {s.purpose && (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {s.purpose}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{IT_SYSTEM_TYPE_LABELS[s.type]}</TableCell>
                    <TableCell>
                      <Badge className={IT_SYSTEM_STATUS_STYLES[s.status]} variant="secondary">
                        {IT_SYSTEM_STATUS_LABELS[s.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.owner ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      <ProgressCell system={s} />
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      <UptimeCell entry={latestUptime[s.id]} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant={canManage ? "outline" : "ghost"}
                          className="h-8"
                          onClick={() => setUptimeFor(s)}
                        >
                          <Activity className="h-3.5 w-3.5 mr-1" />
                          {canManage ? "Record uptime" : "Uptime history"}
                        </Button>
                        {canManage && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Edit ${s.name}`}
                              onClick={() => setEditing(s)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-muted-foreground hover:text-destructive"
                              aria-label={`Delete ${s.name}`}
                              disabled={deleteSystem.isPending}
                              onClick={() => handleDelete(s)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <SystemFormDialog
        value={editing}
        onClose={() => setEditing(null)}
        onSaved={(id) => {
          if (editing === "new")
            navigate({ to: "/it/systems-sites/$systemId", params: { systemId: id } });
        }}
      />
      <UptimeDialog system={uptimeFor} canManage={canManage} onClose={() => setUptimeFor(null)} />
    </div>
  );
}

function ProgressCell({ system }: { system: ItSystemRow }) {
  if (system.currentStage == null && system.progressPercent == null) {
    return <span className="text-muted-foreground">Not tracked</span>;
  }
  return (
    <span>
      {system.currentStage ? SDLC_STEP_LABELS[system.currentStage] : "In progress"}
      {system.progressPercent != null && (
        <span className="text-muted-foreground tabular-nums"> · {system.progressPercent}%</span>
      )}
    </span>
  );
}

function UptimeCell({ entry }: { entry?: LatestUptime }) {
  if (entry?.isLoading) {
    return (
      <Loader2
        className="h-3.5 w-3.5 animate-spin text-muted-foreground"
        aria-label="Loading uptime"
      />
    );
  }
  if (entry?.isError) return <span className="text-destructive">Couldn't load</span>;
  if (!entry?.record) return <span className="text-muted-foreground">Not recorded</span>;
  return (
    <span className="tabular-nums">
      {formatUptimePercent(entry.record.uptimePercent)}
      <span className="text-muted-foreground"> · {formatUptimeMonth(entry.record.month)}</span>
    </span>
  );
}
