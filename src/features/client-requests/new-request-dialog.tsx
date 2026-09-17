import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import {
  useSaveClientRequest,
  SOURCE_LABELS,
  type ClientRequestSource,
} from "@/features/client-requests/use-client-requests";
import { useServiceLines } from "@/features/finance/use-finance-data";
import { useDepartments, useProfilesLite } from "@/features/clients/use-clients-contracts";
import { ClientPicker } from "@/features/clients/client-picker";
import { FormField, RequiredNote } from "@/components/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const NONE = "__none__";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface NewRequestDialogProps {
  /** Custom trigger element; defaults to a "New client request" button. */
  trigger?: ReactNode;
  /** Pre-selects a source; still editable. */
  defaultSource?: ClientRequestSource;
  /** Toast copy shown on success. */
  successMessage?: string;
  onCreated?: () => void;
}

const blank = (source: ClientRequestSource) => ({
  title: "",
  source,
  departmentId: "",
  assignedToId: "",
  clientMode: "existing" as "existing" | "prospect",
  clientId: "",
  prospectClientName: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  serviceLineId: "",
  estimatedValue: "",
  description: "",
});
type FormState = ReturnType<typeof blank>;

// The one client-request form, shared by the Requests overview and every Client requests board.
export function NewRequestDialog({
  trigger,
  defaultSource = "operations",
  successMessage,
  onCreated,
}: NewRequestDialogProps) {
  const [open, setOpen] = useState(false);
  const initial = blank(defaultSource);
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const serviceLinesQ = useServiceLines();
  const departmentsQ = useDepartments();
  const profilesQ = useProfilesLite();
  const save = useSaveClientRequest();

  const dirty = (Object.keys(initial) as (keyof FormState)[]).some((k) => form[k] !== initial[k]);
  const { guardClose } = useUnsavedChanges(open && dirty);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const close = () => {
    setOpen(false);
    setForm(blank(defaultSource));
    setErrors({});
  };

  const departments = (departmentsQ.data ?? []).filter((d) => d.code !== "operations");
  const departmentName = departments.find((d) => d.id === form.departmentId)?.name;

  const validate = () => {
    const next: typeof errors = {};
    if (!form.title.trim()) next.title = "Say what the client is asking for.";
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
        title: form.title.trim(),
        source: form.source,
        department_id: form.departmentId || undefined,
        assigned_to_id: form.departmentId ? form.assignedToId || undefined : undefined,
        client_id: form.clientMode === "existing" ? form.clientId || undefined : undefined,
        prospect_client_name:
          form.clientMode === "prospect" ? form.prospectClientName.trim() || undefined : undefined,
        contact_name: form.contactName.trim() || undefined,
        contact_email: form.contactEmail.trim() || undefined,
        contact_phone: form.contactPhone.trim() || undefined,
        service_line_id: form.serviceLineId || undefined,
        estimated_value: form.estimatedValue ? Number(form.estimatedValue) : undefined,
        description: form.description.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            successMessage ??
              (departmentName
                ? `Client request logged and routed to ${departmentName}`
                : "Client request logged"),
          );
          close();
          onCreated?.();
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "The request couldn't be logged"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : guardClose(close))}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> New client request
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>New client request</DialogTitle>
            <DialogDescription>
              Log what the client asked for and, if you know it, route it to a department now.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <RequiredNote />
            <FormField
              id="new-request-title"
              label="What is being requested?"
              required
              error={errors.title}
            >
              <Input
                id="new-request-title"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Payroll outsourcing for 120 staff"
                aria-invalid={!!errors.title}
                required
              />
            </FormField>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                id="new-request-department"
                label="Route to department"
                hint="Optional. Leave blank to route it later."
              >
                <Select
                  value={form.departmentId || NONE}
                  onValueChange={(v) => {
                    set("departmentId", v === NONE ? "" : v);
                    if (v === NONE) set("assignedToId", "");
                  }}
                >
                  <SelectTrigger id="new-request-department">
                    <SelectValue placeholder="Not routed yet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not routed yet</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                id="new-request-assignee"
                label="Assign to"
                hint={form.departmentId ? "Optional." : "Pick a department first."}
              >
                <Select
                  value={form.assignedToId || NONE}
                  onValueChange={(v) => set("assignedToId", v === NONE ? "" : v)}
                  disabled={!form.departmentId}
                >
                  <SelectTrigger id="new-request-assignee">
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

            <div>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="new-request-client" className="text-sm font-medium">
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
                    placeholder="Not yet known"
                  />
                ) : (
                  <Input
                    id="new-request-client"
                    value={form.prospectClientName}
                    onChange={(e) => set("prospectClientName", e.target.value)}
                    placeholder="Company name (not in the system yet)"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField id="new-request-contact" label="Contact name">
                <Input
                  id="new-request-contact"
                  value={form.contactName}
                  onChange={(e) => set("contactName", e.target.value)}
                  autoComplete="off"
                />
              </FormField>
              <FormField id="new-request-email" label="Contact email" error={errors.contactEmail}>
                <Input
                  id="new-request-email"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => set("contactEmail", e.target.value)}
                  aria-invalid={!!errors.contactEmail}
                  autoComplete="off"
                />
              </FormField>
              <FormField id="new-request-phone" label="Contact phone">
                <Input
                  id="new-request-phone"
                  type="tel"
                  value={form.contactPhone}
                  onChange={(e) => set("contactPhone", e.target.value)}
                  autoComplete="off"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField id="new-request-source" label="Source">
                <Select
                  value={form.source}
                  onValueChange={(v) => set("source", v as ClientRequestSource)}
                >
                  <SelectTrigger id="new-request-source">
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
              <FormField id="new-request-service-line" label="Service line">
                <Select
                  value={form.serviceLineId || NONE}
                  onValueChange={(v) => set("serviceLineId", v === NONE ? "" : v)}
                >
                  <SelectTrigger id="new-request-service-line">
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
              <FormField
                id="new-request-value"
                label="Estimated value"
                error={errors.estimatedValue}
              >
                <Input
                  id="new-request-value"
                  type="number"
                  min={0}
                  value={form.estimatedValue}
                  onChange={(e) => set("estimatedValue", e.target.value)}
                  aria-invalid={!!errors.estimatedValue}
                />
              </FormField>
            </div>

            <FormField id="new-request-description" label="Details">
              <Textarea
                id="new-request-description"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                placeholder="Anything the department should know before they call the client"
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => guardClose(close)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Log client request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
