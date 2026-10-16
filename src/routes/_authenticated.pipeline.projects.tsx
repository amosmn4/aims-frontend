import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  usePipelineProjects,
  useProjectActivities,
  useLogProjectActivity,
  type PipelineProjectRow,
  type ProjectDeliveryStage,
  daysInStage,
  STUCK_AFTER_DAYS,
} from "@/features/pipeline/use-pipeline";
import {
  useUpdateProject,
  useProject,
  useProjectFinancials,
  PROJECT_STATUS_LABELS,
} from "@/features/projects/use-projects";
import { NewProjectDialog } from "@/features/projects/new-project-dialog";
import { useHereHref } from "@/features/projects/project-back-link";
import { useCreateInvoice, useRecordPayment } from "@/features/finance/use-finance-data";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { formatCurrency } from "@/features/finance/finance";
import { usePermissions } from "@/lib/permissions";
import { BoardSearch, matchesQuery } from "@/components/pipeline/board-search";
import { EditProjectById, useDeleteProjectAction } from "@/features/projects/edit-project-dialog";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { Link2, Loader2, Pencil, Trash2 } from "lucide-react";
import { PROJECT_PIPELINE_STAGES, deptColor } from "@/features/pipeline/pipeline-theme";
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
import { ClientContractPanel } from "@/features/projects/client-contract-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/pipeline/projects")({
  head: () => ({ meta: [{ title: "Projects board — AIMS" }] }),
  component: () => <ProjectsDeliveryBoard />,
});

const SOURCE_LABELS = {
  tender: "From a tender",
  client_request: "From a client request",
} as const;
const sourceLabel = (p: PipelineProjectRow) =>
  p.source_type ? SOURCE_LABELS[p.source_type] : "Started directly";

// Every project by delivery stage; a host page can lock it to one department.
export function ProjectsDeliveryBoard({ fixedDepartmentId }: { fixedDepartmentId?: string } = {}) {
  const perms = usePermissions();
  const [deptFilter, setDeptFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const departmentsQ = useDepartments();
  const effectiveDeptFilter = fixedDepartmentId ?? deptFilter;
  const projectsQ = usePipelineProjects(
    effectiveDeptFilter === "all" ? undefined : effectiveDeptFilter,
  );
  const updateProject = useUpdateProject();
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "activity" | "docs">("overview");

  const loaded = projectsQ.data ?? [];
  const projects = loaded.filter((p) =>
    matchesQuery(query, p.name, p.client_name, p.department_name, p.source_ref),
  );
  const counts: Record<string, number> = {};
  for (const s of PROJECT_PIPELINE_STAGES)
    counts[s.key] = projects.filter((p) => p.delivery_stage === s.key).length;

  const open = projects.find((p) => p.id === openId) ?? null;

  const move = (id: string, stage: string) => {
    const target = projects.find((p) => p.id === id);
    if (!target || target.delivery_stage === stage) return;
    if (!perms.canManageProject(target)) {
      toast.error(`Only ${target.department_name} can move this project.`);
      return;
    }
    updateProject.mutate(
      { id, deliveryStage: stage },
      {
        onSuccess: () =>
          toast.success(`Moved to ${PROJECT_PIPELINE_STAGES.find((s) => s.key === stage)?.label}`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Move failed"),
      },
    );
  };

  return (
    <div>
      {!fixedDepartmentId && (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="p-title text-lg">Projects</h1>
            <p className="text-xs" style={{ color: "var(--pipeline-slate)" }}>
              Board view: every project by delivery stage, from onboarding to payment. Open a card
              to move it or see its invoices.{" "}
              <Link to="/projects" className="underline underline-offset-2">
                List view
              </Link>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-[200px]" aria-label="Department">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {(departmentsQ.data ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <NewProjectDialog />
          </div>
        </div>
      )}

      {projectsQ.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : projectsQ.isError ? (
        <LoadError what="projects" error={projectsQ.error} onRetry={() => projectsQ.refetch()} />
      ) : loaded.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No projects yet</p>
          {!fixedDepartmentId && <NewProjectDialog />}
        </div>
      ) : (
        <>
          <Spine stages={PROJECT_PIPELINE_STAGES} counts={counts} />
          <BoardSearch
            value={query}
            onChange={setQuery}
            placeholder="Search project, client or source"
          />
          {projects.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
              <p>No matches</p>
              <Button size="sm" variant="outline" onClick={() => setQuery("")}>
                Clear search
              </Button>
            </div>
          ) : (
            <>
              <p className="mb-2 text-xs" style={{ color: "var(--pipeline-slate)" }}>
                Drag a card to another stage, or open it and choose Move to stage.
              </p>
              <PipelineBoard
                stages={PROJECT_PIPELINE_STAGES}
                items={projects}
                getStage={(p) => p.delivery_stage}
                getId={(p) => p.id}
                onMove={move}
                canDrag={(p) => perms.canManageProject(p)}
                defaultVisiblePerColumn={5}
                renderCard={(p) => (
                  <ProjectCard
                    p={p}
                    onClick={() => {
                      setOpenId(p.id);
                      setTab("overview");
                    }}
                  />
                )}
              />
            </>
          )}
        </>
      )}

      {open && (
        <ProjectDetail
          project={open}
          tab={tab}
          onTabChange={setTab}
          onClose={() => setOpenId(null)}
          canManage={perms.canManageProject(open)}
          canInvoice={perms.canInvoice}
          onEdit={() => setEditingId(open.id)}
        />
      )}
      {editingId && <EditProjectById projectId={editingId} onClose={() => setEditingId(null)} />}
    </div>
  );
}

