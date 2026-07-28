import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  usePipelineProjects,
  useProjectActivities,
  useLogProjectActivity,
  type PipelineProjectRow,
  type ProjectDeliveryStage,
} from "@/features/pipeline/use-pipeline";
import { useUpdateProject, useProjectFinancials } from "@/features/projects/use-projects";
import { useCreateInvoice, useRecordPayment } from "@/features/finance/use-finance-data";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { formatCurrency } from "@/features/finance/finance";
import { useAuth } from "@/lib/auth";
import { PROJECT_PIPELINE_STAGES, deptColor, initials } from "@/features/pipeline/pipeline-theme";
import { Spine } from "@/components/pipeline/spine";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { PipelineDetailSheet, KvGrid, SectionLabel, StageTracker } from "@/components/pipeline/detail-sheet";
import { ActivityPane } from "@/components/pipeline/activity-pane";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/pipeline/projects")({
  head: () => ({ meta: [{ title: "Projects & Delivery — AIMS" }] }),
  component: ProjectsDeliveryBoard,
});

// Exported so a department hub (e.g. _authenticated.hr.projects.tsx) can embed this same board
// locked to its own department — projects routed to that department from a won tender, a
// converted client request, or created directly, with delivery-stage updates shared with the
// central Pipeline's own Delivery Board since both read/write through the same usePipelineProjects
// query.
export function ProjectsDeliveryBoard({ fixedDepartmentId }: { fixedDepartmentId?: string } = {}) {
  const { isAdminOrCeo, hasRole } = useAuth();
  const canManage = isAdminOrCeo || hasRole(["finance", "hr", "it", "marketing", "tender", "operations"]);
  const [deptFilter, setDeptFilter] = useState("all");
  const departmentsQ = useDepartments();
  const effectiveDeptFilter = fixedDepartmentId ?? deptFilter;
  const projectsQ = usePipelineProjects(effectiveDeptFilter === "all" ? undefined : effectiveDeptFilter);
  const updateProject = useUpdateProject();
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "activity" | "docs">("overview");

  const projects = projectsQ.data ?? [];
  const counts: Record<string, number> = {};
  for (const s of PROJECT_PIPELINE_STAGES) counts[s.key] = projects.filter((p) => p.delivery_stage === s.key).length;

  const open = projects.find((p) => p.id === openId) ?? null;

  const move = (id: string, stage: string) => {
    updateProject.mutate(
      { id, deliveryStage: stage },
      {
        onSuccess: () => toast.success(`Moved to ${PROJECT_PIPELINE_STAGES.find((s) => s.key === stage)?.label}`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Move failed"),
      },
    );
  };

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="p-title text-lg">{fixedDepartmentId ? "Work & Projects" : "Delivery Board"}</h1>
          <div className="text-xs" style={{ color: "var(--pipeline-slate)" }}>
            {fixedDepartmentId
              ? "Projects routed here from a won tender, a converted client request, or created directly — move them through delivery, invoicing and payment."
              : (
                <>
                  Won tenders and onboarded clients, tracked through delivery, invoicing and payment —
                  same projects as{" "}
                  <Link to="/projects" className="underline underline-offset-2">
                    Projects & Tasks
                  </Link>
                  , grouped by delivery stage instead of status.
                </>
              )}
          </div>
        </div>
        {!fixedDepartmentId && (
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-[200px]">
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
        )}
      </div>

      <Spine stages={PROJECT_PIPELINE_STAGES} counts={counts} />

      <PipelineBoard
        stages={PROJECT_PIPELINE_STAGES}
        items={projects}
        getStage={(p) => p.delivery_stage}
        getId={(p) => p.id}
        onMove={move}
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

      {open && (
        <ProjectDetail
          project={open}
          tab={tab}
          onTabChange={setTab}
          onClose={() => setOpenId(null)}
          canManage={canManage}
        />
      )}
    </div>
  );
}

