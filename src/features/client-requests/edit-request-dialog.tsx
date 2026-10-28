import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField, RequiredNote } from "@/components/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/permissions";
import {
  useSaveClientRequest,
  SOURCE_LABELS,
  type ClientRequestRow,
  type ClientRequestSource,
} from "@/features/client-requests/use-client-requests";
import { useDepartments, useProfilesLite } from "@/features/clients/use-clients-contracts";
import { useServiceLines } from "@/features/finance/use-finance-data";
import { ClientPicker } from "@/features/clients/client-picker";

const NONE = "__none__";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EditRequestDialog({
  request,
  onClose,
}: {
  request: ClientRequestRow;
  onClose: () => void;
}) {
  const { canWriteDepartment } = useAuth();
  const isIntake = usePermissions().canManageIntake;
  const initial = {
    title: request.title,
    source: request.source,
    departmentId: request.department_id ?? "",
    assignedToId: request.assigned_to_id ?? "",
    clientMode: (request.client_id || !request.prospect_client_name ? "existing" : "prospect") as
      "existing" | "prospect",
    clientId: request.client_id ?? "",
    prospectClientName: request.prospect_client_name ?? "",
    contactName: request.contact_name ?? "",
    contactEmail: request.contact_email ?? "",
    contactPhone: request.contact_phone ?? "",
    serviceLineId: request.service_line_id ?? "",
    estimatedValue: request.estimated_value != null ? String(request.estimated_value) : "",
    description: request.description ?? "",
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

  const departmentsQ = useDepartments();
  const serviceLinesQ = useServiceLines();
  const profilesQ = useProfilesLite();
  const save = useSaveClientRequest();

  // Intake can route anywhere; a department user only between departments they manage.
  const departmentOptions = (departmentsQ.data ?? []).filter(
    (d) =>
      d.code !== "operations" &&
      (isIntake || canWriteDepartment(d.code) || d.id === request.department_id),
  );
  const isConverted = !!request.converted_project_id || !!request.converted_contract_id;

  const validate = () => {
    const next: typeof errors = {};
    if (!form.title.trim()) next.title = "Say what the client is asking for.";
    if (!form.departmentId && request.department_id && !isIntake)
      next.departmentId = "Only Operations can take a request back from a department.";
    if (form.contactEmail.trim() && !EMAIL_RE.test(form.contactEmail.trim()))
      next.contactEmail = "Enter a valid email address, e.g. name@company.com.";
    if (form.estimatedValue && Number(form.estimatedValue) < 0)
      next.estimatedValue = "Value can't be negative.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    save.mutate(
      {
        id: request.id,
        title: form.title.trim(),
        source: form.source,
        department_id: form.departmentId,
        assigned_to_id: form.assignedToId,
        client_id: form.clientMode === "existing" ? form.clientId : "",
        prospect_client_name: form.clientMode === "prospect" ? form.prospectClientName.trim() : "",
        contact_name: form.contactName.trim(),
        contact_email: form.contactEmail.trim(),
        contact_phone: form.contactPhone.trim(),
        service_line_id: form.serviceLineId,
        estimated_value: form.estimatedValue ? Number(form.estimatedValue) : null,
        description: form.description.trim(),
      },
      {
        onSuccess: () => {
          toast.success("Client request updated");
          onClose();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Changes weren't saved"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && guardClose(onClose)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit client request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <RequiredNote />
            <FormField
              id="edit-request-title"
              label="What is being requested?"
              required
              error={errors.title}
            >
              <Input
                id="edit-request-title"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                aria-invalid={!!errors.title}
                required
              />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                id="edit-request-department"
                label="Department"
                error={errors.departmentId}
                hint={
                  isConverted
                    ? "Locked: a project has already been started from this request."
                    : undefined
                }
              >
                <Select
                  value={form.departmentId || NONE}
                  onValueChange={(v) => set("departmentId", v === NONE ? "" : v)}
                  disabled={isConverted}
                >
                  <SelectTrigger id="edit-request-department">
                    <SelectValue placeholder="Not routed yet" />
                  </SelectTrigger>
                  <SelectContent>
                    {isIntake && <SelectItem value={NONE}>Not routed yet (Operations)</SelectItem>}
                    {departmentOptions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="edit-request-assignee" label="Assigned to">
                <Select
                  value={form.assignedToId || NONE}
                  onValueChange={(v) => set("assignedToId", v === NONE ? "" : v)}
                >
                  <SelectTrigger id="edit-request-assignee">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unassigned</SelectItem>
                    {(profilesQ.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name ?? p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField id="edit-request-source" label="Source">
                <Select
                  value={form.source}
                  onValueChange={(v) => set("source", v as ClientRequestSource)}
                >
                  <SelectTrigger id="edit-request-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SOURCE_LABELS).map(([v, label]) => (
                      <SelectItem key={v} value={v}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="edit-request-service-line" label="Service line">
                <Select
                  value={form.serviceLineId || NONE}
                  onValueChange={(v) => set("serviceLineId", v === NONE ? "" : v)}
                >
                  <SelectTrigger id="edit-request-service-line">
                    <SelectValue placeholder="Not sure yet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not sure yet</SelectItem>
                    {(serviceLinesQ.data ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="edit-request-client" className="text-sm font-medium">
                  Client
                </label>
                <button
                  type="button"
                  onClick={() =>
                    set("clientMode", form.clientMode === "existing" ? "prospect" : "existing")
                  }
                  className="text-xs text-primary hover:underline"
                >
                  {form.clientMode === "existing"
                    ? "Not a client yet? Type the company name"
                    : "Pick or create a client"}
                </button>
              </div>
              <div className="mt-1">
                {form.clientMode === "existing" ? (
                  <ClientPicker
                    value={form.clientId}
                    onChange={(v) => set("clientId", v)}
                    allowNone
                    suggestedName={form.prospectClientName}
                    placeholder="Not yet known"
                  />
                ) : (
                  <Input
                    id="edit-request-client"
                    value={form.prospectClientName}
                    onChange={(e) => set("prospectClientName", e.target.value)}
                    placeholder="Company name (not in the system yet)"
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField id="edit-request-contact" label="Contact name">
                <Input
                  id="edit-request-contact"
                  value={form.contactName}
                  onChange={(e) => set("contactName", e.target.value)}
                />
              </FormField>
              <FormField id="edit-request-email" label="Contact email" error={errors.contactEmail}>
                <Input
                  id="edit-request-email"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => set("contactEmail", e.target.value)}
                  aria-invalid={!!errors.contactEmail}
                />
              </FormField>
              <FormField id="edit-request-phone" label="Contact phone">
                <Input
                  id="edit-request-phone"
                  type="tel"
                  value={form.contactPhone}
                  onChange={(e) => set("contactPhone", e.target.value)}
                />
              </FormField>
            </div>
            <FormField
              id="edit-request-value"
              label="Estimated value"
              error={errors.estimatedValue}
            >
              <Input
                id="edit-request-value"
                type="number"
                min={0}
                value={form.estimatedValue}
                onChange={(e) => set("estimatedValue", e.target.value)}
                aria-invalid={!!errors.estimatedValue}
              />
            </FormField>
            <FormField id="edit-request-description" label="Details">
              <Textarea
                id="edit-request-description"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => guardClose(onClose)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save client request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
