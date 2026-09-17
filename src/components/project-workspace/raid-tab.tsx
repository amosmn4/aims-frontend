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
import {
  RAID_TYPE_LABELS,
  RAID_TYPE_COLORS,
  RAID_SEVERITY_COLORS,
} from "@/features/project-workspace/workspace-theme";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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

const RAID_TYPES: ProjectRaidType[] = ["risk", "issue", "dependency", "assumption"];
const RAID_SEVERITIES: ProjectRaidSeverity[] = ["low", "medium", "high"];
const SEVERITY_LABELS: Record<ProjectRaidSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};
const words = (s: string) => {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function RaidTab({
  projectId,
  canManage = false,
}: {
  projectId: string;
  canManage?: boolean;
}) {
  const raidQ = useRaidEntries(projectId);
  const [adding, setAdding] = useState(false);
  const entries = raidQ.data ?? [];

  return (
    <div className="ws-panel">
      <h3>
        Risks and issues
        {canManage && entries.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Log risk or issue
          </Button>
        )}
      </h3>
      <p className="mb-3 text-xs" style={{ color: "var(--pipeline-slate)" }}>
        Things that could go wrong (risks), have gone wrong (issues), other work this depends on,
        and assumptions you&apos;re making.
      </p>
      {raidQ.isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : raidQ.isError ? (
        <LoadError what="risks and issues" error={raidQ.error} onRetry={() => raidQ.refetch()} />
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm font-medium">No risks or issues logged yet</p>
          {canManage && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4 mr-1" /> Log risk or issue
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="raid">
            <tbody>
              <tr>
                <th>Type</th>
                <th>Description</th>
                <th>Severity</th>
                <th>Owner</th>
                <th>Status</th>
                <th>What we&apos;re doing about it</th>
              </tr>
              {entries.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span
                      className="raid-type"
                      style={{
                        background: RAID_TYPE_COLORS[r.type].bg,
                        color: RAID_TYPE_COLORS[r.type].c,
                      }}
                    >
                      {RAID_TYPE_LABELS[r.type]}
                    </span>
                  </td>
                  <td>{r.description}</td>
                  <td>
                    <span
                      className="sev-pill"
                      style={{
                        background: RAID_SEVERITY_COLORS[r.severity].bg,
                        color: RAID_SEVERITY_COLORS[r.severity].c,
                      }}
                    >
                      {SEVERITY_LABELS[r.severity]}
                    </span>
                  </td>
                  <td>{r.owner ?? "—"}</td>
                  <td>{words(r.status)}</td>
                  <td style={{ color: "var(--pipeline-slate)" }}>{r.mitigation ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {adding && <AddRaidDialog projectId={projectId} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddRaidDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const createEntry = useCreateRaidEntry(projectId);
  const [type, setType] = useState<ProjectRaidType>("risk");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<ProjectRaidSeverity>("medium");
  const [owner, setOwner] = useState("");
  const [mitigation, setMitigation] = useState("");
  const [error, setError] = useState<string>();

  const dirty =
    type !== "risk" ||
    severity !== "medium" ||
    [description, owner, mitigation].some((v) => v.trim());
  const { guardClose } = useUnsavedChanges(dirty);

  const submit = () => {
    if (!description.trim()) {
      setError("Describe the risk or issue.");
      return;
    }
    setError(undefined);
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
          toast.success(`${RAID_TYPE_LABELS[type]} logged`);
          onClose();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to log entry"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onClose)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Log a risk or issue</DialogTitle>
            <RequiredNote />
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField id="raid-type" label="Type">
                <Select value={type} onValueChange={(v) => setType(v as ProjectRaidType)}>
                  <SelectTrigger id="raid-type">
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
              </FormField>
              <FormField id="raid-severity" label="Severity">
                <Select
                  value={severity}
                  onValueChange={(v) => setSeverity(v as ProjectRaidSeverity)}
                >
                  <SelectTrigger id="raid-severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RAID_SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SEVERITY_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <FormField id="raid-description" label="Description" required error={error}>
              <Textarea
                id="raid-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                aria-invalid={!!error}
              />
            </FormField>
            <FormField id="raid-owner" label="Owner">
              <Input id="raid-owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
            </FormField>
            <FormField id="raid-mitigation" label="What we're doing about it">
              <Textarea
                id="raid-mitigation"
                value={mitigation}
                onChange={(e) => setMitigation(e.target.value)}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => guardClose(onClose)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createEntry.isPending}>
              {createEntry.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Log risk or issue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
