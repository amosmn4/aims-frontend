import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { useSaveCampaign } from "@/features/marketing/use-campaigns";
import { FormField, RequiredNote } from "@/components/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const blank = { name: "", channel: "", budget: "", startDate: "", endDate: "" };
type CampaignForm = typeof blank;

/** Starts a campaign from the Marketing dashboard, without a trip to the campaigns page. */
export function NewCampaignDialog({ onCreated }: { onCreated?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CampaignForm>(blank);
  const [error, setError] = useState<string | null>(null);
  const save = useSaveCampaign();
  const dirty = (Object.keys(blank) as (keyof CampaignForm)[]).some((k) => form[k] !== blank[k]);
  const { guardClose } = useUnsavedChanges(open && dirty);

  const set = <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };

  const close = () => {
    setOpen(false);
    setForm(blank);
    setError(null);
  };

  const submit = () => {
    if (!form.name.trim()) {
      setError("Give the campaign a name.");
      return;
    }
    save.mutate(
      {
        name: form.name.trim(),
        channel: form.channel.trim() || undefined,
        budget: form.budget ? Number(form.budget) : undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      },
      {
        onSuccess: (id) => {
          toast.success("Campaign added");
          onCreated?.(id);
          close();
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "The campaign wasn't saved"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : guardClose(close))}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" /> New campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <RequiredNote />
            <FormField id="campaign-name" label="Campaign name" required error={error ?? undefined}>
              <Input
                id="campaign-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. September HRMS webinar"
                aria-invalid={!!error}
              />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField id="campaign-channel" label="Channel" hint="Where it runs">
                <Input
                  id="campaign-channel"
                  value={form.channel}
                  onChange={(e) => set("channel", e.target.value)}
                  placeholder="e.g. LinkedIn, radio, email"
                />
              </FormField>
              <FormField id="campaign-budget" label="Budget" hint="What you plan to spend">
                <Input
                  id="campaign-budget"
                  type="number"
                  min={0}
                  value={form.budget}
                  onChange={(e) => set("budget", e.target.value)}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField id="campaign-start" label="Starts">
                <Input
                  id="campaign-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set("startDate", e.target.value)}
                />
              </FormField>
              <FormField id="campaign-end" label="Ends">
                <Input
                  id="campaign-end"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => set("endDate", e.target.value)}
                />
              </FormField>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => guardClose(close)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add campaign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