function ProjectCard({ p, onClick }: { p: PipelineProjectRow; onClick: () => void }) {
  const c = deptColor(p.department_code);
  const days = daysInStage(p.stage_changed_at);
  const stuck = p.delivery_stage !== "closed" && days > STUCK_AFTER_DAYS;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${p.name}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <span className="text-xs" style={{ color: "var(--pipeline-slate)" }}>
          {PROJECT_STATUS_LABELS[p.status]}
        </span>
        <span className="p-chip" style={{ background: c.bg, color: c.text }}>
          {p.department_name}
        </span>
      </div>
      <div className="mb-2 text-[13.5px] font-semibold leading-snug">{p.name}</div>
      <div className="text-xs" style={{ color: "var(--pipeline-slate)" }}>
        {sourceLabel(p)}
      </div>
      <div
        className="mt-2 flex items-center justify-between gap-2 border-t pt-2"
        style={{ borderColor: "var(--pipeline-line)", borderStyle: "dashed" }}
      >
        <span className="text-xs" style={{ color: "var(--pipeline-slate)" }}>
          {p.client_name ?? "No client"}
        </span>
        <span
          className="text-xs font-medium"
          style={{ color: stuck ? "var(--pipeline-coral)" : "var(--pipeline-slate)" }}
        >
          {stuck ? `No movement for ${days} days` : `${days} day${days === 1 ? "" : "s"} in stage`}
        </span>
      </div>
    </div>
  );
}

