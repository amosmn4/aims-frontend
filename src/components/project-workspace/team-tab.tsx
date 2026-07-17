import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import {
  useTeamMembers,
  useCreateTeamMember,
  useRaciEntries,
  useCreateRaciEntry,
  type ProjectTeamMemberType,
} from "@/features/project-workspace/use-project-workspace";
import { initials, PIPELINE_INK_2, PIPELINE_PURPLE, PIPELINE_PURPLE_SOFT, PIPELINE_TEAL_SOFT, PIPELINE_TEAL } from "@/features/pipeline/pipeline-theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function TeamTab({ projectId }: { projectId: string }) {
  const teamQ = useTeamMembers(projectId);
  const raciQ = useRaciEntries(projectId);

  return (
    <>
      <div className="ws-panel">
        <h3>
          Team &amp; Resource Allocation
          <AddTeamMemberDialog projectId={projectId} />
        </h3>
        {teamQ.isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (teamQ.data ?? []).length === 0 ? (
          <div className="ws-section-label">No team members added yet.</div>
        ) : (
          <div className="team-grid">
            {(teamQ.data ?? []).map((m) => {
              const isExt = m.type === "external";
              return (
                <div key={m.id} className="team-card">
                  <div className="team-top">
                    <div className="team-av" style={{ background: isExt ? PIPELINE_PURPLE : PIPELINE_INK_2 }}>
                      {initials(m.name)}
                    </div>
                    <div>
                      <div className="team-name">{m.name}</div>
                      <div className="team-role">{m.role}</div>
                    </div>
                  </div>
                  <div className="flex justify-between mt-2.5">
                    <span
                      className="p-chip"
                      style={{ background: isExt ? PIPELINE_PURPLE_SOFT : PIPELINE_TEAL_SOFT, color: isExt ? PIPELINE_PURPLE : PIPELINE_TEAL }}
                    >
                      {isExt ? "External" : "Internal"}
                    </span>
                    <span className="ws-section-label" style={{ margin: 0 }}>
                      {m.hours_logged}h logged
                    </span>
                  </div>
                  <div className="alloc-track">
                    <div
                      className="alloc-fill"
                      style={{
                        width: `${m.allocation_percent}%`,
                        background: m.allocation_percent > 80 ? "var(--pipeline-coral)" : "var(--pipeline-gold)",
                      }}
                    />
                  </div>
                  <div className="ws-section-label" style={{ margin: "6px 0 0" }}>
                    {m.allocation_percent}% allocated to this project
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="ws-panel">
        <h3>
          RACI Matrix — Key Deliverables
          <AddRaciDialog projectId={projectId} />
        </h3>
        {(raciQ.data ?? []).length === 0 ? (
          <div className="ws-section-label">No deliverables mapped yet.</div>
        ) : (
          <>
            <table className="raci">
              <tbody>
                <tr>
                  <th>Deliverable</th>
                  <th>R</th>
                  <th>A</th>
                  <th>C</th>
                  <th>I</th>
                </tr>
                {(raciQ.data ?? []).map((row) => (
                  <tr key={row.id}>
                    <td>{row.deliverable}</td>
                    <td>{row.responsible ?? "—"}</td>
                    <td>{row.accountable ?? "—"}</td>
                    <td>{row.consulted ?? "—"}</td>
                    <td>{row.informed ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ws-section-label" style={{ marginTop: 12 }}>
              R = Responsible · A = Accountable · C = Consulted · I = Informed
            </div>
          </>
        )}
      </div>
    </>
  );
}

function AddTeamMemberDialog({ projectId }: { projectId: string }) {
  const createMember = useCreateTeamMember(projectId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [type, setType] = useState<ProjectTeamMemberType>("internal");
  const [allocation, setAllocation] = useState("50");

  const submit = () => {
    if (!name.trim() || !role.trim()) {
      toast.error("Name and role are required");
      return;
    }
    createMember.mutate(
      { name: name.trim(), role: role.trim(), type, allocationPercent: Number(allocation) || 0 },
      {
        onSuccess: () => {
          toast.success("Team member added");
          setOpen(false);
          setName("");
          setRole("");
          setType("internal");
          setAllocation("50");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="ws-section-label" style={{ margin: 0 }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Role</Label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Systems Integration" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as ProjectTeamMemberType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Allocation %</Label>
              <Input type="number" min={0} max={100} value={allocation} onChange={(e) => setAllocation(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={createMember.isPending}>
            {createMember.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddRaciDialog({ projectId }: { projectId: string }) {
  const createEntry = useCreateRaciEntry(projectId);
  const [open, setOpen] = useState(false);
  const [deliverable, setDeliverable] = useState("");
  const [responsible, setResponsible] = useState("");
  const [accountable, setAccountable] = useState("");
  const [consulted, setConsulted] = useState("");
  const [informed, setInformed] = useState("");

  const submit = () => {
    if (!deliverable.trim()) {
      toast.error("Deliverable is required");
      return;
    }
    createEntry.mutate(
      {
        deliverable: deliverable.trim(),
        responsible: responsible.trim() || undefined,
        accountable: accountable.trim() || undefined,
        consulted: consulted.trim() || undefined,
        informed: informed.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Deliverable added");
          setOpen(false);
          setDeliverable("");
          setResponsible("");
          setAccountable("");
          setConsulted("");
          setInformed("");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="ws-section-label" style={{ margin: 0 }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add RACI row</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Deliverable</Label>
            <Input value={deliverable} onChange={(e) => setDeliverable(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Responsible</Label>
              <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} />
            </div>
            <div>
              <Label>Accountable</Label>
              <Input value={accountable} onChange={(e) => setAccountable(e.target.value)} />
            </div>
            <div>
              <Label>Consulted</Label>
              <Input value={consulted} onChange={(e) => setConsulted(e.target.value)} />
            </div>
            <div>
              <Label>Informed</Label>
              <Input value={informed} onChange={(e) => setInformed(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={createEntry.isPending}>
            {createEntry.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add row
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
