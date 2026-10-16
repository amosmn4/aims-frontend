import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Pencil, Plus, Rocket, Trash2 } from "lucide-react";
import {
  useClientRequests,
  useUpdateClientRequestStage,
  useDeleteClientRequest,
  useClientRequestActivities,
  useLogActivity,
  type ClientRequestRow,
  type ClientRequestStage,
} from "@/features/client-requests/use-client-requests";
import { NewRequestDialog } from "@/features/client-requests/new-request-dialog";
import { EditRequestDialog } from "@/features/client-requests/edit-request-dialog";
import { StartProjectDialog } from "@/features/client-requests/start-project-dialog";
import { formatCurrency } from "@/features/finance/finance";
import { usePermissions } from "@/lib/permissions";
import { useAuth } from "@/lib/auth";
import { confirmDialog } from "@/components/confirm-dialog";
import { LoadError } from "@/components/load-error";
import { ActionHint } from "@/components/help-link";
import { BoardNoMatches, BoardSearch, matchesQuery } from "@/components/pipeline/board-search";
import {
  ENGAGEMENT_PIPELINE_STAGES,
  deptColor,
  initials,
  type PipelineStageDef,
} from "@/features/pipeline/pipeline-theme";
import { Spine } from "@/components/pipeline/spine";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import {
  PipelineDetailSheet,
  KvGrid,
  SectionLabel,
  StageTracker,
} from "@/components/pipeline/detail-sheet";
import { ActivityPane } from "@/components/pipeline/activity-pane";
import { AttachmentsPanel } from "@/features/documents/attachments-panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { askLossReason, isLossStage } from "@/features/pipeline/stage-reasons";

export const Route = createFileRoute("/_authenticated/pipeline/engagements")({
  head: () => ({ meta: [{ title: "Client requests — AIMS" }] }),
  component: EngagementBoard,
});

type DetailTab = "overview" | "activity" | "docs";

const stageLabel = (key: string) =>
  ENGAGEMENT_PIPELINE_STAGES.find((s) => s.key === key)?.label ?? key;

// "New Request" is set by logging; a request only returns there if it's un-routed.
const moveTargetsFor = (r: ClientRequestRow): PipelineStageDef[] =>
  ENGAGEMENT_PIPELINE_STAGES.filter((s) => s.key !== "new" || r.stage === "new");

const isStarted = (r: ClientRequestRow) => !!r.converted_project_id || !!r.converted_contract_id;

/** Asks for the why, then records a lost/withdrawn request. */
function DropOutAction({
  currentStage,
  isPending,
  onSubmit,
}: {
  currentStage: ClientRequestStage;
  isPending: boolean;
  onSubmit: (stage: "lost" | "withdrawn", reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"lost" | "withdrawn">("lost");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  if (currentStage === "lost" || currentStage === "withdrawn") return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-xs underline-offset-2 hover:underline"
        style={{ color: "var(--pipeline-coral)" }}
      >
        Mark as not going ahead
      </button>
    );
  }

  return (
    <form
      className="mt-2 space-y-2 rounded-lg border p-2.5"
      style={{ borderColor: "var(--pipeline-line)" }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!reason.trim()) {
          setError("Say why it isn't going ahead.");
          return;
        }
        onSubmit(stage, reason.trim());
      }}
    >
      <Select value={stage} onValueChange={(v) => setStage(v as "lost" | "withdrawn")}>
        <SelectTrigger className="h-8 w-full text-xs" aria-label="Outcome">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="lost">Lost</SelectItem>
          <SelectItem value="withdrawn">Withdrawn</SelectItem>
        </SelectContent>
      </Select>
      <Textarea
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          setError("");
        }}
        aria-label="Why it isn't going ahead"
        aria-invalid={!!error}
        placeholder="Why isn't it going ahead? (required)"
        className="min-h-[60px] text-xs"
      />
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          className="flex-1"
          style={{ background: "var(--pipeline-coral)" }}
          disabled={isPending}
        >
          Mark as {stage}
        </Button>
      </div>
    </form>
  );
}

