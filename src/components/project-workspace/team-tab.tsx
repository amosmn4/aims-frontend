import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, UserPlus, Plus } from "lucide-react";
import {
  useTeamMembers,
  useCreateTeamMember,
  useDeleteTeamMember,
  useRaciEntries,
  useCreateRaciEntry,
  type ProjectTeamMember,
  type ProjectTeamMemberType,
} from "@/features/project-workspace/use-project-workspace";
import {
  initials,
  PIPELINE_INK_2,
  PIPELINE_PURPLE,
  PIPELINE_PURPLE_SOFT,
  PIPELINE_TEAL_SOFT,
  PIPELINE_TEAL,
} from "@/features/pipeline/pipeline-theme";
import { StaffSearchList, useStaffOptions } from "@/features/projects/staff-picker";
import { confirmDialog } from "@/components/confirm-dialog";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

export function TeamTab({
  projectId,
  canManage = false,
  detailed = false,
  departmentName,
  restricted = false,
}: {
  projectId: string;
  canManage?: boolean;
  /** IT projects: show time allocation, hours and the RACI table. */
  detailed?: boolean;
  departmentName: string;
  restricted?: boolean;
}) {
  const teamQ = useTeamMembers(projectId);
  const raciQ = useRaciEntries(projectId);
  const removeMember = useDeleteTeamMember(projectId);
  const [adding, setAdding] = useState(false);
  const members = teamQ.data ?? [];
  const raci = raciQ.data ?? [];

  const remove = async (m: ProjectTeamMember) => {
    const ok = await confirmDialog({
      title: `Remove ${m.name} from the team?`,
      description: m.user_id
        ? restricted
          ? `${m.name} will lose access to this project.`
          : `${m.name} will lose access to this project unless they can already see all ${departmentName} projects.`
        : `${m.name} will be taken off this project's team.`,
      confirmLabel: "Remove from team",
      destructive: true,
    });
    if (!ok) return;
    removeMember.mutate(m.id, {
      onSuccess: () => toast.success(`${m.name} removed from the team`),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to remove"),
    });
  };

  return (
    <>
      <div className="ws-panel">
        <h3>
          Team
          {canManage && members.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <UserPlus className="h-3.5 w-3.5 mr-1" /> Add team member
            </Button>
          )}
        </h3>
        <p className="mb-3 text-xs" style={{ color: "var(--pipeline-slate)" }}>
          {restricted
            ? "Only people on this team, whoever created the project and the CEO can open it."
            : `Everyone in ${departmentName} can open this project. Staff from other departments need to be on the team.`}
        </p>
        {teamQ.isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : teamQ.isError ? (
          <LoadError what="the team" error={teamQ.error} onRetry={() => teamQ.refetch()} />
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm font-medium">No team members yet</p>
            {canManage && (
              <Button size="sm" onClick={() => setAdding(true)}>
                <UserPlus className="h-4 w-4 mr-1" /> Add team member
              </Button>
            )}
          </div>
        ) : (
          <div className="team-grid">
            {members.map((m) => {
              const isExt = m.type === "external";
              const hasAccount = !!m.user_id;
              return (
                <div key={m.id} className="team-card">
                  <div className="team-top">
                    <div
                      className="team-av"
                      style={{ background: isExt ? PIPELINE_PURPLE : PIPELINE_INK_2 }}
                      aria-hidden="true"
                    >
                      {initials(m.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="team-name">{m.name}</div>
                      <div className="team-role">{m.role}</div>
                    </div>
                    {canManage && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(m)}
                        disabled={removeMember.isPending}
                        aria-label={`Remove ${m.name} from the team`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        hasAccount
                          ? "bg-success/15 text-success"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {hasAccount ? "Has AIMS account" : "Not in AIMS"}
                    </span>
                    <span
                      className="p-chip"
                      style={{
                        background: isExt ? PIPELINE_PURPLE_SOFT : PIPELINE_TEAL_SOFT,
                        color: isExt ? PIPELINE_PURPLE : PIPELINE_TEAL,
                      }}
                    >
                      {isExt ? "Outside organisation" : "Our company"}
                    </span>
                  </div>
                  {detailed && (
                    <>
                      <div className="alloc-track">
                        <div
                          className="alloc-fill"
                          style={{
                            width: `${m.allocation_percent}%`,
                            background:
                              m.allocation_percent > 80
                                ? "var(--pipeline-coral)"
                                : "var(--pipeline-gold)",
                          }}
                        />
                      </div>
                      <div className="mt-1.5 text-xs" style={{ color: "var(--pipeline-slate)" }}>
                        {m.allocation_percent}% of their time · {m.hours_logged}h logged
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {(detailed || raci.length > 0) && (
        <div className="ws-panel">
          <h3>
            Who does what (RACI)
            {canManage && <AddRaciDialog projectId={projectId} />}
          </h3>
          <p className="mb-3 text-xs" style={{ color: "var(--pipeline-slate)" }}>
            For each deliverable: who does the work, who signs it off, who is asked for input and
            who is kept informed.
          </p>
          {raciQ.isError ? (
            <LoadError what="deliverables" error={raciQ.error} onRetry={() => raciQ.refetch()} />
          ) : raci.length === 0 ? (
            <div className="text-sm" style={{ color: "var(--pipeline-slate)" }}>
              No deliverables mapped yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="raci">
                <tbody>
                  <tr>
                    <th>Deliverable</th>
                    <th>Does the work</th>
                    <th>Signs off</th>
                    <th>Asked for input</th>
                    <th>Kept informed</th>
                  </tr>
                  {raci.map((row) => (
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
            </div>
          )}
        </div>
      )}

      {adding && (
        <AddTeamMemberDialog
          projectId={projectId}
          detailed={detailed}
          existingUserIds={
            new Set(members.map((m) => m.user_id).filter((id): id is string => !!id))
          }
          onClose={() => setAdding(false)}
        />
      )}
    </>
  );
}

type MemberErrors = Partial<Record<"person" | "name" | "role" | "allocation", string>>;

function AddTeamMemberDialog({
  projectId,
  detailed,
  existingUserIds,
  onClose,
}: {
  projectId: string;
  detailed: boolean;
  existingUserIds: Set<string>;
  onClose: () => void;
}) {
  const createMember = useCreateTeamMember(projectId);
  const { options } = useStaffOptions();
  const [source, setSource] = useState<"staff" | "outside">("staff");
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [type, setType] = useState<ProjectTeamMemberType>("external");
  const [allocation, setAllocation] = useState("50");
  const [errors, setErrors] = useState<MemberErrors>({});

  const dirty = !!userId || !!name.trim() || !!role.trim() || allocation !== "50";
  const { guardClose } = useUnsavedChanges(dirty);

  const submit = () => {
    const found: MemberErrors = {};
    const person = options.find((p) => p.id === userId);
    if (source === "staff" && !person) found.person = "Pick the staff member to add.";
    if (source === "outside" && !name.trim()) found.name = "Enter the person's name.";
    if (!role.trim()) found.role = "Say what they do on this project, e.g. “Interviewer”.";
    const pct = Number(allocation);
    if (detailed && (Number.isNaN(pct) || pct < 0 || pct > 100))
      found.allocation = "Enter a number from 0 to 100.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    createMember.mutate(
      source === "staff" && person
        ? {
            userId: person.id,
            name: person.name,
            role: role.trim(),
            type: "internal",
            allocationPercent: detailed ? Math.round(pct) : undefined,
          }
        : {
            name: name.trim(),
            role: role.trim(),
            type,
            allocationPercent: detailed ? Math.round(pct) : undefined,
          },
      {
        onSuccess: () => {
          toast.success(`${source === "staff" ? person?.name : name.trim()} added to the team`);
          onClose();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add"),
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
            <DialogTitle>Add team member</DialogTitle>
            <DialogDescription>
              Staff with an AIMS account can open this project once they&apos;re on the team.
            </DialogDescription>
            <RequiredNote />
          </DialogHeader>

          <div
            className="inline-flex rounded-lg border bg-card p-0.5"
            role="radiogroup"
            aria-label="Who are you adding?"
          >
            {(
              [
                ["staff", "Staff member in AIMS"],
                ["outside", "Someone outside AIMS"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={source === v}
                onClick={() => {
                  setSource(v);
                  setErrors({});
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium",
                  source === v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {source === "staff" ? (
              <FormField id="team-person" label="Staff member" required error={errors.person}>
                <StaffSearchList
                  id="team-person"
                  value={userId}
                  onChange={setUserId}
                  excludeIds={existingUserIds}
                  invalid={!!errors.person}
                />
              </FormField>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  id="team-name"
                  label="Name"
                  required
                  error={errors.name}
                  hint="They won't be able to open the project in AIMS."
                >
                  <Input
                    id="team-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={!!errors.name}
                  />
                </FormField>
                <FormField id="team-type" label="Works for">
                  <Select value={type} onValueChange={(v) => setType(v as ProjectTeamMemberType)}>
                    <SelectTrigger id="team-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Our company</SelectItem>
                      <SelectItem value="external">Another organisation</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField id="team-role" label="Role on this project" required error={errors.role}>
                <Input
                  id="team-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Interviewer"
                  aria-invalid={!!errors.role}
                />
              </FormField>
              {detailed && (
                <FormField
                  id="team-allocation"
                  label="Share of their time (%)"
                  error={errors.allocation}
                >
                  <Input
                    id="team-allocation"
                    type="number"
                    min={0}
                    max={100}
                    value={allocation}
                    onChange={(e) => setAllocation(e.target.value)}
                    aria-invalid={!!errors.allocation}
                  />
                </FormField>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => guardClose(onClose)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMember.isPending}>
              {createMember.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add to team
            </Button>
          </DialogFooter>
        </form>
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
  const [error, setError] = useState<string>();

  const dirty = [deliverable, responsible, accountable, consulted, informed].some((v) => v.trim());
  const { guardClose } = useUnsavedChanges(open && dirty);

  const close = () => {
    setOpen(false);
    setDeliverable("");
    setResponsible("");
    setAccountable("");
    setConsulted("");
    setInformed("");
    setError(undefined);
  };

  const submit = () => {
    if (!deliverable.trim()) {
      setError("Name the deliverable, e.g. “Shortlist report”.");
      return;
    }
    setError(undefined);
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
          close();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add"),
      },
    );
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Add deliverable
      </Button>
      <Dialog open={open} onOpenChange={(o) => !o && guardClose(close)}>
        <DialogContent>
          <form
            noValidate
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <DialogHeader>
              <DialogTitle>Add deliverable</DialogTitle>
              <RequiredNote />
            </DialogHeader>
            <div className="space-y-3">
              <FormField id="raci-deliverable" label="Deliverable" required error={error}>
                <Input
                  id="raci-deliverable"
                  value={deliverable}
                  onChange={(e) => setDeliverable(e.target.value)}
                  aria-invalid={!!error}
                />
              </FormField>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField id="raci-r" label="Does the work">
                  <Input
                    id="raci-r"
                    value={responsible}
                    onChange={(e) => setResponsible(e.target.value)}
                  />
                </FormField>
                <FormField id="raci-a" label="Signs off">
                  <Input
                    id="raci-a"
                    value={accountable}
                    onChange={(e) => setAccountable(e.target.value)}
                  />
                </FormField>
                <FormField id="raci-c" label="Asked for input">
                  <Input
                    id="raci-c"
                    value={consulted}
                    onChange={(e) => setConsulted(e.target.value)}
                  />
                </FormField>
                <FormField id="raci-i" label="Kept informed">
                  <Input
                    id="raci-i"
                    value={informed}
                    onChange={(e) => setInformed(e.target.value)}
                  />
                </FormField>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guardClose(close)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createEntry.isPending}>
                {createEntry.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add deliverable
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