function ProjectCard({ p, onClick }: { p: PipelineProjectRow; onClick: () => void }) {
  const c = deptColor(p.department_code);
  return (
    <div onClick={onClick}>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <span className="p-mono text-[10px]" style={{ color: "var(--pipeline-slate-light)" }}>
          {p.id.slice(0, 8)}
        </span>
        <span className="p-chip" style={{ background: c.bg, color: c.text }}>
          {p.department_name}
        </span>
      </div>
      <div className="mb-2 text-[13.5px] font-semibold leading-snug">{p.name}</div>
      <div className="text-[11.5px]" style={{ color: "var(--pipeline-slate)" }}>
        {p.source_type === "tender" ? "Tender" : p.source_type === "client_request" ? "Client" : "Direct"}
        {p.source_ref ? ` — ${p.source_ref}` : ""}
      </div>
      <div className="mt-2 flex items-center justify-between border-t pt-2" style={{ borderColor: "var(--pipeline-line)", borderStyle: "dashed" }}>
        <span className="text-[11px]" style={{ color: "var(--pipeline-slate)" }}>
          {p.client_name ?? "—"}
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
}: {
  project: PipelineProjectRow;
  tab: "overview" | "activity" | "docs";
  onTabChange: (t: "overview" | "activity" | "docs") => void;
  onClose: () => void;
  canManage: boolean;
}) {
  const activitiesQ = useProjectActivities(project.id);
  const logActivity = useLogProjectActivity(project.id);
  const financialsQ = useProjectFinancials(project.id);
  const updateProject = useUpdateProject();
  const idx = PROJECT_PIPELINE_STAGES.findIndex((s) => s.key === project.delivery_stage);
  const c = deptColor(project.department_code);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const financials = financialsQ.data;

  return (
    <>
    <PipelineDetailSheet
      open
      onClose={onClose}
      refId={project.id.slice(0, 8)}
      title={project.name}
      tags={
        <>
          <span className="p-chip" style={{ background: c.bg, color: c.text }}>
            {project.department_name}
          </span>
          <span className="p-chip" style={{ background: "var(--pipeline-line-soft)", color: "var(--pipeline-slate)" }}>
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
              {
                label: "Source",
                value:
                  project.source_type === "tender"
                    ? `Tender — ${project.source_ref ?? "—"}`
                    : project.source_type === "client_request"
                      ? `Client — ${project.source_ref ?? "—"}`
                      : "Direct",
              },
              { label: "Client", value: project.client_name ?? "—" },
              { label: "Department", value: project.department_name },
              { label: "Status", value: project.status },
            ]}
          />
          <SectionLabel>Stage progress</SectionLabel>
          <StageTracker total={PROJECT_PIPELINE_STAGES.length} doneCount={idx} currentIndex={idx} />
          {canManage && (
            <div className="mb-4">
              <SectionLabel>Move stage</SectionLabel>
              <Select
                value={project.delivery_stage}
                onValueChange={(v) =>
                  updateProject.mutate(
                    { id: project.id, deliveryStage: v as ProjectDeliveryStage },
                    { onError: (err) => toast.error(err instanceof Error ? err.message : "Failed") },
                  )
                }
              >
                <SelectTrigger className="w-full">
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

          <SectionLabel>Invoicing &amp; Payment</SectionLabel>
          {financialsQ.isLoading ? (
            <div className="text-xs" style={{ color: "var(--pipeline-slate)" }}>
              Loading…
            </div>
          ) : !financials || !financials.hasContract ? (
            <div
              className="rounded-lg border p-3.5 text-xs"
              style={{ borderColor: "var(--pipeline-line)", background: "var(--pipeline-paper)", color: "var(--pipeline-slate)" }}
            >
              No contract linked to this project yet — invoicing needs a real Contract record.
            </div>
          ) : (
            <div className="rounded-lg border p-3.5" style={{ borderColor: "var(--pipeline-line)", background: "var(--pipeline-paper)" }}>
              <FinRow label="Invoiced to date" value={formatCurrency(financials.totals.totalInvoiced)} />
              <FinRow label="Paid to date" value={formatCurrency(financials.totals.totalPaid)} color="var(--pipeline-teal)" />
              <FinRow label="Outstanding" value={formatCurrency(financials.totals.totalOutstanding)} color="var(--pipeline-coral)" />
              {canManage && (
                <div className="mt-2.5 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setInvoiceOpen(true)}>
                    Raise invoice
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPaymentOpen(true)} disabled={financials.invoices.length === 0}>
                    Record payment
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="mt-4">
            <Link to="/projects/$projectId" params={{ projectId: project.id }} className="text-xs hover:underline" style={{ color: "var(--pipeline-gold)" }}>
              Open full project workspace (tasks, milestones, documents) →
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
              { onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to log") },
            )
          }
        />
      }
      docs={
        <div className="text-xs" style={{ color: "var(--pipeline-slate)" }}>
          Manage documents from the full project workspace's Documents tab.
        </div>
      }
      footer={
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Close
        </Button>
      }
    />
    {financials?.hasContract && (
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
          invoiceId={financials.invoices.find((i) => i.outstanding > 0)?.id ?? financials.invoices[0]?.id}
          maxAmount={financials.totals.totalOutstanding}
        />
      </>
    )}
    </>
  );
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
  const createInvoice = useCreateInvoice();
  const qc = useQueryClient();

  if (!open) return null;

  const submit = () => {
    if (!clientId || !amount || Number(amount) <= 0) {
      toast.error("Enter a valid amount");
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
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to raise invoice"),
      },
    );
  };

  return (
    <div className="pipeline-scope fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-5" onClick={onClose}>
      <div
        className="w-full max-w-[380px] rounded-2xl p-5"
        style={{ background: "var(--pipeline-paper-2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-title mb-3 text-base">Raise invoice</div>
        <div className="space-y-3">
          <div>
            <Label>Amount (KES)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Due date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={createInvoice.isPending} style={{ background: "var(--pipeline-ink)" }}>
            Raise
          </Button>
        </div>
      </div>
    </div>
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
  const recordPayment = useRecordPayment();
  const qc = useQueryClient();

  if (!open) return null;

  const submit = () => {
    if (!invoiceId) {
      toast.error("No invoice to record a payment against");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    recordPayment.mutate(
      { invoiceId, amount: Number(amount), paidOn: new Date().toISOString().slice(0, 10) },
      {
        onSuccess: () => {
          toast.success("Payment recorded");
          qc.invalidateQueries({ queryKey: ["project-financials", projectId] });
          onClose();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to record payment"),
      },
    );
  };

  return (
    <div className="pipeline-scope fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-5" onClick={onClose}>
      <div
        className="w-full max-w-[380px] rounded-2xl p-5"
        style={{ background: "var(--pipeline-paper-2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-title mb-3 text-base">Record payment</div>
        <div className="mb-3 text-xs" style={{ color: "var(--pipeline-slate)" }}>
          Outstanding: {formatCurrency(maxAmount)}
        </div>
        <div>
          <Label>Amount received (KES)</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={recordPayment.isPending} style={{ background: "var(--pipeline-ink)" }}>
            Record
          </Button>
        </div>
      </div>
    </div>
  );
}
