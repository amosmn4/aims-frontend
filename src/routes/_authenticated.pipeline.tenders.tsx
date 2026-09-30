import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Pencil, Plus, Send, Trash2 } from "lucide-react";
import {
  useTenders,
  useSaveTender,
  useUpdateTenderStage,
  useDeleteTender,
  type TenderRow,
  type TenderStage,
} from "@/features/tender/use-tender";
import { useTenderActivities, useLogTenderActivity } from "@/features/pipeline/use-pipeline";
import {
  ForwardTenderDialog,
  useTenderDepartmentOptions,
} from "@/features/tender/forward-tender-dialog";
import { EditTenderDialog } from "@/features/tender/edit-tender-dialog";
import { formatCurrency } from "@/features/finance/finance";
import { usePermissions } from "@/lib/permissions";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format-date";
import { confirmDialog } from "@/components/confirm-dialog";
import { LoadError } from "@/components/load-error";
import { ActionHint } from "@/components/help-link";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { FormField, RequiredNote } from "@/components/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { BoardNoMatches, BoardSearch, matchesQuery } from "@/components/pipeline/board-search";
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
import { AttachmentsPanel } from "@/features/documents/attachments-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { askLossReason, askWinReason, isLossStage } from "@/features/pipeline/stage-reasons";

export const Route = createFileRoute("/_authenticated/pipeline/tenders")({
  head: () => ({ meta: [{ title: "Tenders — AIMS" }] }),
  component: TenderPipelineBoard,
});

type DetailTab = "overview" | "activity" | "docs";
type DropStage = "lost" | "withdrawn" | "cancelled";

const stageLabel = (key: string) => TENDER_PIPELINE_STAGES.find((s) => s.key === key)?.label ?? key;
const MOVE_BLOCKED = "Only the Tender team can move tenders.";

/** Asks for the why, then records a tender that isn't going ahead. */
function DropOutAction({
  currentStage,
  isPending,
  onSubmit,
}: {
  currentStage: TenderStage;
  isPending: boolean;
  onSubmit: (stage: DropStage, reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<DropStage>("lost");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  if (currentStage === "lost" || currentStage === "withdrawn" || currentStage === "cancelled")
    return null;

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
      <Select value={stage} onValueChange={(v) => setStage(v as DropStage)}>
        <SelectTrigger className="h-8 w-full text-xs" aria-label="Outcome">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="lost">Not Awarded</SelectItem>
          <SelectItem value="withdrawn">Withdrawn</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
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
          Mark as {stageLabel(stage).toLowerCase()}
        </Button>
      </div>
    </form>
  );
}

// Also embedded in the Tender department hub.
export function TenderPipelineBoard() {
  const canManage = usePermissions().canManageTenders;
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [editing, setEditing] = useState<TenderRow | null>(null);
  const tendersQ = useTenders();
  const updateStage = useUpdateTenderStage();
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [forwardFor, setForwardFor] = useState<TenderRow | null>(null);

  const all = tendersQ.data ?? [];
  const mineCount = user ? all.filter((t) => t.account_manager_id === user.id).length : 0;
  const tenders = all.filter(
    (t) =>
      (!mineOnly || t.account_manager_id === user?.id) &&
      matchesQuery(
        query,
        t.title,
        t.reference_number,
        t.client_name,
        t.prospect_client_name,
        t.department_name,
      ),
  );
  const counts: Record<string, number> = {};
  for (const s of TENDER_PIPELINE_STAGES)
    counts[s.key] = tenders.filter((t) => t.stage === s.key).length;

  const open = all.find((t) => t.id === openId) ?? null;

  const moveTender = async (t: TenderRow, stage: string) => {
    if (stage === t.stage) return;
    if (!canManage) {
      toast.error(MOVE_BLOCKED);
      return;
    }
    const label = stageLabel(stage);
    const lossReason = isLossStage(stage) ? await askLossReason("tender", label) : undefined;
    if (lossReason === null) return;
    const winReason = stage === "won" ? await askWinReason() : undefined;
    if (winReason === null) return;
    updateStage.mutate(
      {
        id: t.id,
        stage: stage as TenderStage,
        lost_reason: lossReason,
        won_reason: winReason || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`Moved to ${label}`);
          // Awarded work goes to a delivering department next.
          if (stage === "won" && !t.project_id) setForwardFor({ ...t, stage: "won" });
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "The move didn't save"),
      },
    );
  };

  const newTenderButton = <NewTenderDialog />;

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="p-title text-lg">Tenders</h1>
          <p className="text-xs" style={{ color: "var(--pipeline-slate)" }}>
            Every tender from spotting it to the award decision. Awarded tenders are forwarded to
            the department that delivers the work.
          </p>
        </div>
        {canManage && newTenderButton}
      </div>
      {!canManage && <ViewOnlyBanner area="Tenders" className="mt-2" />}

      {tendersQ.isLoading ? (
        <div className="flex justify-center py-16" role="status" aria-label="Loading tenders">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--pipeline-slate)" }} />
        </div>
      ) : tendersQ.isError ? (
        <LoadError
          className="mt-4"
          what="tenders"
          error={tendersQ.error}
          onRetry={() => tendersQ.refetch()}
        />
      ) : all.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm font-medium">No tenders yet</p>
          {canManage && newTenderButton}
        </div>
      ) : (
        <>
          <Spine stages={TENDER_PIPELINE_STAGES} counts={counts} />
          <div className="flex flex-wrap items-start gap-2">
            <BoardSearch
              value={query}
              onChange={setQuery}
              placeholder="Search tender, reference, issuer or department"
            />
            {mineCount > 0 && (
              <Button
                type="button"
                variant={mineOnly ? "default" : "outline"}
                aria-pressed={mineOnly}
                onClick={() => setMineOnly((v) => !v)}
              >
                Mine ({mineCount})
              </Button>
            )}
          </div>

          {tenders.length === 0 ? (
            <BoardNoMatches
              onClear={() => {
                setQuery("");
                setMineOnly(false);
              }}
            />
          ) : (
            <PipelineBoard
              stages={TENDER_PIPELINE_STAGES}
              items={tenders}
              getStage={(t) => t.stage}
              getId={(t) => t.id}
              getLabel={(t) => t.title}
              onMove={(id, stage) => {
                const target = tenders.find((t) => t.id === id);
                if (target) void moveTender(target, stage);
              }}
              canDrag={() => canManage}
              defaultVisiblePerColumn={5}
              onOpen={(t) => {
                setOpenId(t.id);
                setTab("overview");
              }}
              renderCard={(t) => (
                <TenderCard t={t} onForward={canManage ? () => setForwardFor(t) : undefined} />
              )}
            />
          )}
        </>
      )}

      {open && (
        <TenderDetail
          tender={open}
          tab={tab}
          onTabChange={setTab}
          onClose={() => setOpenId(null)}
          canManage={canManage}
          onMove={(stage) => void moveTender(open, stage)}
          onForward={() => setForwardFor(open)}
          onEdit={() => setEditing(open)}
          onDeleted={() => setOpenId(null)}
        />
      )}

      {editing && <EditTenderDialog tender={editing} onClose={() => setEditing(null)} />}

      {forwardFor && (
        <ForwardTenderDialog
          tender={forwardFor}
          open
          onOpenChange={(o) => !o && setForwardFor(null)}
        />
      )}
    </div>
  );
}