function ProjectDetail({
  project,
  tab,
  onTabChange,
  onClose,
  canManage,
  canInvoice,
  onEdit,
}: {
  project: PipelineProjectRow;
  tab: "overview" | "activity" | "docs";
  onTabChange: (t: "overview" | "activity" | "docs") => void;
  onClose: () => void;
  canManage: boolean;
  canInvoice: boolean;
  onEdit: () => void;
}) {
  const deleteProject = useDeleteProjectAction();
  const activitiesQ = useProjectActivities(project.id);
  const logActivity = useLogProjectActivity(project.id);
  const financialsQ = useProjectFinancials(project.id);
  const updateProject = useUpdateProject();
  const idx = PROJECT_PIPELINE_STAGES.findIndex((s) => s.key === project.delivery_stage);
  const c = deptColor(project.department_code);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [linkingContract, setLinkingContract] = useState(false);
  const qc = useQueryClient();
  const here = useHereHref();

  // Refresh billing figures once a contract is linked or unlinked from here.
  const prevContractId = useRef(project.contract_id);
  useEffect(() => {
    if (prevContractId.current === project.contract_id) return;
    prevContractId.current = project.contract_id;
    qc.invalidateQueries({ queryKey: ["project-financials", project.id] });
    if (project.contract_id) setLinkingContract(false);
  }, [project.contract_id, project.id, qc]);

  const financials = financialsQ.data;

  return (
    <>
      <PipelineDetailSheet
        open
        onClose={onClose}
        refId=""
        title={project.name}
        tags={
          <>
            <span className="p-chip" style={{ background: c.bg, color: c.text }}>
              {project.department_name}
            </span>
            <span
              className="p-chip"
              style={{ background: "var(--pipeline-line-soft)", color: "var(--pipeline-slate)" }}
            >
              {PROJECT_PIPELINE_STAGES.find((s) => s.key === project.delivery_stage)?.label}
            </span>
          </>
        }
        tab={tab}
        onTabChange={onTabChange}
        overview={
          <div>
            <KvGrid
              items={[
                { label: "How it started", value: sourceLabel(project) },
                { label: "Client", value: project.client_name ?? "No client" },
                { label: "Department", value: project.department_name },
                { label: "Status", value: PROJECT_STATUS_LABELS[project.status] },
              ]}
            />
            <SectionLabel>Stage progress</SectionLabel>
            <StageTracker
              total={PROJECT_PIPELINE_STAGES.length}
              doneCount={idx}
              currentIndex={idx}
            />
            {canManage && (
              <div className="mb-4">
                <SectionLabel>Move to stage</SectionLabel>
                <Select
                  value={project.delivery_stage}
                  onValueChange={(v) =>
                    updateProject.mutate(
                      { id: project.id, deliveryStage: v as ProjectDeliveryStage },
                      {
                        onError: (err) =>
                          toast.error(err instanceof Error ? err.message : "Failed"),
                      },
                    )
                  }
                >
                  <SelectTrigger className="w-full" aria-label="Move to stage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_PIPELINE_STAGES.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <SectionLabel>Invoicing &amp; payment</SectionLabel>
            {financialsQ.isLoading ? (
              <div className="text-xs" style={{ color: "var(--pipeline-slate)" }}>
                Loading…
              </div>
            ) : financialsQ.isError ? (
              <LoadError
                what="invoicing"
                error={financialsQ.error}
                onRetry={() => financialsQ.refetch()}
              />
            ) : !financials || !financials.hasContract ? (
              linkingContract ? (
                <div className="space-y-2">
                  <ProjectContractLinker projectId={project.id} canManage={canManage} />
                  <Button size="sm" variant="ghost" onClick={() => setLinkingContract(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div
                  className="rounded-lg border p-3.5 text-xs"
                  style={{
                    borderColor: "var(--pipeline-line)",
                    background: "var(--pipeline-paper)",
                    color: "var(--pipeline-slate)",
                  }}
                >
                  No contract linked. That is fine for work without one; invoices need a contract.
                  {canManage && (
                    <div className="mt-2.5">
                      <Button size="sm" variant="outline" onClick={() => setLinkingContract(true)}>
                        <Link2 className="h-4 w-4 mr-1" /> Link contract
                      </Button>
                    </div>
                  )}
                </div>
              )
            ) : (
              <div
                className="rounded-lg border p-3.5"
                style={{ borderColor: "var(--pipeline-line)", background: "var(--pipeline-paper)" }}
              >
                <FinRow
                  label="Invoiced to date"
                  value={formatCurrency(financials.totals.totalInvoiced)}
                />
                <FinRow
                  label="Paid to date"
                  value={formatCurrency(financials.totals.totalPaid)}
                  color="var(--pipeline-teal)"
                />
                <FinRow
                  label="Outstanding"
                  value={formatCurrency(financials.totals.totalOutstanding)}
                  color="var(--pipeline-coral)"
                />
                {canInvoice && (
                  <div className="mt-2.5 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setInvoiceOpen(true)}>
                      Raise invoice
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPaymentOpen(true)}
                      disabled={financials.invoices.length === 0}
                    >
                      Record payment
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4">
              <Link
                to="/projects/$projectId"
                params={{ projectId: project.id }}
                search={{ from: here }}
                className="text-xs font-medium hover:underline"
                style={{ color: "var(--pipeline-gold)" }}
              >
                Open project (tasks, milestones, documents) →
              </Link>
            </div>
          </div>
        }
        activity={
          <ActivityPane
            record={{ kind: "project", id: project.id }}
            canLog={canManage}
            readOnlyReason="Only people working on this project can add activity."
            activities={activitiesQ.data ?? []}
            isLoading={activitiesQ.isLoading}
            isAdding={logActivity.isPending}
            onAdd={(type, summary) =>
              logActivity.mutate(
                { type, summary },
                {
                  onError: (err) =>
                    toast.error(err instanceof Error ? err.message : "Failed to log"),
                },
              )
            }
          />
        }
        docs={
          <AttachmentsPanel resourceType="project" resourceId={project.id} canManage={canManage} />
        }
        footer={
          <>
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Close
            </Button>
            {canManage && (
              <>
                <Button variant="outline" onClick={onEdit}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit project
                </Button>
                <Button
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => deleteProject({ id: project.id, name: project.name }, onClose)}
                  aria-label={`Delete project ${project.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </>
        }
      />
      {financials?.hasContract && canInvoice && (
        <>
          <RaiseInvoiceDialog
            open={invoiceOpen}
            onClose={() => setInvoiceOpen(false)}
            projectId={project.id}
            contractId={financials.contractId}
            clientId={project.client_id}
          />
          <RecordPaymentDialog
            open={paymentOpen}
            onClose={() => setPaymentOpen(false)}
            projectId={project.id}
            invoiceId={
              financials.invoices.find((i) => i.outstanding > 0)?.id ?? financials.invoices[0]?.id
            }
            maxAmount={financials.totals.totalOutstanding}
          />
        </>
      )}
    </>
  );
}

function ProjectContractLinker({
  projectId,
  canManage,
}: {
  projectId: string;
  canManage: boolean;
}) {
  const projectQ = useProject(projectId);
  if (!projectQ.data) {
    return (
      <div className="text-xs" style={{ color: "var(--pipeline-slate)" }}>
        Loading…
      </div>
    );
  }
  return <ClientContractPanel project={projectQ.data} canManage={canManage} />;
}

function FinRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between py-1.5 text-[12.5px]">
      <span>{label}</span>
      <b className="p-mono" style={color ? { color } : undefined}>
        {value}
      </b>
    </div>
  );
}

function RaiseInvoiceDialog({
  open,
  onClose,
  projectId,
  contractId,
  clientId,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  contractId: string;
  clientId: string | null;
}) {
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [errors, setErrors] = useState<{ amount?: string; dueDate?: string }>({});
  const createInvoice = useCreateInvoice();
  const qc = useQueryClient();

  if (!open) return null;

  const submit = () => {
    const found = {
      amount: amount && Number(amount) > 0 ? undefined : "Enter an amount above zero.",
      dueDate: dueDate ? undefined : "Choose when the invoice is due.",
    };
    setErrors(found);
    if (found.amount || found.dueDate) return;
    if (!clientId) {
      toast.error("Link a client to this project before raising an invoice.");
      return;
    }
    createInvoice.mutate(
      {
        invoiceNumber: `INV-${Date.now().toString().slice(-8)}`,
        clientId,
        contractId,
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate,
        subtotal: Number(amount),
        status: "sent",
      },
      {
        onSuccess: () => {
          toast.success("Invoice raised");
          qc.invalidateQueries({ queryKey: ["project-financials", projectId] });
          onClose();
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to raise invoice"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Raise invoice</DialogTitle>
            <RequiredNote />
          </DialogHeader>
          {!clientId && (
            <p className="text-xs text-destructive">
              This project has no client yet. Add one with Edit project first.
            </p>
          )}
          <FormField id="board-invoice-amount" label="Amount (KES)" required error={errors.amount}>
            <Input
              id="board-invoice-amount"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={!!errors.amount}
            />
          </FormField>
          <FormField id="board-invoice-due" label="Due date" required error={errors.dueDate}>
            <Input
              id="board-invoice-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              aria-invalid={!!errors.dueDate}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createInvoice.isPending || !clientId}>
              {createInvoice.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Raise invoice
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecordPaymentDialog({
  open,
  onClose,
  projectId,
  invoiceId,
  maxAmount,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  invoiceId: string | undefined;
  maxAmount: number;
}) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string>();
  const recordPayment = useRecordPayment();
  const qc = useQueryClient();

  if (!open) return null;

  const submit = () => {
    if (!amount || Number(amount) <= 0) {
      setError("Enter the amount received.");
      return;
    }
    setError(undefined);
    if (!invoiceId) return;
    recordPayment.mutate(
      { invoiceId, amount: Number(amount), paidOn: new Date().toISOString().slice(0, 10) },
      {
        onSuccess: () => {
          toast.success("Payment recorded");
          qc.invalidateQueries({ queryKey: ["project-financials", projectId] });
          onClose();
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to record payment"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>Outstanding: {formatCurrency(maxAmount)}</DialogDescription>
          </DialogHeader>
          <FormField id="board-payment-amount" label="Amount received (KES)" required error={error}>
            <Input
              id="board-payment-amount"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={!!error}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={recordPayment.isPending || !invoiceId}>
              {recordPayment.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