// Shared by the central board and every department hub; `departmentId` narrows it to one department.
export function EngagementBoard({ departmentId }: { departmentId?: string } = {}) {
  const perms = usePermissions();
  const { user } = useAuth();
  const canCreateRequest = perms.canManageIntake;
  const requestsQ = useClientRequests({ departmentId });
  const updateStage = useUpdateClientRequestStage();
  const [query, setQuery] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [editing, setEditing] = useState<ClientRequestRow | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [startFor, setStartFor] = useState<ClientRequestRow | null>(null);

  const all = requestsQ.data ?? [];
  const mineCount = user ? all.filter((r) => r.assigned_to_id === user.id).length : 0;
  const requests = all.filter(
    (r) =>
      (!mineOnly || r.assigned_to_id === user?.id) &&
      matchesQuery(
        query,
        r.title,
        r.client_name,
        r.prospect_client_name,
        r.reference_number,
        r.contact_name,
        r.department_name,
      ),
  );
  const counts: Record<string, number> = {};
  for (const s of ENGAGEMENT_PIPELINE_STAGES)
    counts[s.key] = requests.filter((r) => r.stage === s.key).length;

  const open = all.find((r) => r.id === openId) ?? null;
  // Unrouted requests must be routed (Edit request → Department) before they move.
  const canMove = (r: ClientRequestRow) => perms.canEditRequest(r) && !!r.department_id;
  const moveBlockedReason = (r: ClientRequestRow) =>
    !perms.canEditRequest(r)
      ? "Only Operations and the owning department can move requests."
      : "Route this request to a department first: Edit request, then choose a department.";

  const offerStart = async (r: ClientRequestRow) => {
    if (!perms.canOnboardRequest(r) || isStarted(r)) return;
    const ok = await confirmDialog({
      title: "Start the project now?",
      description: `“${r.title}” is Won. Start its project now, or do it later from the request.`,
      confirmLabel: "Start project from request",
      cancelLabel: "Later",
    });
    if (ok) setStartFor(r);
  };

  const moveRequest = async (r: ClientRequestRow, stage: string) => {
    if (stage === r.stage) return;
    if (!canMove(r)) {
      toast.error(moveBlockedReason(r));
      return;
    }
    const label = stageLabel(stage);
    const reason = isLossStage(stage) ? await askLossReason("request", label) : undefined;
    if (reason === null) return;
    updateStage.mutate(
      { id: r.id, stage: stage as ClientRequestStage, lost_reason: reason },
      {
        onSuccess: () => {
          toast.success(`Moved to ${label}`);
          if (stage === "won") void offerStart({ ...r, stage: "won" });
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "The move didn't save"),
      },
    );
  };

  const newRequestButton = (
    <NewRequestDialog
      trigger={
        <Button style={{ background: "var(--pipeline-ink)" }}>
          <Plus className="h-4 w-4 mr-1" /> New client request
        </Button>
      }
      defaultSource="operations"
    />
  );

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="p-title text-lg">Client requests</h1>
          <p className="text-xs" style={{ color: "var(--pipeline-slate)" }}>
            Every client request from logging to Won or Lost. Open a card to work on it.
          </p>
        </div>
        {canCreateRequest ? (
          newRequestButton
        ) : (
          <ActionHint topic="client requests">
            Requests are logged by Operations. Ask them to add one.
          </ActionHint>
        )}
      </div>

      {requestsQ.isLoading ? (
        <div
          className="flex justify-center py-16"
          role="status"
          aria-label="Loading client requests"
        >
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--pipeline-slate)" }} />
        </div>
      ) : requestsQ.isError ? (
        <LoadError
          className="mt-4"
          what="client requests"
          error={requestsQ.error}
          onRetry={() => requestsQ.refetch()}
        />
      ) : all.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm font-medium">No client requests yet</p>
          {canCreateRequest ? (
            newRequestButton
          ) : (
            <p className="text-xs text-muted-foreground">
              Requests are logged by Operations. Ask them to add one.
            </p>
          )}
        </div>
      ) : (
        <>
          <Spine stages={ENGAGEMENT_PIPELINE_STAGES} counts={counts} />
          <div className="flex flex-wrap items-start gap-2">
            <BoardSearch
              value={query}
              onChange={setQuery}
              placeholder="Search client, request, reference or contact"
            />
            {mineCount > 0 && (
              <Button
                type="button"
                variant={mineOnly ? "default" : "outline"}
                aria-pressed={mineOnly}
                onClick={() => setMineOnly((v) => !v)}
              >
                Assigned to me ({mineCount})
              </Button>
            )}
          </div>

          {requests.length === 0 ? (
            <BoardNoMatches
              onClear={() => {
                setQuery("");
                setMineOnly(false);
              }}
            />
          ) : (
            <PipelineBoard
              stages={ENGAGEMENT_PIPELINE_STAGES}
              items={requests}
              getStage={(r) => r.stage}
              getId={(r) => r.id}
              getLabel={(r) => r.client_name ?? r.prospect_client_name ?? r.title}
              onMove={(id, stage) => {
                const target = requests.find((r) => r.id === id);
                if (target) void moveRequest(target, stage);
              }}
              canDrag={canMove}
              moveTargets={moveTargetsFor}
              defaultVisiblePerColumn={5}
              onOpen={(r) => {
                setOpenId(r.id);
                setTab("overview");
              }}
              renderCard={(r) => (
                <EngagementCard
                  r={r}
                  onStart={perms.canOnboardRequest(r) ? () => setStartFor(r) : undefined}
                />
              )}
            />
          )}
        </>
      )}

      {open && (
        <EngagementDetail
          request={open}
          tab={tab}
          onTabChange={setTab}
          onClose={() => setOpenId(null)}
          canManage={perms.canEditRequest(open)}
          canDelete={perms.canManageIntake}
          canMove={canMove(open)}
          moveBlockedReason={moveBlockedReason(open)}
          canStart={perms.canOnboardRequest(open)}
          onMove={(stage) => void moveRequest(open, stage)}
          movePending={updateStage.isPending}
          onStart={() => setStartFor(open)}
          onEdit={() => setEditing(open)}
          onDeleted={() => setOpenId(null)}
        />
      )}

      {editing && <EditRequestDialog request={editing} onClose={() => setEditing(null)} />}

      {startFor && (
        <StartProjectDialog request={startFor} open onOpenChange={(o) => !o && setStartFor(null)} />
      )}
    </div>
  );
}

