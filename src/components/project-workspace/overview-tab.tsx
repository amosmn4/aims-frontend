import { toast } from "sonner";
import type {
  Project,
  Task,
  Milestone,
  TaskStatus,
  SdlcStage,
} from "@/features/projects/use-projects";
import {
  TASK_STATUS_LABELS,
  useUpdateProject,
  useTimelineExtensions,
  taskCompletion,
  tracksDeliveryMetrics,
  SYSTEM_DEVELOPMENT_METHODOLOGY,
  SDLC_STAGES,
  SDLC_STAGE_LABELS,
  EXTENSION_ATTRIBUTION_LABELS,
} from "@/features/projects/use-projects";
import { TASK_STATUS_COLORS, money } from "@/features/project-workspace/workspace-theme";
import { computePercentComplete, computeEvm } from "@/features/project-workspace/workspace-calcs";
import { StageTracker, SectionLabel } from "@/components/pipeline/detail-sheet";
import { RelatedRecords, type RelatedRecordItem } from "@/components/related-records";
import { LoadError } from "@/components/load-error";
import { formatDate } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MilestonesPanel } from "@/features/projects/milestones-panel";

function DonutChart({ counts, total }: { counts: Record<TaskStatus, number>; total: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const segs = (Object.keys(counts) as TaskStatus[]).map((k) => {
    const frac = total ? counts[k] / total : 0;
    const len = frac * c;
    const seg = (
      <circle
        key={k}
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke={TASK_STATUS_COLORS[k]}
        strokeWidth="16"
        strokeDasharray={`${len} ${c - len}`}
        strokeDashoffset={-offset}
      />
    );
    offset += len;
    return seg;
  });
  return (
    <svg
      width="140"
      height="140"
      viewBox="0 0 140 140"
      style={{ transform: "rotate(-90deg)" }}
      aria-hidden="true"
    >
      {segs}
    </svg>
  );
}

function Explain({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 text-xs" style={{ color: "var(--pipeline-slate)" }}>
      {children}
    </div>
  );
}

export function OverviewTab({
  project,
  tasks,
  milestones,
  actualCost,
  canManage = false,
}: {
  project: Project;
  tasks: Task[];
  milestones: Milestone[];
  actualCost: number;
  canManage?: boolean;
}) {
  const detailed = tracksDeliveryMetrics(project.department_code);
  const pct = detailed ? computePercentComplete(tasks) : taskCompletion(tasks);
  const done = tasks.filter((t) => t.status === "completed").length;
  const budget = project.budget ?? 0;
  const budgetPct = budget > 0 ? Math.min(100, Math.round((actualCost / budget) * 100)) : 0;
  const evm = computeEvm({
    budget,
    startDate: project.start_date,
    endDate: project.end_date,
    percentComplete: pct,
    actualCost,
  });

  const statusCounts = tasks.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<TaskStatus, number>,
  );
  for (const k of Object.keys(TASK_STATUS_LABELS) as TaskStatus[]) statusCounts[k] ??= 0;

  const related: RelatedRecordItem[] = [];
  if (project.tender_id) {
    related.push({
      label: "From tender",
      title: project.tender_title ?? "Tender",
      to: `/tender/${project.tender_id}`,
    });
  }
  if (project.client_request_id) {
    related.push({
      label: "From client request",
      title: project.client_request_title ?? "Client request",
      to: `/requests/${project.client_request_id}`,
    });
  }
  if (project.contract_id) {
    related.push({
      label: "Contract",
      title: project.contract_number ?? "Contract",
      to: `/clients/contracts/${project.contract_id}`,
    });
  }
  if (project.client_id) {
    related.push({
      label: "Client",
      title: project.client_name ?? "Client",
      to: project.client_name
        ? `/clients?q=${encodeURIComponent(project.client_name)}`
        : "/clients",
    });
  }

  return (
    <>
      <RelatedRecords items={related} engagementTo={`/engagements/project/${project.id}`} />
      <div className="ws-ov-grid">
        <div className="ws-metric-card">
          <div className="label">Progress</div>
          <div className="num">{pct}%</div>
          <div className="ws-bar-track">
            <div
              className="ws-bar-fill"
              style={{ width: `${pct}%`, background: "var(--pipeline-teal)" }}
            />
          </div>
          <div className="sub">
            {detailed
              ? "Estimated hours of finished work, out of all estimated hours"
              : tasks.length === 0
                ? "No tasks yet"
                : `${done} of ${tasks.length} tasks done`}
          </div>
        </div>
        <div className="ws-metric-card">
          <div className="label">Budget used</div>
          <div className="num">{budgetPct}%</div>
          <div className="ws-bar-track">
            <div
              className="ws-bar-fill"
              style={{
                width: `${budgetPct}%`,
                background: budgetPct > 85 ? "var(--pipeline-coral)" : "var(--pipeline-gold)",
              }}
            />
          </div>
          <div className="sub">
            {budget > 0 ? `${money(actualCost)} of ${money(budget)}` : "No budget set"}
          </div>
        </div>
        {detailed && (
          <>
            <div className="ws-metric-card">
              <div className="label">Schedule health (SPI)</div>
              <div
                className="num"
                style={{ color: evm.spi >= 1 ? "var(--pipeline-teal)" : "var(--pipeline-coral)" }}
              >
                {evm.spi.toFixed(2)}
              </div>
              <div className="sub">{evm.spi >= 1 ? "Ahead of or on plan" : "Behind plan"}</div>
              <Explain>Above 1 means ahead of plan.</Explain>
            </div>
            <div className="ws-metric-card">
              <div className="label">Cost health (CPI)</div>
              <div
                className="num"
                style={{ color: evm.cpi >= 1 ? "var(--pipeline-teal)" : "var(--pipeline-coral)" }}
              >
                {evm.cpi.toFixed(2)}
              </div>
              <div className="sub">
                {evm.cpi >= 1 ? "Under or on budget" : "Over budget for the work done"}
              </div>
              <Explain>Above 1 means under budget for the work done.</Explain>
            </div>
          </>
        )}
      </div>

      <MilestonesPanel projectId={project.id} milestones={milestones} canManage={canManage} />

      <div className={detailed ? "ws-two-col" : "mt-3.5"}>
        {detailed && (
          <div className="ws-panel">
            <h3>Spending vs work done</h3>
            <Explain>
              Compares planned spend by today with the value of finished work and what has actually
              been spent.
            </Explain>
            <div className="evm-bars" style={{ marginTop: 12 }}>
              {[
                ["Planned spend by today (PV)", evm.pv, "var(--pipeline-slate-light)"],
                ["Value of work done (EV)", evm.ev, "var(--pipeline-teal)"],
                ["Actual spend (AC)", evm.ac, "var(--pipeline-gold)"],
              ].map(([label, value, color]) => (
                <div key={label as string} className="evm-row">
                  <div className="evm-label">{label}</div>
                  <div className="evm-track">
                    <div
                      className="evm-fill"
                      style={{
                        width: `${budget > 0 ? Math.min(100, ((value as number) / budget) * 100) : 0}%`,
                        background: color as string,
                      }}
                    />
                  </div>
                  <div className="evm-val">{money(value as number)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="ws-panel">
          <h3>Tasks by status</h3>
          {tasks.length === 0 ? (
            <div className="text-sm" style={{ color: "var(--pipeline-slate)" }}>
              No tasks yet. Add them on the Tasks tab.
            </div>
          ) : (
            <>
              <DonutChart counts={statusCounts} total={tasks.length} />
              <div className="ws-donut-legend">
                {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((k) => (
                  <div key={k} className="ws-dl-row">
                    <span className="ws-dl-dot" style={{ background: TASK_STATUS_COLORS[k] }} />
                    {TASK_STATUS_LABELS[k]}
                    <span className="ws-dl-num">{statusCounts[k]}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {detailed && <SdlcPanel project={project} canManage={canManage} />}
      <TimelinePanel projectId={project.id} />
    </>
  );
}

// Every recorded date push-out for this project: who, when, why, and whose delay.
export function TimelinePanel({ projectId }: { projectId: string }) {
  const extensionsQ = useTimelineExtensions("project", projectId);
  const extensions = extensionsQ.data ?? [];

  if (extensionsQ.isError) {
    return (
      <div className="ws-panel">
        <h3>Date extensions</h3>
        <LoadError
          what="date extensions"
          error={extensionsQ.error}
          onRetry={() => extensionsQ.refetch()}
        />
      </div>
    );
  }
  if (!extensionsQ.isLoading && extensions.length === 0) return null;

  return (
    <div className="ws-panel">
      <h3>Date extensions</h3>
      {extensionsQ.isLoading ? (
        <div className="text-sm" style={{ color: "var(--pipeline-slate)" }}>
          Loading…
        </div>
      ) : (
        <div className="divide-y">
          {extensions.map((e) => (
            <div key={e.id} className="py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {formatDate(e.previous_date)} → {formatDate(e.new_date)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Delay caused by: {EXTENSION_ATTRIBUTION_LABELS[e.attributed_to]}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{e.reason}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {e.created_by_name ?? "Unknown"} · {formatDate(e.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// IT only: which step of building a system this project is at.
function SdlcPanel({ project, canManage }: { project: Project; canManage: boolean }) {
  const updateProject = useUpdateProject();
  const isSystemDevelopment = project.methodology === SYSTEM_DEVELOPMENT_METHODOLOGY;

  if (!isSystemDevelopment) {
    if (!canManage) return null;
    return (
      <div className="ws-panel">
        <h3>System development stages</h3>
        <Explain>
          For projects that build or change a system: track it through requirements, design,
          development, testing, deployment and maintenance.
        </Explain>
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          disabled={updateProject.isPending}
          onClick={() =>
            updateProject.mutate(
              {
                id: project.id,
                methodology: SYSTEM_DEVELOPMENT_METHODOLOGY,
                sdlcStage: "requirements",
              },
              {
                onSuccess: () => toast.success("Now tracking system development stages"),
                onError: (err) =>
                  toast.error(err instanceof Error ? err.message : "Failed to update"),
              },
            )
          }
        >
          Track system development stages
        </Button>
      </div>
    );
  }

  const stage = project.sdlc_stage ?? "requirements";
  const idx = SDLC_STAGES.indexOf(stage);

  return (
    <div className="ws-panel">
      <h3>System development stage (SDLC)</h3>
      <Explain>The step this system build is at, from requirements through to maintenance.</Explain>
      <SectionLabel>Stage progress</SectionLabel>
      <StageTracker total={SDLC_STAGES.length} doneCount={idx} currentIndex={idx} />
      {canManage ? (
        <>
          <label
            htmlFor={`sdlc-stage-${project.id}`}
            className="mt-1 block text-xs font-medium"
            style={{ color: "var(--pipeline-slate)" }}
          >
            Move to stage
          </label>
          <Select
            value={stage}
            onValueChange={(v) =>
              updateProject.mutate(
                { id: project.id, sdlcStage: v as SdlcStage },
                {
                  onError: (err) =>
                    toast.error(err instanceof Error ? err.message : "Failed to update"),
                },
              )
            }
          >
            <SelectTrigger id={`sdlc-stage-${project.id}`} className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SDLC_STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SDLC_STAGE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      ) : (
        <div className="text-sm">Current stage: {SDLC_STAGE_LABELS[stage]}</div>
      )}
    </div>
  );
}
