import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  useClientRequests,
  useSaveClientRequest,
  useUpdateClientRequestStage,
  useConvertToProject,
  useConvertClientRequestToContract,
  useClientRequestActivities,
  useLogActivity,
  SOURCE_LABELS,
  type ClientRequestRow,
  type ClientRequestStage,
} from "@/features/client-requests/use-client-requests";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { useClients } from "@/features/finance/use-finance-data";
import { formatCurrency } from "@/features/finance/finance";
import { useAuth } from "@/lib/auth";
import { ENGAGEMENT_PIPELINE_STAGES, deptColor, initials } from "@/features/pipeline/pipeline-theme";
import { Spine } from "@/components/pipeline/spine";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { PipelineDetailSheet, KvGrid, SectionLabel, StageTracker } from "@/components/pipeline/detail-sheet";
import { ActivityPane } from "@/components/pipeline/activity-pane";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export const Route = createFileRoute("/_authenticated/pipeline/engagements")({
  head: () => ({ meta: [{ title: "Client Engagement — AIMS" }] }),
  component: EngagementBoard,
});

function EngagementBoard() {
  const { isAdminOrCeo, hasRole } = useAuth();
  const canManage = isAdminOrCeo || hasRole(["finance", "hr", "it", "marketing_ops", "tender"]);
  const requestsQ = useClientRequests();
  const updateStage = useUpdateClientRequestStage();
  const convertToProject = useConvertToProject();
  const convertToContract = useConvertClientRequestToContract();
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "activity" | "docs">("overview");
  const [newOpen, setNewOpen] = useState(false);
  const [onboardOpen, setOnboardOpen] = useState<ClientRequestRow | null>(null);

  const requests = requestsQ.data ?? [];
  const counts: Record<string, number> = {};
  for (const s of ENGAGEMENT_PIPELINE_STAGES) counts[s.key] = requests.filter((r) => r.stage === s.key).length;

  const open = requests.find((r) => r.id === openId) ?? null;

  const move = (id: string, stage: string) => {
    updateStage.mutate(
      { id, stage: stage as ClientRequestStage },
      {
        onSuccess: () => toast.success(`Moved to ${ENGAGEMENT_PIPELINE_STAGES.find((s) => s.key === stage)?.label}`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Move failed"),
      },
    );
  };

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="p-title text-[27px]">Client Engagement</h1>
          <div className="text-[13.5px]" style={{ color: "var(--pipeline-slate)" }}>
            Inbound requests from the operations desk through to won/lost decisions.
          </div>
        </div>
        {canManage && (
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button style={{ background: "var(--pipeline-ink)" }}>+ New request</Button>
            </DialogTrigger>
            <DialogContent className="pipeline-scope">
              <NewRequestForm onDone={() => setNewOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Spine stages={ENGAGEMENT_PIPELINE_STAGES} counts={counts} />

      <PipelineBoard
        stages={ENGAGEMENT_PIPELINE_STAGES}
        items={requests}
        getStage={(r) => r.stage}
        getId={(r) => r.id}
        onMove={move}
        renderCard={(r) => (
          <EngagementCard
            r={r}
            onClick={() => {
              setOpenId(r.id);
              setTab("overview");
            }}
            onOnboard={() => setOnboardOpen(r)}
          />
        )}
      />

      {open && (
        <EngagementDetail
          request={open}
          tab={tab}
          onTabChange={setTab}
          onClose={() => setOpenId(null)}
          canManage={canManage}
          onOnboard={() => setOnboardOpen(open)}
        />
      )}

      <Dialog open={!!onboardOpen} onOpenChange={(v) => !v && setOnboardOpen(null)}>
        <DialogContent className="pipeline-scope">
          {onboardOpen && (
            <OnboardForm
              request={onboardOpen}
              onDone={() => setOnboardOpen(null)}
              convertToProject={convertToProject}
              convertToContract={convertToContract}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EngagementCard({ r, onClick, onOnboard }: { r: ClientRequestRow; onClick: () => void; onOnboard: () => void }) {
  const c = deptColor(r.department_code);
  return (
    <div onClick={onClick}>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <span className="p-mono text-[10px]" style={{ color: "var(--pipeline-slate-light)" }}>
          {r.reference_number ?? r.id.slice(0, 8)}
        </span>
        <span className="p-chip" style={{ background: c.bg, color: c.text }}>
          {r.department_name ?? "Unassigned"}
        </span>
      </div>
      <div className="mb-2 text-[13.5px] font-semibold leading-snug">{r.client_name ?? r.prospect_client_name ?? r.title}</div>
      <div className="text-[11.5px]" style={{ color: "var(--pipeline-slate)" }}>
        {r.title}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11.5px]">
        <span className="p-mono font-medium">
          {r.estimated_value != null ? formatCurrency(r.estimated_value, r.currency) : "—"}
        </span>
        {r.stage === "won" && (
          <span className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: "var(--pipeline-teal-soft)", color: "var(--pipeline-teal)" }}>
            Won
          </span>
        )}
        {r.stage === "lost" && (
          <span className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: "var(--pipeline-coral-soft)", color: "var(--pipeline-coral)" }}>
            Lost
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between border-t pt-2" style={{ borderColor: "var(--pipeline-line)", borderStyle: "dashed" }}>
        <div className="flex items-center gap-1.5">
          <div className="mini-avatar">{initials(r.assigned_to_name)}</div>
          <span className="text-[11px]" style={{ color: "var(--pipeline-slate)" }}>
            {r.assigned_to_name ?? "Unassigned"}
          </span>
        </div>
      </div>
      {r.stage === "won" && !r.converted_project_id && !r.converted_contract_id && (
        <button
          className="mt-2.5 w-full rounded-md border-none py-1.5 text-xs font-semibold text-white"
          style={{ background: "var(--pipeline-teal)" }}
          onClick={(e) => {
            e.stopPropagation();
            onOnboard();
          }}
        >
          Onboard as Client →
        </button>
      )}
      {r.stage === "won" && (r.converted_project_id || r.converted_contract_id) && (
        <div className="mt-2.5 flex items-center gap-1 text-[11px] font-semibold" style={{ color: "var(--pipeline-teal)" }}>
          ✓ Onboarded as client {r.converted_project_id ? "project" : "contract"}
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
  onOnboard,
}: {
  request: ClientRequestRow;
  tab: "overview" | "activity" | "docs";
  onTabChange: (t: "overview" | "activity" | "docs") => void;
  onClose: () => void;
  canManage: boolean;
  onOnboard: () => void;
}) {
  const activitiesQ = useClientRequestActivities(request.id);
  const logActivity = useLogActivity(request.id);
  const updateStage = useUpdateClientRequestStage();
  const idx = ENGAGEMENT_PIPELINE_STAGES.findIndex((s) => s.key === request.stage);
  const c = deptColor(request.department_code);
  const isWon = request.stage === "won";
  const alreadyOnboarded = !!request.converted_project_id || !!request.converted_contract_id;

  return (
    <PipelineDetailSheet
      open
      onClose={onClose}
      refId={request.reference_number ?? request.id.slice(0, 8)}
      title={request.client_name ?? request.prospect_client_name ?? request.title}
      tags={
        <>
          <span className="p-chip" style={{ background: c.bg, color: c.text }}>
            {request.department_name ?? "Unassigned"}
          </span>
          <span className="p-chip" style={{ background: "var(--pipeline-line-soft)", color: "var(--pipeline-slate)" }}>
            {ENGAGEMENT_PIPELINE_STAGES.find((s) => s.key === request.stage)?.label}
          </span>
        </>
      }
      tab={tab}
      onTabChange={onTabChange}
      overview={
        <div>
          <KvGrid
            items={[
              { label: "Client", value: request.client_name ?? request.prospect_client_name ?? "—" },
              { label: "Service requested", value: request.title },
              { label: "Contact", value: request.contact_name ?? request.contact_email ?? "—" },
              { label: "Est. value", value: request.estimated_value != null ? formatCurrency(request.estimated_value, request.currency) : "—" },
            ]}
          />
          <SectionLabel>Stage progress</SectionLabel>
          <StageTracker total={ENGAGEMENT_PIPELINE_STAGES.length} doneCount={idx} currentIndex={idx} />
          {canManage && request.department_id && (
            <div>
              <SectionLabel>Move stage</SectionLabel>
              <Select
                value={request.stage}
                onValueChange={(v) =>
                  updateStage.mutate(
                    { id: request.id, stage: v as ClientRequestStage },
                    { onError: (err) => toast.error(err instanceof Error ? err.message : "Failed") },
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENGAGEMENT_PIPELINE_STAGES.filter((s) => s.key !== "new").map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {!request.department_id && (
            <div className="text-xs" style={{ color: "var(--pipeline-slate)" }}>
              Route this request to a department from the full record before it can move further.
            </div>
          )}
          <div className="mt-4">
            <Link to="/requests/$requestId" params={{ requestId: request.id }} className="text-xs hover:underline" style={{ color: "var(--pipeline-gold)" }}>
              Open full request record (routing, documents) →
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
              { type: type as "note" | "call" | "email" | "meeting", summary },
              { onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to log") },
            )
          }
        />
      }
      docs={
        <div className="text-xs" style={{ color: "var(--pipeline-slate)" }}>
          Manage documents from the full request record's Documents tab.
        </div>
      }
      footer={
        isWon && !alreadyOnboarded ? (
          <Button className="flex-1" onClick={onOnboard} style={{ background: "var(--pipeline-ink)" }}>
            Onboard as Client Project →
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

function NewRequestForm({ onDone }: { onDone: () => void }) {
  const [client, setClient] = useState("");
  const [service, setService] = useState("");
  const [contact, setContact] = useState("");
  const [value, setValue] = useState("");
  const save = useSaveClientRequest();

  const submit = () => {
    if (!client.trim()) {
      toast.error("Add a client / business name");
      return;
    }
    save.mutate(
      {
        title: service.trim() || client.trim(),
        prospect_client_name: client.trim(),
        contact_name: contact || undefined,
        estimated_value: value ? Number(value) : undefined,
        source: "operations",
      },
      {
        onSuccess: () => {
          toast.success("Request added to engagement board");
          onDone();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
      },
    );
  };

  return (
    <div>
      <DialogHeader>
        <DialogTitle className="p-title">New client request</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <div>
          <Label>Client / business name</Label>
          <Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="e.g. Two Rivers Mall Ltd" />
        </div>
        <div>
          <Label>Service requested</Label>
          <Input value={service} onChange={(e) => setService(e.target.value)} placeholder="e.g. Payroll Outsourcing" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Contact person</Label>
            <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="e.g. Grace M. (HR Director)" />
          </div>
          <div>
            <Label>Estimated value (KES)</Label>
            <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={save.isPending} style={{ background: "var(--pipeline-ink)" }}>
          Save
        </Button>
      </DialogFooter>
    </div>
  );
}

function OnboardForm({
  request,
  onDone,
  convertToProject,
  convertToContract,
}: {
  request: ClientRequestRow;
  onDone: () => void;
  convertToProject: ReturnType<typeof useConvertToProject>;
  convertToContract: ReturnType<typeof useConvertClientRequestToContract>;
}) {
  const [mode, setMode] = useState<"project" | "contract">("project");
  const [clientId, setClientId] = useState(request.client_id ?? "");
  const [contractNumber, setContractNumber] = useState("");
  const clientsQ = useClients();

  const submit = () => {
    if (!request.client_id && !clientId) {
      toast.error("A real client is required to onboard this request");
      return;
    }
    if (mode === "project") {
      convertToProject.mutate(
        { requestId: request.id, clientId: clientId || undefined },
        {
          onSuccess: () => {
            toast.success("Onboarded as a project");
            onDone();
          },
          onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
        },
      );
    } else {
      if (!contractNumber.trim()) {
        toast.error("Contract number is required");
        return;
      }
      convertToContract.mutate(
        {
          requestId: request.id,
          clientId: clientId || undefined,
          contractNumber: contractNumber.trim(),
          billingFrequency: "monthly",
          startDate: new Date().toISOString().slice(0, 10),
        },
        {
          onSuccess: () => {
            toast.success("Onboarded as a recurring contract");
            onDone();
          },
          onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
        },
      );
    }
  };

  return (
    <div>
      <DialogHeader>
        <DialogTitle className="p-title">Onboard as client</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <div className="flex gap-2">
          <Button size="sm" variant={mode === "project" ? "default" : "outline"} onClick={() => setMode("project")}>
            One-off project
          </Button>
          <Button size="sm" variant={mode === "contract" ? "default" : "outline"} onClick={() => setMode("contract")}>
            Recurring contract
          </Button>
        </div>
        {!request.client_id && (
          <div>
            <Label>Client on file</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select the real client record…" />
              </SelectTrigger>
              <SelectContent>
                {(clientsQ.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {mode === "contract" && (
          <div>
            <Label>Contract number</Label>
            <Input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} placeholder="e.g. CTR-2026-108" />
          </div>
        )}
      </div>
      <DialogFooter>
        <Button
          onClick={submit}
          disabled={convertToProject.isPending || convertToContract.isPending}
          style={{ background: "var(--pipeline-ink)" }}
        >
          Confirm onboarding
        </Button>
      </DialogFooter>
    </div>
  );
}
