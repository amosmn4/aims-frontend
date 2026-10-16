import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  useCampaigns,
  useCampaignRoi,
  useSaveCampaign,
  useDeleteCampaign,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_STYLES,
  type CampaignRow,
  type CampaignStatus,
} from "@/features/marketing/use-campaigns";
import { PageHeader } from "@/components/app-shell";
import { confirmDialog } from "@/components/confirm-dialog";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/marketing/campaigns")({
  head: () => ({ meta: [{ title: "Campaigns — AIMS" }] }),
  component: Campaigns,
});

const currency = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

function RoiCell({ campaignId, hasBudget }: { campaignId: string; hasBudget: boolean }) {
  const roiQ = useCampaignRoi(campaignId);
  if (roiQ.isLoading)
    return (
      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Loading" />
    );
  const roi = roiQ.data;
  if (!roi) return <span className="text-muted-foreground">—</span>;
  const detail = (
    <span className="text-xs text-muted-foreground">
      {roi.convertedCount} of {roi.leadsCount} leads converted · Ksh {currency(roi.revenue)} revenue
    </span>
  );
  if (!hasBudget) return detail;
  const pct = roi.roi !== null ? Math.round(roi.roi * 100) : null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge
        variant="secondary"
        className={
          pct !== null && pct >= 0
            ? "bg-success/15 text-success"
            : "bg-destructive/15 text-destructive"
        }
      >
        {pct !== null ? `Return ${pct >= 0 ? "+" : ""}${pct}%` : "—"}
      </Badge>
      {detail}
    </div>
  );
}

