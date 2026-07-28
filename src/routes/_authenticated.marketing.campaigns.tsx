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
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/marketing/campaigns")({
  head: () => ({ meta: [{ title: "Campaigns — AIMS" }] }),
  component: Campaigns,
});

const currency = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 0 });

function RoiCell({ campaignId, hasBudget }: { campaignId: string; hasBudget: boolean }) {
  const roiQ = useCampaignRoi(campaignId);
  if (roiQ.isLoading) return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
  const roi = roiQ.data;
  if (!roi) return <span className="text-muted-foreground">—</span>;
  if (!hasBudget) {
    return (
      <span className="text-xs text-muted-foreground">
        {roi.convertedCount}/{roi.leadsCount} converted · Ksh {currency(roi.revenue)} revenue
      </span>
    );
  }
  const pct = roi.roi !== null ? Math.round(roi.roi * 100) : null;
  return (
    <div className="flex items-center gap-2">
      <Badge
        variant="secondary"
        className={pct !== null && pct >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}
      >
        {pct !== null ? `${pct >= 0 ? "+" : ""}${pct}%` : "—"}
      </Badge>
      <span className="text-xs text-muted-foreground">
        {roi.convertedCount}/{roi.leadsCount} converted · Ksh {currency(roi.revenue)} revenue
      </span>
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Campaigns</h1>
          <p className="text-xs text-muted-foreground">
            Marketing spend against leads generated and revenue converted.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4 mr-1" /> New campaign
          </Button>
        )}
      </div>

      {campaignsQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
          No campaigns yet.
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>ROI</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    {c.notes && <div className="text-xs text-muted-foreground line-clamp-1">{c.notes}</div>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.channel ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className={CAMPAIGN_STATUS_STYLES[c.status]} variant="secondary">
                      {CAMPAIGN_STATUS_LABELS[c.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.budget !== null ? `Ksh ${currency(c.budget)}` : "—"}
                  </TableCell>
                  <TableCell>
                    <RoiCell campaignId={c.id} hasBudget={c.budget !== null} />
                  </TableCell>
                  <TableCell>
                    {canManage && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEditing(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (!window.confirm(`Remove "${c.name}"?`)) return;
                            deleteCampaign.mutate(c.id, {
                              onError: (err) =>
                                toast.error(err instanceof Error ? err.message : "Failed to delete"),
                            });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
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
  return (
    <Dialog open={!!value} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {value && <EditCampaignForm value={value === "new" ? null : value} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function EditCampaignForm({ value, onDone }: { value: CampaignRow | null; onDone: () => void }) {
  const save = useSaveCampaign();
  const [name, setName] = useState(value?.name ?? "");
  const [channel, setChannel] = useState(value?.channel ?? "");
  const [status, setStatus] = useState<CampaignStatus>(value?.status ?? "planned");
  const [budget, setBudget] = useState(value?.budget?.toString() ?? "");
  const [startDate, setStartDate] = useState(value?.startDate?.slice(0, 10) ?? "");
  const [endDate, setEndDate] = useState(value?.endDate?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(value?.notes ?? "");

  const submit = () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    save.mutate(
      {
        id: value?.id,
        name: name.trim(),
        channel: channel || undefined,
        status,
        budget: budget ? Number(budget) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success(value ? "Updated" : "Campaign added");
          onDone();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{value ? "Edit campaign" : "New campaign"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q3 LinkedIn Push" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Channel</Label>
            <Input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="LinkedIn, Email…" />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as CampaignStatus)}>
              <SelectTrigger>
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
          </div>
        </div>
        <div>
          <Label>Budget (Ksh)</Label>
          <Input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Start date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>End date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </>
  );
}