function EngagementCard({ r, onStart }: { r: ClientRequestRow; onStart?: () => void }) {
  const c = deptColor(r.department_code);
  return (
    <div>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <span className="p-mono text-xs" style={{ color: "var(--pipeline-slate-light)" }}>
          {r.reference_number ?? ""}
        </span>
        <span className="p-chip" style={{ background: c.bg, color: c.text }}>
          {r.department_name ?? "Not routed yet"}
        </span>
      </div>
      <div className="mb-2 text-[14px] font-semibold leading-snug">
        {r.client_name ?? r.prospect_client_name ?? r.title}
      </div>
      <div className="text-xs" style={{ color: "var(--pipeline-slate)" }}>
        {r.title}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="p-mono font-medium">
          {r.estimated_value != null ? formatCurrency(r.estimated_value, r.currency) : "—"}
        </span>
        {r.stage === "won" && (
          <span
            className="rounded-md px-1.5 py-0.5 text-xs font-semibold"
            style={{ background: "var(--pipeline-teal-soft)", color: "var(--pipeline-teal)" }}
          >
            Won
          </span>
        )}
        {(r.stage === "lost" || r.stage === "withdrawn") && (
          <span
            className="rounded-md px-1.5 py-0.5 text-xs font-semibold"
            style={{ background: "var(--pipeline-coral-soft)", color: "var(--pipeline-coral)" }}
          >
            {stageLabel(r.stage)}
          </span>
        )}
      </div>
      <div
        className="mt-2 flex items-center justify-between border-t pt-2"
        style={{ borderColor: "var(--pipeline-line)", borderStyle: "dashed" }}
      >
        <div className="flex items-center gap-1.5">
          <div className="mini-avatar" aria-hidden="true">
            {initials(r.assigned_to_name)}
          </div>
          <span className="text-xs" style={{ color: "var(--pipeline-slate)" }}>
            {r.assigned_to_name ?? "Unassigned"}
          </span>
        </div>
      </div>
      {r.stage === "won" && !isStarted(r) && onStart && (
        <button
          type="button"
          className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-md border-none py-1.5 text-xs font-semibold text-white"
          style={{ background: "var(--pipeline-teal)" }}
          onClick={(e) => {
            e.stopPropagation();
            onStart();
          }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Rocket className="h-3.5 w-3.5" aria-hidden="true" /> Start project from request
        </button>
      )}
      {isStarted(r) && (
        <div
          className="mt-2.5 flex items-center gap-1 text-xs font-semibold"
          style={{ color: "var(--pipeline-teal)" }}
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          {r.converted_project_id ? "Project started" : "Contract created"}
        </div>
      )}
    </div>
  );
}

function EngagementDetail({
  request,
  tab,
  onTabChange,
  onClose,
  canManage,
  canDelete,
  canMove,
  moveBlockedReason,
  canStart,
  onMove,
  movePending,
  onStart,
  onEdit,
  onDeleted,
}: {
  request: ClientRequestRow;
  tab: DetailTab;
  onTabChange: (t: DetailTab) => void;
  onClose: () => void;
  canManage: boolean;
  canDelete: boolean;
  canMove: boolean;
  moveBlockedReason: string;
  canStart: boolean;
  onMove: (stage: string) => void;
  movePending: boolean;
  onStart: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const deleteRequest = useDeleteClientRequest();
  const updateStage = useUpdateClientRequestStage();
  const activitiesQ = useClientRequestActivities(request.id);
  const logActivity = useLogActivity(request.id);

  const handleDelete = async () => {
    const ok = await confirmDialog({
      title: `Delete "${request.title}"?`,
      description: "This removes the request and its activity. This can't be undone.",
      confirmLabel: "Delete client request",
      destructive: true,
    });
    if (!ok) return;
    deleteRequest.mutate(request.id, {
      onSuccess: () => {
        toast.success("Client request deleted");
        onDeleted();
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
    });
  };

  const idx = ENGAGEMENT_PIPELINE_STAGES.findIndex((s) => s.key === request.stage);
  const c = deptColor(request.department_code);
  const isWon = request.stage === "won";
  const started = isStarted(request);
  const closed = request.stage === "lost" || request.stage === "withdrawn";

  return (
    <PipelineDetailSheet
      open
      onClose={onClose}
      refId={request.reference_number ?? ""}
      title={request.client_name ?? request.prospect_client_name ?? request.title}
      tags={
        <>
          <span className="p-chip" style={{ background: c.bg, color: c.text }}>
            {request.department_name ?? "Not routed yet"}
          </span>
          <span
            className="p-chip"
            style={{ background: "var(--pipeline-line-soft)", color: "var(--pipeline-slate)" }}
          >
            {stageLabel(request.stage)}
          </span>
        </>
      }
      tab={tab}
      onTabChange={onTabChange}
      overview={
        <div>
          <KvGrid
            items={[
              {
                label: "Client",
                value: request.client_name ?? request.prospect_client_name ?? "—",
              },
              { label: "Service requested", value: request.title },
              { label: "Contact", value: request.contact_name ?? request.contact_email ?? "—" },
              {
                label: "Est. value",
                value:
                  request.estimated_value != null
                    ? formatCurrency(request.estimated_value, request.currency)
                    : "—",
              },
            ]}
          />
          <SectionLabel>Stage progress</SectionLabel>
          <StageTracker
            total={ENGAGEMENT_PIPELINE_STAGES.length}
            doneCount={idx}
            currentIndex={idx}
            label={stageLabel(request.stage)}
          />

          <SectionLabel>Move to…</SectionLabel>
          {canMove ? (
            <div>
              <Select value={request.stage} onValueChange={onMove} disabled={movePending}>
                <SelectTrigger className="w-full" aria-label={`Move ${request.title} to`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {moveTargetsFor(request).map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DropOutAction
                currentStage={request.stage}
                isPending={updateStage.isPending}
                onSubmit={(stage, reason) =>
                  updateStage.mutate(
                    { id: request.id, stage, lost_reason: reason },
                    {
                      onSuccess: () => toast.success(`Marked as ${stage}`),
                      onError: (err) =>
                        toast.error(err instanceof Error ? err.message : "The change didn't save"),
                    },
                  )
                }
              />
            </div>
          ) : (
            <ActionHint>{moveBlockedReason}</ActionHint>
          )}

          <SectionLabel>Start project</SectionLabel>
          {started ? (
            <div className="space-y-1 text-xs" style={{ color: "var(--pipeline-teal)" }}>
              {request.converted_project_id && (
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: request.converted_project_id }}
                  className="flex items-center gap-1 font-semibold hover:underline"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Project started: {request.converted_project_name ?? "open project"}
                </Link>
              )}
              {request.converted_contract_id && (
                <Link
                  to="/clients/contracts/$id"
                  params={{ id: request.converted_contract_id }}
                  className="flex items-center gap-1 font-semibold hover:underline"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Contract {request.converted_contract_number ?? ""}
                </Link>
              )}
            </div>
          ) : closed ? (
            <ActionHint>This request didn't go ahead, so there's no project to start.</ActionHint>
          ) : canStart ? (
            isWon ? (
              <ActionHint>This request is Won. Start its project with the button below.</ActionHint>
            ) : (
              <div className="space-y-1.5">
                <Button className="w-full" variant="outline" disabled>
                  <Rocket className="h-4 w-4 mr-1" /> Start project from request
                </Button>
                <ActionHint topic="start project from request">
                  You can start the project once the request is Won.
                </ActionHint>
              </div>
            )
          ) : (
            <ActionHint topic="start project from request">
              {request.department_name
                ? `Only the ${request.department_name} team can start the project from this request.`
                : "Once routed, the department it goes to starts the project."}
            </ActionHint>
          )}

          <div className="mt-5">
            <Link
              to="/requests/$requestId"
              params={{ requestId: request.id }}
              className="text-xs hover:underline"
              style={{ color: "var(--pipeline-gold)" }}
            >
              Open the full client request →
            </Link>
          </div>
        </div>
      }
      activity={
        <ActivityPane
          record={{ kind: "client_request", id: request.id }}
          canLog={canManage}
          readOnlyReason="Only the people working on this request can add activity."
          activities={activitiesQ.data ?? []}
          isLoading={activitiesQ.isLoading}
          isAdding={logActivity.isPending}
          onAdd={(type, summary) =>
            logActivity.mutate(
              { type: type as "note" | "call" | "email" | "meeting", summary },
              {
                onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to log"),
              },
            )
          }
        />
      }
      docs={
        <AttachmentsPanel
          resourceType="client_request"
          resourceId={request.id}
          canManage={canManage}
        />
      }
      footer={
        <>
          {isWon && !started && canStart ? (
            <Button
              className="flex-1"
              onClick={onStart}
              style={{ background: "var(--pipeline-ink)" }}
            >
              <Rocket className="h-4 w-4 mr-1" /> Start project from request
            </Button>
          ) : (
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Close
            </Button>
          )}
          {canManage && (
            <Button variant="outline" onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-1" /> Edit request
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={handleDelete}
              disabled={deleteRequest.isPending}
              aria-label={`Delete client request ${request.title}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </>
      }
    />
  );
}
