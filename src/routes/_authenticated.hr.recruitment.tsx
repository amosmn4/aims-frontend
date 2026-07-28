import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import {
  useRecruitmentEngagements,
  useSaveRecruitmentFunnel,
  FUNNEL_STAGE_LABELS,
  type RecruitmentEngagementRow,
  type FunnelStageKey,
} from "@/features/hr/use-recruitment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/hr/recruitment")({
  head: () => ({ meta: [{ title: "Recruitment — AIMS" }] }),
  component: RecruitmentReport,
});

const STAGE_ORDER: FunnelStageKey[] = [
  "applications_received",
  "screened",
  "interviewed",
  "offered",
  "placed",
];

function MiniFunnel({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-1 h-8">
      {values.map((v, i) => (
        <div
          key={i}
          className="w-3 rounded-sm bg-primary/70"
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
          title={`${FUNNEL_STAGE_LABELS[STAGE_ORDER[i]]}: ${v}`}
        />
      ))}
    </div>
  );
}

function RecruitmentReport() {
  const engagementsQ = useRecruitmentEngagements();
  const [editing, setEditing] = useState<RecruitmentEngagementRow | null>(null);
  const engagements = engagementsQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold text-sm">Recruitment funnel by engagement</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          AMSOL running recruitment as a service for a client — reported as stage counts, not
          individual candidate records. Update the numbers as a drive progresses.
        </p>
      </div>

      {engagementsQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : engagements.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
          No HR projects yet.
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Engagement</TableHead>
                <TableHead className="text-right">Applications</TableHead>
                <TableHead className="text-right">Screened</TableHead>
                <TableHead className="text-right">Interviewed</TableHead>
                <TableHead className="text-right">Offered</TableHead>
                <TableHead className="text-right">Placed</TableHead>
                <TableHead>Trend</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {engagements.map((e) => {
                const f = e.funnel;
                const values = STAGE_ORDER.map((k) => (f ? f[k] : 0));
                return (
                  <TableRow key={e.project_id}>
                    <TableCell>
                      <div className="font-medium">{e.project_name}</div>
                      {e.client_name && (
                        <div className="text-xs text-muted-foreground">{e.client_name}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{f?.applications_received ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{f?.screened ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{f?.interviewed ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{f?.offered ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{f?.placed ?? "—"}</TableCell>
                    <TableCell>{f ? <MiniFunnel values={values} /> : "—"}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => setEditing(e)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <EditFunnelDialog engagement={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function EditFunnelDialog({
  engagement,
  onClose,
}: {
  engagement: RecruitmentEngagementRow | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!engagement} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {engagement && <EditFunnelForm engagement={engagement} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function EditFunnelForm({
  engagement,
  onDone,
}: {
  engagement: RecruitmentEngagementRow;
  onDone: () => void;
}) {
  const saveFunnel = useSaveRecruitmentFunnel(engagement.project_id);
  const f = engagement.funnel;
  const [applicationsReceived, setApplicationsReceived] = useState(String(f?.applications_received ?? 0));
  const [screened, setScreened] = useState(String(f?.screened ?? 0));
  const [interviewed, setInterviewed] = useState(String(f?.interviewed ?? 0));
  const [offered, setOffered] = useState(String(f?.offered ?? 0));
  const [placed, setPlaced] = useState(String(f?.placed ?? 0));
  const [notes, setNotes] = useState(f?.notes ?? "");

  const submit = () => {
    saveFunnel.mutate(
      {
        applicationsReceived: Number(applicationsReceived) || 0,
        screened: Number(screened) || 0,
        interviewed: Number(interviewed) || 0,
        offered: Number(offered) || 0,
        placed: Number(placed) || 0,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Recruitment funnel updated");
          onDone();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{engagement.project_name}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Applications Received</Label>
            <Input type="number" min={0} value={applicationsReceived} onChange={(e) => setApplicationsReceived(e.target.value)} />
          </div>
          <div>
            <Label>Screened</Label>
            <Input type="number" min={0} value={screened} onChange={(e) => setScreened(e.target.value)} />
          </div>
          <div>
            <Label>Interviewed</Label>
            <Input type="number" min={0} value={interviewed} onChange={(e) => setInterviewed(e.target.value)} />
          </div>
          <div>
            <Label>Offered</Label>
            <Input type="number" min={0} value={offered} onChange={(e) => setOffered(e.target.value)} />
          </div>
          <div>
            <Label>Placed</Label>
            <Input type="number" min={0} value={placed} onChange={(e) => setPlaced(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saveFunnel.isPending}>
          {saveFunnel.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </>
  );
}
