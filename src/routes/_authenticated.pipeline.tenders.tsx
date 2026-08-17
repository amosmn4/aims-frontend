import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  useTenders,
  useSaveTender,
  useUpdateTenderStage,
  useConvertTenderToProject,
  type TenderRow,
  type TenderStage,
} from "@/features/tender/use-tender";
import { useTenderActivities, useLogTenderActivity } from "@/features/pipeline/use-pipeline";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { formatCurrency } from "@/features/finance/finance";
import { useAuth } from "@/lib/auth";
import { TENDER_PIPELINE_STAGES, deptColor, initials } from "@/features/pipeline/pipeline-theme";
import { Spine } from "@/components/pipeline/spine";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import {
  PipelineDetailSheet,
  KvGrid,
  SectionLabel,
  StageTracker,
} from "@/components/pipeline/detail-sheet";
import { ActivityPane } from "@/components/pipeline/activity-pane";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Discoverable "mark as not proceeding" shortcut — usable from any stage (the backend never
 * enforced sequential stage order). Exists alongside the generic "Move stage" select above
 * because that path never sends a lostReason, silently dropping the "why" once a tender is
 * marked lost/withdrawn from the board.
 */
function DropOutAction({
  currentStage,
  isPending,
  onSubmit,
}: {
  currentStage: TenderStage;
  isPending: boolean;
  onSubmit: (stage: "lost" | "withdrawn", reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"lost" | "withdrawn">("lost");
  const [reason, setReason] = useState("");

  if (currentStage === "lost" || currentStage === "withdrawn") return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-xs"
        style={{ color: "var(--pipeline-coral)" }}
      >
        Mark as not proceeding →
      </button>
    );
  }

  return (
    <div
      className="mt-2 space-y-2 rounded-lg border p-2.5"
      style={{ borderColor: "var(--pipeline-line)" }}
    >
      <Select value={stage} onValueChange={(v) => setStage(v as "lost" | "withdrawn")}>
        <SelectTrigger className="h-8 w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="lost">Not Awarded (Lost)</SelectItem>
          <SelectItem value="withdrawn">Withdrawn</SelectItem>
        </SelectContent>
      </Select>
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for not proceeding (required)"
        className="min-h-[60px] text-xs"
      />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="flex-1"
          style={{ background: "var(--pipeline-coral)" }}
          disabled={isPending || !reason.trim()}
          onClick={() => onSubmit(stage, reason)}
        >
          Confirm
        </Button>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/pipeline/tenders")({
  head: () => ({ meta: [{ title: "Tender Pipeline — AIMS" }] }),
  component: TenderPipelineBoard,
});

