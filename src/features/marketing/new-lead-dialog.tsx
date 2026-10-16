import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
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
import { useCampaigns } from "./use-campaigns";
import { useSaveLead, LEAD_SOURCE_LABELS, type LeadSource } from "./use-leads";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NONE = "__none__";

const blank = {
  name: "",
  company: "",
  contactEmail: "",
  contactPhone: "",
  source: "other" as LeadSource,
  notes: "",
  campaignId: "",
};
type LeadForm = typeof blank;

/** "Add lead" button and form, shared by the Marketing home and the Leads board. */
export function NewLeadDialog({
  trigger,
  onCreated,
}: {
  trigger?: ReactNode;
  onCreated?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<LeadForm>(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof LeadForm, string>>>({});
  const save = useSaveLead();
  const campaignsQ = useCampaigns();

  const dirty = (Object.keys(blank) as (keyof LeadForm)[]).some((k) => form[k] !== blank[k]);
  const { guardClose } = useUnsavedChanges(open && dirty);

  const set = <K extends keyof LeadForm>(key: K, value: LeadForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const close = () => {
    setOpen(false);
    setForm(blank);
    setErrors({});
  };

  const submit = () => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Enter the contact's name";
    if (form.contactEmail.trim() && !EMAIL_RE.test(form.contactEmail.trim()))
      next.contactEmail = "Enter a valid email, e.g. name@company.com";
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate(
      {
        name: form.name.trim(),
        company: form.company.trim() || undefined,
        contact_email: form.contactEmail.trim() || undefined,
        contact_phone: form.contactPhone.trim() || undefined,
        source: form.source,
        notes: form.notes.trim() || undefined,
        campaign_id: form.campaignId || undefined,
      },
      {
        onSuccess: (id) => {
          toast.success("Lead added");
          close();
          onCreated?.(id);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't add the lead"),
      },
    );
  };

  const campaigns = campaignsQ.data ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : guardClose(close))}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> Add lead
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add lead</DialogTitle>
          <DialogDescription>
            Someone who might buy from us. Log calls and emails on the lead once it's added.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <RequiredNote />
          <FormField id="lead-name" label="Contact name" required error={errors.name}>
            <Input
              id="lead-name"
              value={form.name}
              aria-invalid={!!errors.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Jane Wanjiru"
              autoFocus
            />
          </FormField>
          <FormField id="lead-company" label="Company">
            <Input
              id="lead-company"
              value={form.company}
              onChange={(e) => set("company", e.target.value)}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="lead-email" label="Email" error={errors.contactEmail}>
              <Input
                id="lead-email"
                type="email"
                value={form.contactEmail}
                aria-invalid={!!errors.contactEmail}
                onChange={(e) => set("contactEmail", e.target.value)}
              />
            </FormField>
            <FormField id="lead-phone" label="Phone">
              <Input
                id="lead-phone"
                type="tel"
                value={form.contactPhone}
                onChange={(e) => set("contactPhone", e.target.value)}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="lead-source" label="Where they came from">
              <Select value={form.source} onValueChange={(v) => set("source", v as LeadSource)}>
                <SelectTrigger id="lead-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAD_SOURCE_LABELS).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            {campaigns.length > 0 && (
              <FormField id="lead-campaign" label="Campaign">
                <Select
                  value={form.campaignId || NONE}
                  onValueChange={(v) => set("campaignId", v === NONE ? "" : v)}
                >
                  <SelectTrigger id="lead-campaign">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No campaign</SelectItem>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
          </div>
          <FormField id="lead-notes" label="Notes">
            <Textarea
              id="lead-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </FormField>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => guardClose(close)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Add lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
