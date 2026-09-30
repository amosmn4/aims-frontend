import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Rocket } from "lucide-react";
import {
  useConvertToProject,
  useConvertClientRequestToContract,
  type ClientRequestRow,
} from "@/features/client-requests/use-client-requests";
import { ClientPicker } from "@/features/clients/client-picker";
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

type BillingFrequency = "monthly" | "quarterly" | "annual";

const today = () => new Date().toISOString().slice(0, 10);
const errorText = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

/** One form that turns a won client request into a project, and optionally a recurring contract. */
export function StartProjectDialog({
  request,
  open,
  onOpenChange,
}: {
  request: ClientRequestRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return open ? <StartProjectForm request={request} onClose={() => onOpenChange(false)} /> : null;
}

function StartProjectForm({
  request,
  onClose,
}: {
  request: ClientRequestRow;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const convertToProject = useConvertToProject();
  const convertToContract = useConvertClientRequestToContract();

  const initial = {
    clientId: request.client_id ?? "",
    name: request.title,
    startDate: today(),
    withContract: false,
    contractNumber: `CTR-${request.reference_number ?? request.id.slice(0, 8).toUpperCase()}`,
    billingFrequency: "monthly" as BillingFrequency,
    value: request.estimated_value != null ? String(request.estimated_value) : "",
  };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof initial, string>>>({});
  const set = <K extends keyof typeof initial>(key: K, value: (typeof initial)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some(
    (k) => form[k] !== initial[k],
  );
  const { guardClose } = useUnsavedChanges(dirty);
  const pending = convertToProject.isPending || convertToContract.isPending;
  const prospect = !request.client_id ? request.prospect_client_name : null;

  const validate = () => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Give the project a name.";
    if (!form.startDate) next.startDate = "Choose the date work starts.";
    if (form.withContract) {
      if (!form.clientId)
        next.clientId = "A recurring contract needs a client. Pick or create one.";
      if (!form.contractNumber.trim()) next.contractNumber = "Enter a contract number.";
      if (form.value && Number(form.value) < 0) next.value = "Value can't be negative.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    let projectId: string;
    try {
      const project = await convertToProject.mutateAsync({
        requestId: request.id,
        name: form.name.trim(),
        clientId: form.clientId || undefined,
        startDate: form.startDate,
      });
      projectId = project.id;
    } catch (err) {
      toast.error(errorText(err, "The project couldn't be started"));
      return;
    }
    if (form.withContract) {
      try {
        await convertToContract.mutateAsync({
          requestId: request.id,
          clientId: form.clientId || undefined,
          contractNumber: form.contractNumber.trim(),
          billingFrequency: form.billingFrequency,
          startDate: form.startDate,
          value: form.value ? Number(form.value) : undefined,
          currency: request.currency,
        });
      } catch (err) {
        const message = errorText(err, "The contract couldn't be created");
        setErrors((e) => ({ ...e, contractNumber: message }));
        toast.error(`Project started, but the contract wasn't created: ${message}`);
        return;
      }
    }
    toast.success(form.withContract ? "Project and contract created" : "Project started");
    onClose();
    navigate({ to: "/projects/$projectId", params: { projectId } });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onClose)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          noValidate
        >
          <DialogHeader>
            <DialogTitle>Start project from request</DialogTitle>
            <DialogDescription>
              Creates a project for “{request.title}” in{" "}
              {request.department_name ?? "its department"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <RequiredNote />
            <FormField
              id="start-client"
              label="Client"
              required={form.withContract}
              error={errors.clientId}
              hint={
                prospect
                  ? `Logged as prospect “${prospect}”. Choose “Create new client…” to add them.`
                  : "Confirm the client, or choose “Create new client…”."
              }
            >
              <ClientPicker
                value={form.clientId}
                onChange={(v) => set("clientId", v)}
                allowNone={!form.withContract}
                suggestedName={prospect}
                departmentId={request.department_id ?? undefined}
                placeholder="Select or create the client…"
              />
            </FormField>
            <FormField id="start-name" label="Project name" required error={errors.name}>
              <Input
                id="start-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                aria-invalid={!!errors.name}
                required
              />
            </FormField>
            <FormField id="start-date" label="Start date" required error={errors.startDate}>
              <Input
                id="start-date"
                type="date"
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
                aria-invalid={!!errors.startDate}
                required
              />
            </FormField>

            <div className="rounded-md border p-3">
              <label
                htmlFor="start-with-contract"
                className="flex items-center gap-3 text-sm font-medium"
              >
                <Switch
                  id="start-with-contract"
                  checked={form.withContract}
                  onCheckedChange={(v) => set("withContract", v)}
                />
                Also create a recurring contract
              </label>
              {form.withContract && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField
                    id="start-contract-number"
                    label="Contract number"
                    required
                    error={errors.contractNumber}
                    className="sm:col-span-2"
                  >
                    <Input
                      id="start-contract-number"
                      value={form.contractNumber}
                      onChange={(e) => set("contractNumber", e.target.value)}
                      aria-invalid={!!errors.contractNumber}
                    />
                  </FormField>
                  <FormField id="start-billing" label="Billing frequency" required>
                    <Select
                      value={form.billingFrequency}
                      onValueChange={(v) => set("billingFrequency", v as BillingFrequency)}
                    >
                      <SelectTrigger id="start-billing">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField
                    id="start-value"
                    label={`Contract value (${request.currency})`}
                    error={errors.value}
                    hint="Prefilled from the request's estimate."
                  >
                    <Input
                      id="start-value"
                      type="number"
                      min={0}
                      value={form.value}
                      onChange={(e) => set("value", e.target.value)}
                      aria-invalid={!!errors.value}
                    />
                  </FormField>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => guardClose(onClose)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4 mr-1" />
              )}
              Start project from request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
