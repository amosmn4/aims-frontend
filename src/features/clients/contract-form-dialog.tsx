import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  useSaveContract,
  useDepartments,
  useProfilesLite,
  CONTRACT_STATUS_LABELS,
  BILLING_LABELS,
  CURRENCY_CODES,
  type ContractStatus,
  type BillingFrequency,
} from "@/features/clients/use-clients-contracts";
import { useClients, useServiceLines } from "@/features/finance/use-finance-data";
import { useCompanySettings } from "@/features/settings/use-company-settings";
import { useProjects, useUpdateProject } from "@/features/projects/use-projects";
import { ClientPicker } from "@/features/clients/client-picker";
import { FormField, RequiredNote } from "@/components/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { usePermissions } from "@/lib/permissions";
import { useAuth, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const CONTRACT_STATUSES: ContractStatus[] = [
  "draft",
  "active",
  "on_hold",
  "expired",
  "terminated",
];
export const CONTRACT_FREQS: BillingFrequency[] = ["one_off", "monthly", "quarterly", "annual"];

export type ContractDraft = {
  id?: string;
  title: string;
  contract_number: string;
  client_id: string;
  department_id: string;
  service_line_id: string;
  account_manager_id: string;
  status: ContractStatus;
  billing_frequency: BillingFrequency;
  start_date: string;
  end_date: string;
  value: string;
  /** Empty means the client's currency, or the company currency. */
  currency: string;
  next_invoice_date: string;
  auto_renew: boolean;
  description: string;
  notes: string;
};

export const emptyContractDraft = (): ContractDraft => ({
  title: "",
  contract_number: "",
  client_id: "",
  department_id: "",
  service_line_id: "",
  account_manager_id: "",
  status: "draft",
  billing_frequency: "one_off",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: "",
  value: "",
  currency: "",
  next_invoice_date: "",
  auto_renew: false,
  description: "",
  notes: "",
});

type Errors = Partial<
  Record<"contract_number" | "title" | "client_id" | "value" | "start_date" | "end_date", string>
>;

const NO_PROJECT = "__no_project__";

// Shared New/Edit contract form. Callers mount it conditionally with a key per record.
export function ContractFormDialog({
  draft,
  onClose,
  onSaved,
  linkProject = true,
}: {
  draft: ContractDraft;
  onClose: () => void;
  /** Receives the saved contract id, e.g. to link a new contract to a project. */
  onSaved?: (contractId: string) => void;
  /** Offers "Link to project" on a new contract. */
  linkProject?: boolean;
}) {
  const { isAdminOrCeo, hasRole, profile } = useAuth();
  const { canManageProject } = usePermissions();
  const deptsQ = useDepartments();
  const linesQ = useServiceLines();
  const profilesQ = useProfilesLite();
  const clientsQ = useClients();
  const settingsQ = useCompanySettings();
  const save = useSaveContract();
  const updateProject = useUpdateProject();

  const eligibleDepartments = (deptsQ.data ?? []).filter(
    (d) =>
      isAdminOrCeo ||
      hasRole(d.code as AppRole) ||
      d.id === draft.department_id ||
      (hasRole(["department_head", "account_manager"]) && d.id === profile?.departmentId),
  );

  const [initial, setInitial] = useState<ContractDraft>(draft);
  const [local, setLocal] = useState<ContractDraft>(draft);
  const [errors, setErrors] = useState<Errors>({});
  const [projectId, setProjectId] = useState("");
  const [showMore, setShowMore] = useState(
    !!draft.id &&
      !!(
        draft.account_manager_id ||
        draft.department_id ||
        draft.end_date ||
        draft.next_invoice_date ||
        draft.description ||
        draft.notes
      ),
  );

  // A department-less contract can only be managed by the CEO, so default to the only option.
  useEffect(() => {
    if (!draft.id && !local.department_id && !isAdminOrCeo && eligibleDepartments.length === 1) {
      const department_id = eligibleDepartments[0].id;
      setLocal((l) => ({ ...l, department_id }));
      setInitial((i) => ({ ...i, department_id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only once departments arrive
  }, [deptsQ.data]);

  const dirty = JSON.stringify(local) !== JSON.stringify(initial) || !!projectId;
  const { guardClose } = useUnsavedChanges(dirty);
  const close = () => guardClose(onClose);

  const client = (clientsQ.data ?? []).find((c) => c.id === local.client_id);
  const defaultCurrency = client?.currency_code || settingsQ.data?.currencyCode || "KES";
  const currency = local.currency || defaultCurrency;
  const currencyOptions = CURRENCY_CODES.includes(currency as (typeof CURRENCY_CODES)[number])
    ? [...CURRENCY_CODES]
    : [currency, ...CURRENCY_CODES];

  const lines = (linesQ.data ?? []).filter(
    (l) =>
      (l.department_id === local.department_id && l.is_active) || l.id === local.service_line_id,
  );

  const showProjectLink = linkProject && !draft.id && !!local.client_id;
  const projectsQ = useProjects({ clientId: local.client_id, enabled: showProjectLink });
  const linkableProjects = (projectsQ.data ?? []).filter(
    (p) => !p.contract_id && canManageProject(p),
  );

  const set = (patch: Partial<ContractDraft>) => {
    setLocal((l) => ({ ...l, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as keyof Errors];
      return next;
    });
  };

  const submit = async () => {
    const found: Errors = {};
    if (!local.contract_number.trim()) found.contract_number = "Enter the contract number";
    if (!local.title.trim()) found.title = "Give the contract a title";
    if (!local.client_id) found.client_id = "Choose the client";
    if (local.value.trim() === "" || Number.isNaN(Number(local.value)))
      found.value = "Enter the contract value (0 if not agreed yet)";
    else if (Number(local.value) < 0) found.value = "The value can't be negative";
    if (!local.start_date) found.start_date = "Choose the start date";
    if (local.end_date && local.start_date && local.end_date < local.start_date)
      found.end_date = "The end date can't be before the start date";
    setErrors(found);
    if (found.end_date) setShowMore(true);
    if (Object.keys(found).length > 0) return;

    try {
      const savedId = await save.mutateAsync({
        id: local.id,
        title: local.title.trim(),
        contract_number: local.contract_number.trim(),
        client_id: local.client_id,
        department_id: local.department_id || null,
        service_line_id: local.service_line_id || null,
        account_manager_id: local.account_manager_id || null,
        status: local.status,
        billing_frequency: local.billing_frequency,
        start_date: local.start_date,
        end_date: local.end_date || null,
        value: Number(local.value),
        currency,
        next_invoice_date: local.next_invoice_date || null,
        auto_renew: local.auto_renew,
        description: local.description.trim() || null,
        notes: local.notes.trim() || null,
      });
      toast.success(local.id ? "Contract updated" : "Contract created");
      if (projectId) {
        const project = linkableProjects.find((p) => p.id === projectId);
        try {
          await updateProject.mutateAsync({ id: projectId, contractId: savedId });
          toast.success(`Linked to ${project?.name ?? "the project"}`);
        } catch (e) {
          toast.error(
            `Contract created, but it couldn't be linked to ${project?.name ?? "the project"}. ${
              e instanceof Error ? e.message : ""
            }`,
          );
        }
      }
      onSaved?.(savedId);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the contract. Try again.");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{local.id ? `Edit contract ${draft.title}` : "New contract"}</DialogTitle>
            <DialogDescription>
              The signed agreement with a client. Invoices can be raised against it.
            </DialogDescription>
            <RequiredNote />
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              id="contract-number"
              label="Contract number"
              required
              error={errors.contract_number}
              hint="The number on the signed contract"
            >
              <Input
                id="contract-number"
                value={local.contract_number}
                autoFocus
                placeholder="e.g. AMS-2026-001"
                aria-invalid={!!errors.contract_number}
                onChange={(e) => set({ contract_number: e.target.value })}
              />
            </FormField>
            <FormField id="contract-title" label="Title" required error={errors.title}>
              <Input
                id="contract-title"
                value={local.title}
                placeholder="e.g. Staff outsourcing 2026"
                aria-invalid={!!errors.title}
                onChange={(e) => set({ title: e.target.value })}
              />
            </FormField>
            <FormField
              id="contract-client"
              label="Client"
              required
              error={errors.client_id}
              className="sm:col-span-2"
            >
              <ClientPicker
                id="contract-client"
                value={local.client_id}
                invalid={!!errors.client_id}
                onChange={(v) => {
                  set({ client_id: v });
                  setProjectId("");
                }}
                departmentId={local.department_id || undefined}
                placeholder="Select or create a client"
              />
            </FormField>
            <FormField
              id="contract-value"
              label="Value"
              required
              error={errors.value}
              hint="Total for the whole term"
            >
              <div className="flex gap-2">
                <Input
                  id="contract-value"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={local.value}
                  placeholder="0.00"
                  aria-invalid={!!errors.value}
                  className="min-w-0 flex-1"
                  onChange={(e) => set({ value: e.target.value })}
                />
                <Select value={currency} onValueChange={(v) => set({ currency: v })}>
                  <SelectTrigger className="w-24" aria-label="Currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FormField>
            <FormField id="contract-start" label="Start date" required error={errors.start_date}>
              <Input
                id="contract-start"
                type="date"
                value={local.start_date}
                aria-invalid={!!errors.start_date}
                onChange={(e) => set({ start_date: e.target.value })}
              />
            </FormField>
            <FormField id="contract-billing" label="Billing frequency" required>
              <Select
                value={local.billing_frequency}
                onValueChange={(v) => set({ billing_frequency: v as BillingFrequency })}
              >
                <SelectTrigger id="contract-billing">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_FREQS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {BILLING_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            {showProjectLink && linkableProjects.length > 0 && (
              <FormField
                id="contract-project"
                label="Link to project"
                hint="Optional — the project this contract pays for"
              >
                <Select
                  value={projectId || NO_PROJECT}
                  onValueChange={(v) => setProjectId(v === NO_PROJECT ? "" : v)}
                >
                  <SelectTrigger id="contract-project">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT}>Don't link a project</SelectItem>
                    {linkableProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={showMore}
              aria-controls="contract-more-details"
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", showMore && "rotate-180")}
              />
              More details
              <span className="text-xs font-normal">
                (manager, department, dates, status, notes)
              </span>
            </button>
            {showMore && (
              <div
                id="contract-more-details"
                className="mt-3 grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2"
              >
                <FormField id="contract-manager" label="Account manager">
                  <Select
                    value={local.account_manager_id || "none"}
                    onValueChange={(v) => set({ account_manager_id: v === "none" ? "" : v })}
                  >
                    <SelectTrigger id="contract-manager">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {(profilesQ.data ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name ?? p.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField id="contract-status" label="Status">
                  <Select
                    value={local.status}
                    onValueChange={(v) => set({ status: v as ContractStatus })}
                  >
                    <SelectTrigger id="contract-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTRACT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {CONTRACT_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField
                  id="contract-department"
                  label="Department"
                  hint={
                    local.department_id
                      ? undefined
                      : "Without a department, only the CEO can change this contract"
                  }
                >
                  <Select
                    value={local.department_id || "none"}
                    onValueChange={(v) => {
                      const department_id = v === "none" ? "" : v;
                      const line = (linesQ.data ?? []).find((l) => l.id === local.service_line_id);
                      set({
                        department_id,
                        ...(line && line.department_id !== department_id
                          ? { service_line_id: "" }
                          : {}),
                      });
                    }}
                  >
                    <SelectTrigger id="contract-department">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {eligibleDepartments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField
                  id="contract-line"
                  label="Service line"
                  hint={local.department_id ? undefined : "Choose a department first"}
                >
                  <Select
                    value={local.service_line_id || "none"}
                    disabled={!local.department_id}
                    onValueChange={(v) => set({ service_line_id: v === "none" ? "" : v })}
                  >
                    <SelectTrigger id="contract-line">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {lines.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField id="contract-end" label="End date" error={errors.end_date}>
                  <Input
                    id="contract-end"
                    type="date"
                    value={local.end_date}
                    min={local.start_date || undefined}
                    aria-invalid={!!errors.end_date}
                    onChange={(e) => set({ end_date: e.target.value })}
                  />
                </FormField>
                <FormField id="contract-next-invoice" label="Next invoice date">
                  <Input
                    id="contract-next-invoice"
                    type="date"
                    value={local.next_invoice_date}
                    onChange={(e) => set({ next_invoice_date: e.target.value })}
                  />
                </FormField>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Switch
                    id="contract-auto-renew"
                    checked={local.auto_renew}
                    onCheckedChange={(v) => set({ auto_renew: v })}
                  />
                  <Label htmlFor="contract-auto-renew">Renews automatically at the end date</Label>
                </div>
                <FormField id="contract-description" label="Description" className="sm:col-span-2">
                  <Textarea
                    id="contract-description"
                    rows={2}
                    value={local.description}
                    onChange={(e) => set({ description: e.target.value })}
                  />
                </FormField>
                <FormField
                  id="contract-notes"
                  label="Internal notes"
                  hint="Only visible inside AIMS"
                  className="sm:col-span-2"
                >
                  <Textarea
                    id="contract-notes"
                    rows={2}
                    value={local.notes}
                    onChange={(e) => set({ notes: e.target.value })}
                  />
                </FormField>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || updateProject.isPending}>
              {(save.isPending || updateProject.isPending) && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              {local.id ? "Save contract" : "Create contract"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
