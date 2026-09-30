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
import { useSaveTender, type TenderRow } from "@/features/tender/use-tender";
import { useTenderDepartmentOptions } from "@/features/tender/forward-tender-dialog";
import { useServiceLines } from "@/features/finance/use-finance-data";
import { useProfilesLite } from "@/features/clients/use-clients-contracts";
import { ClientPicker } from "@/features/clients/client-picker";

const NONE = "__none__";

export function EditTenderDialog({ tender, onClose }: { tender: TenderRow; onClose: () => void }) {
  const initial = {
    title: tender.title,
    referenceNumber: tender.reference_number ?? "",
    departmentId: tender.department_id,
    clientMode: (tender.client_id || !tender.prospect_client_name ? "existing" : "prospect") as
      "existing" | "prospect",
    clientId: tender.client_id ?? "",
    prospectClientName: tender.prospect_client_name ?? "",
    serviceLineId: tender.service_line_id ?? "",
    accountManagerId: tender.account_manager_id ?? "",
    estimatedValue: tender.estimated_value != null ? String(tender.estimated_value) : "",
    submissionDeadline: tender.submission_deadline ?? "",
    description: tender.description ?? "",
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

  const departmentsQ = useTenderDepartmentOptions();
  const serviceLinesQ = useServiceLines();
  const profilesQ = useProfilesLite();
  const save = useSaveTender();

  const submit = () => {
    const next: typeof errors = {};
    if (!form.title.trim()) next.title = "Enter the tender title.";
    if (!form.departmentId) next.departmentId = "Choose a department.";
    if (form.estimatedValue && Number(form.estimatedValue) < 0)
      next.estimatedValue = "Value can't be negative.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    save.mutate(
      {
        id: tender.id,
        title: form.title.trim(),
        reference_number: form.referenceNumber.trim(),
        department_id: form.departmentId,
        client_id: form.clientMode === "existing" ? form.clientId : "",
        prospect_client_name: form.clientMode === "prospect" ? form.prospectClientName.trim() : "",
        service_line_id: form.serviceLineId,
        account_manager_id: form.accountManagerId,
        estimated_value: form.estimatedValue ? Number(form.estimatedValue) : null,
        submission_deadline: form.submissionDeadline,
        description: form.description.trim(),
      },
      {
        onSuccess: () => {
          toast.success("Tender updated");
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
            <DialogTitle>Edit tender</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <RequiredNote />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField
                id="edit-tender-title"
                label="Title"
                required
                error={errors.title}
                className="sm:col-span-2"
              >
                <Input
                  id="edit-tender-title"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  aria-invalid={!!errors.title}
                />
              </FormField>
              <FormField id="edit-tender-ref" label="Reference number">
                <Input
                  id="edit-tender-ref"
                  value={form.referenceNumber}
                  onChange={(e) => set("referenceNumber", e.target.value)}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                id="edit-tender-department"
                label="Department"
                required
                error={errors.departmentId}
              >
                <Select value={form.departmentId} onValueChange={(v) => set("departmentId", v)}>
                  <SelectTrigger id="edit-tender-department" aria-invalid={!!errors.departmentId}>
                    <SelectValue placeholder="Choose a department…" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentsQ.data.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="edit-tender-client" className="text-sm font-medium">
                    Client
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      set("clientMode", form.clientMode === "existing" ? "prospect" : "existing")
                    }
                    className="text-xs text-primary hover:underline"
                  >
                    {form.clientMode === "existing" ? "Type a company name" : "Pick a client"}
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
                      id="edit-tender-client"
                      value={form.prospectClientName}
                      onChange={(e) => set("prospectClientName", e.target.value)}
                      placeholder="Company name (not in the system yet)"
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField id="edit-tender-service-line" label="Service line">
                <Select
                  value={form.serviceLineId || NONE}
                  onValueChange={(v) => set("serviceLineId", v === NONE ? "" : v)}
                >
                  <SelectTrigger id="edit-tender-service-line">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {(serviceLinesQ.data ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="edit-tender-owner" label="Owner">
                <Select
                  value={form.accountManagerId || NONE}
                  onValueChange={(v) => set("accountManagerId", v === NONE ? "" : v)}
                >
                  <SelectTrigger id="edit-tender-owner">
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
              <FormField
                id="edit-tender-value"
                label="Estimated value"
                error={errors.estimatedValue}
              >
                <Input
                  id="edit-tender-value"
                  type="number"
                  min={0}
                  value={form.estimatedValue}
                  onChange={(e) => set("estimatedValue", e.target.value)}
                  aria-invalid={!!errors.estimatedValue}
                />
              </FormField>
              <FormField id="edit-tender-deadline" label="Submission deadline">
                <Input
                  id="edit-tender-deadline"
                  type="date"
                  value={form.submissionDeadline}
                  onChange={(e) => set("submissionDeadline", e.target.value)}
                />
              </FormField>
            </div>
            <FormField id="edit-tender-description" label="Description">
              <Textarea
                id="edit-tender-description"
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
              Save tender
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