// Exported so the Tender department hub (_authenticated.tender.tsx) can embed this board as a
// tab alongside the rest of the tender workflow, without duplicating this route's URL.
export function TenderPipelineBoard() {
  const { isAdminOrCeo, hasRole } = useAuth();
  const canManage = isAdminOrCeo || hasRole(["finance", "hr", "it", "marketing", "tender"]);
  const tendersQ = useTenders();
  const updateStage = useUpdateTenderStage();
  const convertToProject = useConvertTenderToProject();
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "activity" | "docs">("overview");
  const [newOpen, setNewOpen] = useState(false);

  const tenders = tendersQ.data ?? [];
  const counts: Record<string, number> = {};
  for (const s of TENDER_PIPELINE_STAGES)
    counts[s.key] = tenders.filter((t) => t.stage === s.key).length;

  const open = tenders.find((t) => t.id === openId) ?? null;

  const move = (id: string, stage: string) => {
    updateStage.mutate(
      { id, stage: stage as TenderStage },
      {
        onSuccess: () =>
          toast.success(`Moved to ${TENDER_PIPELINE_STAGES.find((s) => s.key === stage)?.label}`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Move failed"),
      },
    );
  };

  const forward = (tenderId: string) => {
    convertToProject.mutate(
      { tenderId },
      {
        onSuccess: () => toast.success("Forwarded to department — project created"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to forward"),
      },
    );
  };

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="p-title text-lg">Tender Pipeline</h1>
          <div className="text-xs" style={{ color: "var(--pipeline-slate)" }}>
            From identifying an opportunity to award — then handed to the delivering department.
          </div>
        </div>
        {canManage && (
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button style={{ background: "var(--pipeline-ink)" }}>+ New tender</Button>
            </DialogTrigger>
            <DialogContent className="pipeline-scope">
              <NewTenderForm onDone={() => setNewOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Spine stages={TENDER_PIPELINE_STAGES} counts={counts} />

      <PipelineBoard
        stages={TENDER_PIPELINE_STAGES}
        items={tenders}
        getStage={(t) => t.stage}
        getId={(t) => t.id}
        onMove={move}
        defaultVisiblePerColumn={5}
        renderCard={(t) => (
          <TenderCard
            t={t}
            onClick={() => {
              setOpenId(t.id);
              setTab("overview");
            }}
            onForward={() => forward(t.id)}
          />
        )}
      />

      {open && (
        <TenderDetail
          tender={open}
          tab={tab}
          onTabChange={setTab}
          onClose={() => setOpenId(null)}
          canManage={canManage}
          onForward={() => forward(open.id)}
        />
      )}
    </div>
  );
}

function TenderCard({
  t,
  onClick,
  onForward,
}: {
  t: TenderRow;
  onClick: () => void;
  onForward: () => void;
}) {
  const c = deptColor(t.department_code);
  const stageDef = TENDER_PIPELINE_STAGES.find((s) => s.key === t.stage);
  const showRequirementsProgress = t.stage === "applying" && !!t.requirements_total;
  const requirementsPct = showRequirementsProgress
    ? Math.round(((t.requirements_done ?? 0) / t.requirements_total!) * 100)
    : 0;
  return (
    <div onClick={onClick}>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <span className="p-mono text-[10px]" style={{ color: "var(--pipeline-slate-light)" }}>
          {t.reference_number ?? t.id.slice(0, 8)}
        </span>
        <span className="p-chip" style={{ background: c.bg, color: c.text }}>
          {t.department_name}
        </span>
      </div>
      <div className="mb-2 text-[13.5px] font-semibold leading-snug">{t.title}</div>
      <div className="text-[11.5px]" style={{ color: "var(--pipeline-slate)" }}>
        {t.client_name ?? t.prospect_client_name ?? "—"}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11.5px]">
        <span className="p-mono font-medium">
          {formatCurrency(t.estimated_value ?? 0, t.currency)}
        </span>
        {t.stage === "won" && (
          <span
            className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold"
            style={{ background: "var(--pipeline-teal-soft)", color: "var(--pipeline-teal)" }}
          >
            Awarded
          </span>
        )}
        {t.stage === "lost" && (
          <span
            className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold"
            style={{ background: "var(--pipeline-coral-soft)", color: "var(--pipeline-coral)" }}
          >
            Not Awarded
          </span>
        )}
      </div>
      {showRequirementsProgress && (
        <div className="mt-2">
          <div
            className="flex items-center justify-between text-[10.5px]"
            style={{ color: "var(--pipeline-slate)" }}
          >
            <span>Requirements checklist</span>
            <span className="p-mono font-medium">
              {t.requirements_done}/{t.requirements_total} ({requirementsPct}%)
            </span>
          </div>
          <div className="prog-mini mt-1" style={{ width: "100%" }}>
            <div
              className="prog-mini-fill"
              style={{
                width: `${requirementsPct}%`,
                background:
                  requirementsPct === 100 ? "var(--pipeline-teal)" : "var(--pipeline-gold)",
              }}
            />
          </div>
        </div>
      )}
      <div
        className="mt-2 flex items-center justify-between border-t pt-2"
        style={{ borderColor: "var(--pipeline-line)", borderStyle: "dashed" }}
      >
        <div className="flex items-center gap-1.5">
          <div className="mini-avatar">{initials(t.account_manager_name)}</div>
          <span className="text-[11px]" style={{ color: "var(--pipeline-slate)" }}>
            {t.account_manager_name ?? "Unassigned"}
          </span>
        </div>
        {stageDef && (
          <span className="p-mono text-[10.5px]" style={{ color: "var(--pipeline-slate-light)" }}>
            {t.submission_deadline ?? ""}
          </span>
        )}
      </div>
      {t.stage === "won" && !t.contract_id && (
        <button
          className="mt-2.5 w-full rounded-md border-none py-1.5 text-xs font-semibold text-white"
          style={{ background: "var(--pipeline-teal)" }}
          onClick={(e) => {
            e.stopPropagation();
            onForward();
          }}
        >
          Forward to Department →
        </button>
      )}
      {t.stage === "won" && t.contract_id && (
        <Link
          to="/clients/contracts/$id"
          params={{ id: t.contract_id }}
          onClick={(e) => e.stopPropagation()}
          className="mt-2.5 flex items-center gap-1 text-[11px] font-semibold hover:underline"
          style={{ color: "var(--pipeline-teal)" }}
        >
          ✓ Forwarded to {t.department_name} →
        </Link>
      )}
    </div>
  );
}

function TenderDetail({
  tender,
  tab,
  onTabChange,
  onClose,
  canManage,
  onForward,
}: {
  tender: TenderRow;
  tab: "overview" | "activity" | "docs";
  onTabChange: (t: "overview" | "activity" | "docs") => void;
  onClose: () => void;
  canManage: boolean;
  onForward: () => void;
}) {
  const activitiesQ = useTenderActivities(tender.id);
  const logActivity = useLogTenderActivity(tender.id);
  const updateStage = useUpdateTenderStage();
  const idx = TENDER_PIPELINE_STAGES.findIndex((s) => s.key === tender.stage);
  const c = deptColor(tender.department_code);

  return (
    <PipelineDetailSheet
      open
      onClose={onClose}
      refId={tender.reference_number ?? tender.id.slice(0, 8)}
      title={tender.title}
      tags={
        <>
          <span className="p-chip" style={{ background: c.bg, color: c.text }}>
            {tender.department_name}
          </span>
          <span
            className="p-chip"
            style={{ background: "var(--pipeline-line-soft)", color: "var(--pipeline-slate)" }}
          >
            {TENDER_PIPELINE_STAGES.find((s) => s.key === tender.stage)?.label}
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
                label: "Issuer / Client",
                value: tender.client_name ?? tender.prospect_client_name ?? "—",
              },
              {
                label: "Est. Value",
                value: formatCurrency(tender.estimated_value ?? 0, tender.currency),
              },
              { label: "Deadline", value: tender.submission_deadline ?? "—" },
              { label: "Owner", value: tender.account_manager_name ?? "Unassigned" },
            ]}
          />
          <SectionLabel>Stage progress</SectionLabel>
          <StageTracker total={TENDER_PIPELINE_STAGES.length} doneCount={idx} currentIndex={idx} />
          {!!tender.requirements_total && (
            <div className="mt-2">
              <div
                className="flex items-center justify-between text-[11px]"
                style={{ color: "var(--pipeline-slate)" }}
              >
                <span>Requirements checklist</span>
                <span className="p-mono font-medium">
                  {tender.requirements_done}/{tender.requirements_total} resolved
                </span>
              </div>
              <div className="prog-mini mt-1" style={{ width: "100%" }}>
                <div
                  className="prog-mini-fill"
                  style={{
                    width: `${Math.round(((tender.requirements_done ?? 0) / tender.requirements_total) * 100)}%`,
                    background:
                      tender.requirements_done === tender.requirements_total
                        ? "var(--pipeline-teal)"
                        : "var(--pipeline-gold)",
                  }}
                />
              </div>
            </div>
          )}
          {canManage && (
            <div>
              <SectionLabel>Move stage</SectionLabel>
              <Select
                value={tender.stage}
                onValueChange={(v) =>
                  updateStage.mutate(
                    { id: tender.id, stage: v as TenderStage },
                    {
                      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
                    },
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TENDER_PIPELINE_STAGES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DropOutAction
                currentStage={tender.stage}
                isPending={updateStage.isPending}
                onSubmit={(stage, reason) =>
                  updateStage.mutate(
                    { id: tender.id, stage, lost_reason: reason || undefined },
                    {
                      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
                    },
                  )
                }
              />
            </div>
          )}
          <div className="mt-4">
            <Link
              to="/tender/$tenderId"
              params={{ tenderId: tender.id }}
              className="text-xs hover:underline"
              style={{ color: "var(--pipeline-gold)" }}
            >
              Open full tender record (resources, financials, requirements) →
            </Link>
          </div>
        </div>
      }
      activity={
        <ActivityPane
          activities={activitiesQ.data ?? []}
          isLoading={activitiesQ.isLoading}
          isAdding={logActivity.isPending}
          onAdd={(type, summary) =>
            logActivity.mutate(
              { type, summary },
              {
                onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to log"),
              },
            )
          }
        />
      }
      docs={
        <div className="text-xs" style={{ color: "var(--pipeline-slate)" }}>
          Manage documents from the full tender record's Documents tab.
        </div>
      }
      footer={
        tender.stage === "won" && !tender.contract_id ? (
          <Button
            className="flex-1"
            onClick={onForward}
            style={{ background: "var(--pipeline-ink)" }}
          >
            Forward to {tender.department_name} →
          </Button>
        ) : (
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
        )
      }
    />
  );
}

function NewTenderForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [issuer, setIssuer] = useState("");
  const [value, setValue] = useState("");
  const [deadline, setDeadline] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const departmentsQ = useDepartments();
  const save = useSaveTender();

  const submit = () => {
    if (!title.trim() || !departmentId) {
      toast.error("Title and department are required");
      return;
    }
    save.mutate(
      {
        title: title.trim(),
        prospect_client_name: issuer || undefined,
        estimated_value: value ? Number(value) : undefined,
        submission_deadline: deadline || undefined,
        department_id: departmentId,
      },
      {
        onSuccess: () => {
          toast.success("Tender added to pipeline");
          onDone();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
      },
    );
  };

  return (
    <div>
      <DialogHeader>
        <DialogTitle className="p-title">New tender</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <div>
          <Label>Tender title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. County Payroll Services Tender"
          />
        </div>
        <div>
          <Label>Issuing organisation / prospect</Label>
          <Input
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            placeholder="e.g. Nairobi County Government"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Estimated value (KES)</Label>
            <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div>
            <Label>Deadline</Label>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Likely department</Label>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger>
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {(departmentsQ.data ?? []).map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={submit}
          disabled={save.isPending}
          style={{ background: "var(--pipeline-ink)" }}
        >
          Save
        </Button>
      </DialogFooter>
    </div>
  );
}
