import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth";
import { usePermissions } from "@/lib/permissions";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { ClientPicker } from "@/features/clients/client-picker";
import { useConvertTenderToProject, type TenderRow } from "@/features/tender/use-tender";
import { FormField, RequiredNote } from "@/components/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type BillingFrequency = "one_off" | "monthly" | "quarterly" | "annual";

// People who manage tenders bid for every department, so they can target any of them.
export function useTenderDepartmentOptions() {
  const departmentsQ = useDepartments();
  const { hasRole } = useAuth();
  const bidTeam = usePermissions().canManageTenders;
  const data = (departmentsQ.data ?? []).filter((d) => bidTeam || hasRole(d.code as AppRole));
  return { ...departmentsQ, data };
}

/** Hands an awarded tender to the department that delivers it, creating its project. */
export function ForwardTenderDialog({
  tender,
  open,
  onOpenChange,
}: {
  tender: TenderRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return open ? <ForwardTenderForm tender={tender} onDone={() => onOpenChange(false)} /> : null;
}

function ForwardTenderForm({ tender, onDone }: { tender: TenderRow; onDone: () => void }) {
  const departmentsQ = useTenderDepartmentOptions();
  const destinations = departmentsQ.data.filter((d) => d.code !== "tender");
  const hasContract = !!tender.contract_id;
  const initial = {
    departmentId: tender.department_code !== "tender" ? tender.department_id : "",
    name: tender.title,
    clientId: tender.client_id ?? "",
    startDate: new Date().toISOString().slice(0, 10),
    createContract: false,
    contractNumber: "",
    billingFrequency: "one_off" as BillingFrequency,
  };
  type FormState = typeof initial;
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const dirty = (Object.keys(initial) as (keyof FormState)[]).some((k) => form[k] !== initial[k]);
  const { guardClose } = useUnsavedChanges(dirty);
  const convert = useConvertTenderToProject();

  const submit = () => {
    const next: typeof errors = {};
    if (!form.departmentId)
      next.departmentId = "Choose the department that will deliver this work.";
    if (!form.name.trim()) next.name = "Give the project a name.";
    if (!form.startDate) next.startDate = "Choose the date work starts.";
    if (form.createContract && !form.clientId)
      next.clientId = "A contract needs a client. Pick or create one, or turn off the contract.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    convert.mutate(
      {
        tenderId: tender.id,
        departmentId: form.departmentId,
        name: form.name.trim(),
        clientId: form.clientId || undefined,
        startDate: form.startDate,
        createContract: form.createContract && !hasContract,
        contractNumber: form.createContract ? form.contractNumber.trim() || undefined : undefined,
        billingFrequency: form.createContract ? form.billingFrequency : undefined,
      },
      {
        onSuccess: () => {
          const dept =
            destinations.find((d) => d.id === form.departmentId)?.name ?? "the department";
          toast.success(`Forwarded to ${dept}. Their project has been created.`);
          onDone();
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Forwarding didn't save"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onDone)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Forward to department</DialogTitle>
            <DialogDescription>
              Creates a delivery project for “{tender.title}” in the department you choose.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <RequiredNote />
            <FormField
              id="forward-department"
              label="Delivering department"
              required
              error={errors.departmentId}
            >
              <Select value={form.departmentId} onValueChange={(v) => set("departmentId", v)}>
                <SelectTrigger id="forward-department" aria-invalid={!!errors.departmentId}>
                  <SelectValue placeholder="Choose a department…" />
                </SelectTrigger>
                <SelectContent>
                  {destinations.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="forward-name" label="Project name" required error={errors.name}>
              <Input
                id="forward-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                aria-invalid={!!errors.name}
              />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                id="forward-client"
                label="Client"
                required={form.createContract}
                error={errors.clientId}
                hint={
                  !form.clientId && tender.prospect_client_name
                    ? `Tracked as prospect “${tender.prospect_client_name}”. Choose “Create new client…” to add them.`
                    : undefined
                }
              >
                <ClientPicker
                  value={form.clientId}
                  onChange={(v) => set("clientId", v)}
                  allowNone={!form.createContract}
                  suggestedName={tender.prospect_client_name}
                  placeholder="Select or create a client…"
                />
              </FormField>
              <FormField id="forward-start" label="Start date" required error={errors.startDate}>
                <Input
                  id="forward-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set("startDate", e.target.value)}
                  aria-invalid={!!errors.startDate}
                />
              </FormField>
            </div>

            <div className="rounded-md border p-3">
              {hasContract ? (
                <p className="text-xs text-muted-foreground">
                  Contract {tender.contract_number ?? ""} already exists and will be linked to the
                  project.
                </p>
              ) : (
                <>
                  <label
                    htmlFor="forward-with-contract"
                    className="flex items-center gap-3 text-sm font-medium"
                  >
                    <Switch
                      id="forward-with-contract"
                      checked={form.createContract}
                      onCheckedChange={(v) => set("createContract", v)}
                    />
                    Also create a contract
                  </label>
                  {form.createContract && (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField
                        id="forward-contract-number"
                        label="Contract number"
                        hint="Filled in for you if left blank."
                      >
                        <Input
                          id="forward-contract-number"
                          value={form.contractNumber}
                          onChange={(e) => set("contractNumber", e.target.value)}
                        />
                      </FormField>
                      <FormField id="forward-billing" label="Billing frequency" required>
                        <Select
                          value={form.billingFrequency}
                          onValueChange={(v) => set("billingFrequency", v as BillingFrequency)}
                        >
                          <SelectTrigger id="forward-billing">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="one_off">One-off</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="annual">Annual</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormField>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => guardClose(onDone)}>
              Cancel
            </Button>
            <Button type="submit" disabled={convert.isPending}>
              {convert.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Forward to department
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
