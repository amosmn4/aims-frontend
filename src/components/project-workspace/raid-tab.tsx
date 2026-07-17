import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import {
  useRaidEntries,
  useCreateRaidEntry,
  type ProjectRaidType,
  type ProjectRaidSeverity,
  type ProjectRaidStatus,
} from "@/features/project-workspace/use-project-workspace";
import { RAID_TYPE_LABELS, RAID_TYPE_COLORS, RAID_SEVERITY_COLORS } from "@/features/project-workspace/workspace-theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RAID_TYPES: ProjectRaidType[] = ["risk", "issue", "dependency", "assumption"];
const RAID_SEVERITIES: ProjectRaidSeverity[] = ["low", "medium", "high"];

export function RaidTab({ projectId }: { projectId: string }) {
  const raidQ = useRaidEntries(projectId);

  return (
    <div className="ws-panel">
      <h3>
        RAID Log
        <span className="ws-section-label" style={{ margin: 0 }}>
          Risks · Assumptions · Issues · Dependencies
        </span>
        <AddRaidDialog projectId={projectId} />
      </h3>
      {raidQ.isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (raidQ.data ?? []).length === 0 ? (
        <div className="ws-section-label">No risks, issues, dependencies or assumptions logged yet.</div>
      ) : (
        <table className="raid">
          <tbody>
            <tr>
              <th>Type</th>
              <th>Description</th>
              <th>Severity</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Mitigation / Response</th>
            </tr>
            {(raidQ.data ?? []).map((r) => (
              <tr key={r.id}>
                <td>
                  <span
                    className="raid-type"
                    style={{ background: RAID_TYPE_COLORS[r.type].bg, color: RAID_TYPE_COLORS[r.type].c }}
                  >
                    {RAID_TYPE_LABELS[r.type]}
                  </span>
                </td>
                <td>{r.description}</td>
                <td>
                  <span
                    className="sev-pill"
                    style={{ background: RAID_SEVERITY_COLORS[r.severity].bg, color: RAID_SEVERITY_COLORS[r.severity].c }}
                  >
                    {r.severity}
                  </span>
                </td>
                <td>{r.owner ?? "—"}</td>
                <td className="capitalize">{r.status}</td>
                <td style={{ color: "var(--pipeline-slate)" }}>{r.mitigation ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AddRaidDialog({ projectId }: { projectId: string }) {
  const createEntry = useCreateRaidEntry(projectId);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ProjectRaidType>("risk");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<ProjectRaidSeverity>("medium");
  const [owner, setOwner] = useState("");
  const [mitigation, setMitigation] = useState("");

  const submit = () => {
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }
    createEntry.mutate(
      {
        type,
        description: description.trim(),
        severity,
        owner: owner.trim() || undefined,
        mitigation: mitigation.trim() || undefined,
        status: "open" as ProjectRaidStatus,
      },
      {
        onSuccess: () => {
          toast.success("Entry logged");
          setOpen(false);
          setType("risk");
          setDescription("");
          setSeverity("medium");
          setOwner("");
          setMitigation("");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to log entry"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="ws-section-label" style={{ margin: 0 }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Log entry
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a RAID entry</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as ProjectRaidType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RAID_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {RAID_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Severity</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as ProjectRaidSeverity)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RAID_SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>Owner</Label>
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} />
          </div>
          <div>
            <Label>Mitigation / response</Label>
            <Textarea value={mitigation} onChange={(e) => setMitigation(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={createEntry.isPending}>
            {createEntry.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Log entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
