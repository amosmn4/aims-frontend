import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Building2, ExternalLink, FileSignature, Link2, Plus, Unlink } from "lucide-react";
import { useUpdateProject, type Project } from "@/features/projects/use-projects";
import {
  useContracts,
  BILLING_LABELS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_STYLES,
  type BillingFrequency,
  type ContractStatus,
} from "@/features/clients/use-clients-contracts";
import {
  ContractFormDialog,
  emptyContractDraft,
  type ContractDraft,
} from "@/features/clients/contract-form-dialog";
import { ClientPicker } from "@/features/clients/client-picker";
import { formatCurrency } from "@/features/finance/finance";
import { confirmDialog } from "@/components/confirm-dialog";
import { ActionHint } from "@/components/help-link";
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
import { cn } from "@/lib/utils";

/** Client and (optional) contract for a project, managed in place. */
export function ClientContractPanel({
  project,
  canManage,
}: {
  project: Project;
  canManage: boolean;
}) {
  const update = useUpdateProject();
  const [editingClient, setEditingClient] = useState(false);
  const [linking, setLinking] = useState(false);
  const [draft, setDraft] = useState<ContractDraft | null>(null);
  const clientContractsQ = useContracts({
    clientId: project.client_id,
    enabled: linking && !!project.client_id,
  });

  const save = (patch: Record<string, unknown>, success: string) =>
    update.mutate(
      { id: project.id, ...patch },
      {
        onSuccess: () => toast.success(success),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
      },
    );

  const startContract = () =>
    setDraft({
      ...emptyContractDraft(),
      title: project.name,
      client_id: project.client_id ?? "",
      department_id: project.department_id,
      service_line_id: project.service_line_id ?? "",
      billing_frequency: project.engagement_type === "ongoing" ? "monthly" : "one_off",
      start_date: project.start_date ?? new Date().toISOString().slice(0, 10),
      end_date: project.engagement_type === "ongoing" ? "" : (project.end_date ?? ""),
      status: "active",
    });

  const unlink = async () => {
    const ok = await confirmDialog({
      title: "Remove contract from this project?",
      description: "The contract itself is kept — it just won't be linked to this project.",
      confirmLabel: "Unlink contract",
    });
    if (ok) save({ contractId: null }, "Contract unlinked");
  };

  const linkable = (clientContractsQ.data ?? []).filter((c) => c.id !== project.contract_id);

  return (
    <div className="ws-panel">
      <h3>Client & contract</h3>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <section className="rounded-xl border p-4" aria-label="Client">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" /> Client
          </div>
          {editingClient ? (
            <div className="space-y-2">
              <ClientPicker
                value={project.client_id ?? ""}
                onChange={(v) => {
                  save({ clientId: v || null }, v ? "Client saved" : "Client removed");
                  setEditingClient(false);
                }}
                allowNone
                departmentId={project.department_id}
                placeholder="Select or create a client"
              />
              <Button size="sm" variant="ghost" onClick={() => setEditingClient(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div
                className={cn(
                  "text-base font-semibold",
                  !project.client_name && "text-muted-foreground",
                )}
              >
                {project.client_name ?? "No client yet"}
              </div>
              {canManage && (
                <Button size="sm" variant="outline" onClick={() => setEditingClient(true)}>
                  {project.client_id ? "Change client" : "Add client"}
                </Button>
              )}
            </div>
          )}
        </section>

        <section className="rounded-xl border p-4" aria-label="Contract">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <FileSignature className="h-3.5 w-3.5" /> Contract
            <span className="font-normal normal-case tracking-normal">(optional)</span>
          </div>
          {project.contract_id ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold">{project.contract_number}</span>
                {project.contract_status && (
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[0.6875rem]",
                      CONTRACT_STATUS_STYLES[project.contract_status as ContractStatus],
                    )}
                  >
                    {CONTRACT_STATUS_LABELS[project.contract_status as ContractStatus] ??
                      project.contract_status}
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {project.contract_value != null &&
                  formatCurrency(project.contract_value, project.contract_currency ?? undefined)}
                {project.contract_billing &&
                  ` · ${BILLING_LABELS[project.contract_billing as BillingFrequency] ?? project.contract_billing}`}
                {project.contract_end_date && ` · ends ${formatDate(project.contract_end_date)}`}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" asChild>
                  <Link to="/clients/contracts/$id" params={{ id: project.contract_id }}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open contract
                  </Link>
                </Button>
                {canManage && (
                  <Button size="sm" variant="ghost" onClick={unlink}>
                    <Unlink className="h-3.5 w-3.5 mr-1" /> Unlink contract
                  </Button>
                )}
              </div>
            </div>
          ) : linking ? (
            <div className="space-y-2">
              {!project.client_id ? (
                <p className="text-sm text-muted-foreground">
                  Add the client first to see their contracts.
                </p>
              ) : clientContractsQ.isError ? (
                <LoadError
                  what={`${project.client_name ?? "the client"}'s contracts`}
                  error={clientContractsQ.error}
                  onRetry={() => clientContractsQ.refetch()}
                  className="p-3"
                />
              ) : linkable.length === 0 && !clientContractsQ.isLoading ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {project.client_name} has no other contracts yet.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setLinking(false);
                      startContract();
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> New contract
                  </Button>
                </div>
              ) : (
                <Select
                  disabled={clientContractsQ.isLoading}
                  onValueChange={(v) => {
                    save({ contractId: v }, "Contract linked");
                    setLinking(false);
                  }}
                >
                  <SelectTrigger aria-label="Contract to link">
                    <SelectValue
                      placeholder={
                        clientContractsQ.isLoading ? "Loading contracts…" : "Choose a contract"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {linkable.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.contract_number ?? c.title} — {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button size="sm" variant="ghost" onClick={() => setLinking(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">No contract linked.</p>
              <ActionHint topic="project contract">
                A contract is optional — add it now or later.
              </ActionHint>
              {canManage && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={startContract}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> New contract
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setLinking(true)}>
                    <Link2 className="h-3.5 w-3.5 mr-1" /> Link existing contract
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {!canManage && (
        <p className="mt-3 text-xs text-muted-foreground">
          Only {project.department_name} staff can change this project's client or contract.
        </p>
      )}

      {draft && (
        <ContractFormDialog
          draft={draft}
          linkProject={false}
          onClose={() => setDraft(null)}
          onSaved={(contractId) => save({ contractId }, "Contract linked to this project")}
        />
      )}
    </div>
  );
}