function TenderCard({ t, onForward }: { t: TenderRow; onForward?: () => void }) {
  const c = deptColor(t.department_code);
  const showRequirementsProgress = t.stage === "applying" && !!t.requirements_total;
  const requirementsPct = showRequirementsProgress
    ? Math.round(((t.requirements_done ?? 0) / t.requirements_total!) * 100)
    : 0;
  const outcome =
    t.stage === "won"
      ? { label: "Awarded", bg: "var(--pipeline-teal-soft)", color: "var(--pipeline-teal)" }
      : t.stage === "lost"
        ? { label: "Not Awarded", bg: "var(--pipeline-coral-soft)", color: "var(--pipeline-coral)" }
        : t.stage === "cancelled"
          ? {
              label: "Cancelled",
              bg: "var(--pipeline-purple-soft)",
              color: "var(--pipeline-purple)",
            }
          : null;
  return (
    <div>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <span className="p-mono text-xs" style={{ color: "var(--pipeline-slate-light)" }}>
          {t.reference_number ?? ""}
        </span>
        <span className="p-chip" style={{ background: c.bg, color: c.text }}>
          {t.department_name}
        </span>
      </div>
      <div className="mb-2 text-[14px] font-semibold leading-snug">{t.title}</div>
      <div className="text-xs" style={{ color: "var(--pipeline-slate)" }}>
        {t.client_name ?? t.prospect_client_name ?? "—"}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="p-mono font-medium">
          {t.estimated_value != null ? formatCurrency(t.estimated_value, t.currency) : "—"}
        </span>
        {outcome && (
          <span
            className="rounded-md px-1.5 py-0.5 text-xs font-semibold"
            style={{ background: outcome.bg, color: outcome.color }}
          >
            {outcome.label}
          </span>
        )}
      </div>
      {showRequirementsProgress && (
        <div className="mt-2">
          <div
            className="flex items-center justify-between text-xs"
            style={{ color: "var(--pipeline-slate)" }}
          >
            <span>Requirements</span>
            <span className="p-mono font-medium">
              {t.requirements_done}/{t.requirements_total} ({requirementsPct}%)
            </span>
          </div>
          <div className="prog-mini mt-1" style={{ width: "100%" }} aria-hidden="true">
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
        className="mt-2 flex items-center justify-between gap-2 border-t pt-2"
        style={{ borderColor: "var(--pipeline-line)", borderStyle: "dashed" }}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="mini-avatar" aria-hidden="true">
            {initials(t.account_manager_name)}
          </div>
          <span className="truncate text-xs" style={{ color: "var(--pipeline-slate)" }}>
            {t.account_manager_name ?? "Unassigned"}
          </span>
        </div>
        {t.submission_deadline && (
          <span className="shrink-0 text-xs" style={{ color: "var(--pipeline-slate)" }}>
            Due {formatDate(t.submission_deadline)}
          </span>
        )}
      </div>
      {t.stage === "won" && !t.project_id && onForward && (
        <button
          type="button"
          className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-md border-none py-1.5 text-xs font-semibold text-white"
          style={{ background: "var(--pipeline-teal)" }}
          onClick={(e) => {
            e.stopPropagation();
            onForward();
          }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" /> Forward to department
        </button>
      )}
      {t.stage === "won" && t.project_id && (
        <Link
          to="/projects/$projectId"
          params={{ projectId: t.project_id }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="mt-2.5 flex items-center gap-1 text-xs font-semibold hover:underline"
          style={{ color: "var(--pipeline-teal)" }}
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Forwarded to{" "}
          {t.department_name}
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
  onMove,
  onForward,
  onEdit,
  onDeleted,
}: {
  tender: TenderRow;
  tab: DetailTab;
  onTabChange: (t: DetailTab) => void;
  onClose: () => void;
  canManage: boolean;
  onMove: (stage: string) => void;
  onForward: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const deleteTender = useDeleteTender();
  const activitiesQ = useTenderActivities(tender.id);
  const logActivity = useLogTenderActivity(tender.id);
  const updateStage = useUpdateTenderStage();
  const idx = TENDER_PIPELINE_STAGES.findIndex((s) => s.key === tender.stage);
  const c = deptColor(tender.department_code);

  const handleDelete = async () => {
    const ok = await confirmDialog({
      title: `Delete "${tender.title}"?`,
      description:
        "This removes the tender and everything tracked against it. This can't be undone.",
      confirmLabel: "Delete tender",
      destructive: true,
    });
    if (!ok) return;
    deleteTender.mutate(tender.id, {
      onSuccess: () => {
        toast.success("Tender deleted");
        onDeleted();
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
    });
  };

  return (
    <PipelineDetailSheet
      open
      onClose={onClose}
      refId={tender.reference_number ?? ""}
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
            {stageLabel(tender.stage)}
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
                label: "Issuer / client",
                value: tender.client_name ?? tender.prospect_client_name ?? "—",
              },
              {
                label: "Est. value",
                value:
                  tender.estimated_value != null
                    ? formatCurrency(tender.estimated_value, tender.currency)
                    : "—",
              },
              { label: "Deadline", value: formatDate(tender.submission_deadline) },
              { label: "Owner", value: tender.account_manager_name ?? "Unassigned" },
            ]}
          />
          <SectionLabel>Stage progress</SectionLabel>
          <StageTracker
            total={TENDER_PIPELINE_STAGES.length}
            doneCount={idx}
            currentIndex={idx}
            label={stageLabel(tender.stage)}
          />
          {!!tender.requirements_total && (
            <div className="mt-2">
              <div
                className="flex items-center justify-between text-xs"
                style={{ color: "var(--pipeline-slate)" }}
              >
                <span>Requirements</span>
                <span className="p-mono font-medium">
                  {tender.requirements_done}/{tender.requirements_total} resolved
                </span>
              </div>
              <div className="prog-mini mt-1" style={{ width: "100%" }} aria-hidden="true">
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
          <SectionLabel>Move to…</SectionLabel>
          {canManage ? (
            <div>
              <Select value={tender.stage} onValueChange={onMove} disabled={updateStage.isPending}>
                <SelectTrigger className="w-full" aria-label={`Move ${tender.title} to`}>
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
                    { id: tender.id, stage, lost_reason: reason },
                    {
                      onSuccess: () =>
                        toast.success(`Marked as ${stageLabel(stage).toLowerCase()}`),
                      onError: (err) =>
                        toast.error(err instanceof Error ? err.message : "The change didn't save"),
                    },
                  )
                }
              />
            </div>
          ) : (
            <ActionHint>{MOVE_BLOCKED}</ActionHint>
          )}
          {tender.stage === "won" && !tender.project_id && !canManage && (
            <ActionHint className="mt-3">
              The Tender team forwards awarded tenders to the delivering department.
            </ActionHint>
          )}
          <div className="mt-5">
            <Link
              to="/tender/$tenderId"
              params={{ tenderId: tender.id }}
              className="text-xs hover:underline"
              style={{ color: "var(--pipeline-gold)" }}
            >
              Open the full tender (resources, financials, requirements) →
            </Link>
          </div>
        </div>
      }
      activity={
        <ActivityPane
          record={{ kind: "tender", id: tender.id }}
          canLog={canManage}
          readOnlyReason="Only the Tender team can add activity to tenders."
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
      docs={<AttachmentsPanel resourceType="tender" resourceId={tender.id} canManage={canManage} />}
      footer={
        <>
          {tender.stage === "won" && !tender.project_id && canManage ? (
            <Button
              className="flex-1"
              onClick={onForward}
              style={{ background: "var(--pipeline-ink)" }}
            >
              <Send className="h-4 w-4 mr-1" /> Forward to department
            </Button>
          ) : (
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Close
            </Button>
          )}
          {canManage && (
            <>
              <Button variant="outline" onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-1" /> Edit tender
              </Button>
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={handleDelete}
                disabled={deleteTender.isPending}
                aria-label={`Delete tender ${tender.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </>
      }
    />
  );
}

const blankTender = {
  title: "",
  referenceNumber: "",
  issuer: "",
  value: "",
  deadline: "",
  departmentId: "",
};

function NewTenderDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankTender);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof blankTender, string>>>({});
  const departmentsQ = useTenderDepartmentOptions();
  const save = useSaveTender();
  const dirty = (Object.keys(blankTender) as (keyof typeof blankTender)[]).some(
    (k) => form[k] !== blankTender[k],
  );
  const { guardClose } = useUnsavedChanges(open && dirty);

  const set = (key: keyof typeof blankTender, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const close = () => {
    setOpen(false);
    setForm(blankTender);
    setErrors({});
  };

  const submit = () => {
    const next: typeof errors = {};
    if (!form.title.trim()) next.title = "Enter the tender title.";
    if (!form.departmentId) next.departmentId = "Choose the department most likely to deliver it.";
    if (form.value && Number(form.value) < 0) next.value = "Value can't be negative.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    save.mutate(
      {
        title: form.title.trim(),
        reference_number: form.referenceNumber.trim() || undefined,
        prospect_client_name: form.issuer.trim() || undefined,
        estimated_value: form.value ? Number(form.value) : undefined,
        submission_deadline: form.deadline || undefined,
        department_id: form.departmentId,
      },
      {
        onSuccess: () => {
          toast.success("Tender added");
          close();
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "The tender wasn't saved"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : guardClose(close))}>
      <DialogTrigger asChild>
        <Button style={{ background: "var(--pipeline-ink)" }}>
          <Plus className="h-4 w-4 mr-1" /> New tender
        </Button>
      </DialogTrigger>
      <DialogContent className="pipeline-scope max-h-[90vh] overflow-y-auto">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle className="p-title">New tender</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <RequiredNote />
            <FormField id="new-tender-title" label="Tender title" required error={errors.title}>
              <Input
                id="new-tender-title"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. County Payroll Services Tender"
                aria-invalid={!!errors.title}
              />
            </FormField>
            <FormField
              id="new-tender-ref"
              label="Reference number"
              hint="As printed on the tender notice, e.g. CWWA/T/031/2026"
            >
              <Input
                id="new-tender-ref"
                value={form.referenceNumber}
                onChange={(e) => set("referenceNumber", e.target.value)}
              />
            </FormField>
            <FormField id="new-tender-issuer" label="Issuing organisation">
              <Input
                id="new-tender-issuer"
                value={form.issuer}
                onChange={(e) => set("issuer", e.target.value)}
                placeholder="e.g. Nairobi County Government"
              />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField id="new-tender-value" label="Estimated value (KES)" error={errors.value}>
                <Input
                  id="new-tender-value"
                  type="number"
                  min={0}
                  value={form.value}
                  onChange={(e) => set("value", e.target.value)}
                  aria-invalid={!!errors.value}
                />
              </FormField>
              <FormField id="new-tender-deadline" label="Submission deadline">
                <Input
                  id="new-tender-deadline"
                  type="date"
                  value={form.deadline}
                  onChange={(e) => set("deadline", e.target.value)}
                />
              </FormField>
            </div>
            <FormField
              id="new-tender-department"
              label="Likely delivering department"
              required
              error={errors.departmentId}
            >
              <Select value={form.departmentId} onValueChange={(v) => set("departmentId", v)}>
                <SelectTrigger id="new-tender-department" aria-invalid={!!errors.departmentId}>
                  <SelectValue placeholder="Choose a department…" />
                </SelectTrigger>
                <SelectContent>
                  {(departmentsQ.data ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => guardClose(close)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={save.isPending}
              style={{ background: "var(--pipeline-ink)" }}
            >
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add tender
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