function Campaigns() {
  const { isAdminOrCeo, hasRole } = useAuth();
  const canManage = isAdminOrCeo || hasRole("marketing");
  const campaignsQ = useCampaigns();
  const deleteCampaign = useDeleteCampaign();
  const [editing, setEditing] = useState<CampaignRow | "new" | null>(null);
  const campaigns = campaignsQ.data ?? [];

  const remove = async (c: CampaignRow) => {
    const ok = await confirmDialog({
      title: `Delete campaign "${c.name}"?`,
      description: "Leads stay, but they won't be linked to this campaign. This can't be undone.",
      confirmLabel: "Delete campaign",
      destructive: true,
    });
    if (!ok) return;
    deleteCampaign.mutate(c.id, {
      onSuccess: () => toast.success("Campaign deleted"),
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Couldn't delete the campaign"),
    });
  };

  const newButton = (
    <Button size="sm" onClick={() => setEditing("new")}>
      <Plus className="mr-1 h-4 w-4" /> New campaign
    </Button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Campaigns"
        description="What we spend on marketing, the leads each campaign brings in and the revenue they turn into."
        actions={canManage ? newButton : undefined}
      />
      {!canManage && <ViewOnlyBanner area="campaigns" />}

      {campaignsQ.isError ? (
        <LoadError what="campaigns" error={campaignsQ.error} onRetry={() => campaignsQ.refetch()} />
      ) : campaignsQ.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-12 text-center">
          <p className="text-sm font-medium">No campaigns yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add a campaign, then link new leads to it to see what it brings in.
          </p>
          {canManage && <div className="mt-3">{newButton}</div>}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Results</TableHead>
                {canManage && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    {(c.startDate || c.endDate) && (
                      <div className="text-xs text-muted-foreground">
                        {formatDate(c.startDate, "No start date")} –{" "}
                        {formatDate(c.endDate, "no end date")}
                      </div>
                    )}
                    {c.notes && (
                      <div className="line-clamp-1 text-xs text-muted-foreground">{c.notes}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.channel ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={CAMPAIGN_STATUS_STYLES[c.status]} variant="secondary">
                      {CAMPAIGN_STATUS_LABELS[c.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {c.budget !== null ? `Ksh ${currency(c.budget)}` : "—"}
                  </TableCell>
                  <TableCell>
                    <RoiCell campaignId={c.id} hasBudget={c.budget !== null} />
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditing(c)}
                          aria-label={`Edit campaign ${c.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={deleteCampaign.isPending}
                          onClick={() => remove(c)}
                          aria-label={`Delete campaign ${c.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <EditCampaignDialog value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function EditCampaignDialog({
  value,
  onClose,
}: {
  value: CampaignRow | "new" | null;
  onClose: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const { guardClose } = useUnsavedChanges(!!value && dirty);
  const close = () => {
    setDirty(false);
    onClose();
  };
  return (
    <Dialog open={!!value} onOpenChange={(open) => !open && guardClose(close)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {value && (
          <EditCampaignForm
            key={value === "new" ? "new" : value.id}
            value={value === "new" ? null : value}
            onDirtyChange={setDirty}
            onCancel={() => guardClose(close)}
            onDone={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type CampaignForm = {
  name: string;
  channel: string;
  status: CampaignStatus;
  budget: string;
  startDate: string;
  endDate: string;
  notes: string;
};

function EditCampaignForm({
  value,
  onDirtyChange,
  onCancel,
  onDone,
}: {
  value: CampaignRow | null;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const save = useSaveCampaign();
  const [initial] = useState<CampaignForm>(() => ({
    name: value?.name ?? "",
    channel: value?.channel ?? "",
    status: value?.status ?? "planned",
    budget: value?.budget?.toString() ?? "",
    startDate: value?.startDate?.slice(0, 10) ?? "",
    endDate: value?.endDate?.slice(0, 10) ?? "",
    notes: value?.notes ?? "",
  }));
  const [form, setForm] = useState<CampaignForm>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof CampaignForm, string>>>({});

  const set = <K extends keyof CampaignForm>(key: K, v: CampaignForm[K]) => {
    const next = { ...form, [key]: v };
    setForm(next);
    setErrors((e) => ({ ...e, [key]: undefined }));
    onDirtyChange(
      (Object.keys(initial) as (keyof CampaignForm)[]).some((k) => next[k] !== initial[k]),
    );
  };

  const submit = () => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Enter the campaign name";
    if (form.budget && (!Number.isFinite(Number(form.budget)) || Number(form.budget) < 0))
      next.budget = "Enter a budget of 0 or more, or leave it empty";
    if (form.startDate && form.endDate && form.endDate < form.startDate)
      next.endDate = "The end date can't be before the start date";
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate(
      {
        id: value?.id,
        name: form.name.trim(),
        channel: form.channel.trim() || undefined,
        status: form.status,
        budget: form.budget ? Number(form.budget) : undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        notes: form.notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(value ? "Campaign saved" : "Campaign added");
          onDone();
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Couldn't save the campaign"),
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{value ? `Edit ${value.name}` : "New campaign"}</DialogTitle>
        <DialogDescription>Link leads to this campaign when you add them.</DialogDescription>
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
        <FormField id="campaign-name" label="Name" required error={errors.name}>
          <Input
            id="campaign-name"
            value={form.name}
            aria-invalid={!!errors.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Q3 LinkedIn push"
          />
        </FormField>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField id="campaign-channel" label="Channel">
            <Input
              id="campaign-channel"
              value={form.channel}
              onChange={(e) => set("channel", e.target.value)}
              placeholder="LinkedIn, email…"
            />
          </FormField>
          <FormField id="campaign-status" label="Status">
            <Select value={form.status} onValueChange={(v) => set("status", v as CampaignStatus)}>
              <SelectTrigger id="campaign-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CAMPAIGN_STATUS_LABELS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <FormField id="campaign-budget" label="Budget (Ksh)" error={errors.budget}>
          <Input
            id="campaign-budget"
            type="number"
            min={0}
            inputMode="decimal"
            value={form.budget}
            aria-invalid={!!errors.budget}
            onChange={(e) => set("budget", e.target.value)}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField id="campaign-start" label="Start date">
            <Input
              id="campaign-start"
              type="date"
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </FormField>
          <FormField id="campaign-end" label="End date" error={errors.endDate}>
            <Input
              id="campaign-end"
              type="date"
              min={form.startDate || undefined}
              value={form.endDate}
              aria-invalid={!!errors.endDate}
              onChange={(e) => set("endDate", e.target.value)}
            />
          </FormField>
        </div>
        <FormField id="campaign-notes" label="Notes">
          <Textarea
            id="campaign-notes"
            rows={2}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </FormField>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {value ? "Save campaign" : "Add campaign"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
