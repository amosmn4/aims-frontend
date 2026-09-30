import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import {
  useCreateTeamMember,
  useDeleteTeamMember,
  useTeamMembers,
  useUpdateTeamMember,
  type ProjectTeamMember,
} from "@/features/project-workspace/use-project-workspace";
import { MEMBER_ACCESS_LABELS, type Project } from "@/features/projects/use-projects";
import { useStaffOptions } from "@/features/projects/staff-picker";
import { confirmDialog } from "@/components/confirm-dialog";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Initials } from "./initials";

type Access = "member" | "viewer";

/** Who is on a project. Company projects also say what each person may do. */
export function ProjectTeamDialog({
  project,
  open,
  canManage,
  onClose,
}: {
  project: Project;
  open: boolean;
  canManage: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isCompany = project.scope === "company";
  const teamQ = useTeamMembers(open ? project.id : undefined);
  const add = useCreateTeamMember(project.id);
  const update = useUpdateTeamMember(project.id);
  const remove = useDeleteTeamMember(project.id);
  const { options } = useStaffOptions();
  const [personId, setPersonId] = useState("");
  const [access, setAccess] = useState<Access>("member");

  const members = teamQ.data ?? [];
  const onTeam = new Set(members.map((m) => m.user_id).filter(Boolean));
  const addable = options.filter((p) => !onTeam.has(p.id));
  const refreshProject = () => qc.invalidateQueries({ queryKey: ["projects"] });

  const who = isCompany
    ? "Only these people and the CEO can see this project. Members add work; viewers follow along and can reply."
    : project.visibility === "restricted"
      ? "Only these people, whoever set the project up and the CEO can see it."
      : `Everyone in ${project.department_name} can see this project. Add people from other departments so they can see it too.`;

  const addPerson = () => {
    const person = options.find((p) => p.id === personId);
    if (!person) return;
    add.mutate(
      {
        userId: person.id,
        name: person.name,
        role: isCompany && access === "viewer" ? "Viewer" : "Member",
        ...(isCompany && { access }),
      },
      {
        onSuccess: () => {
          toast.success(`${person.name} was added to ${project.name}.`);
          setPersonId("");
          setAccess("member");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't add them"),
      },
    );
  };

  const changeAccess = (m: ProjectTeamMember, next: Access) =>
    update.mutate(
      { id: m.id, access: next, role: next === "viewer" ? "Viewer" : "Member" },
      {
        onSuccess: () => {
          refreshProject();
          toast.success(`${m.name} is now a ${MEMBER_ACCESS_LABELS[next].toLowerCase()}.`);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't change that"),
      },
    );

  const removePerson = async (m: ProjectTeamMember) => {
    const ok = await confirmDialog({
      title: `Remove ${m.name} from ${project.name}?`,
      description: isCompany
        ? `${m.name} will no longer see this project. Their tasks and posts stay.`
        : `${m.name} comes off the team. Their tasks and posts stay.`,
      confirmLabel: "Remove from project",
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(m.id, {
      onSuccess: () => {
        refreshProject();
        toast.success(`${m.name} was removed.`);
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't remove them"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Team · {project.name}</DialogTitle>
          <DialogDescription>{who}</DialogDescription>
        </DialogHeader>

        {teamQ.isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : teamQ.isError ? (
          <LoadError what="the team" error={teamQ.error} onRetry={() => teamQ.refetch()} />
        ) : members.length === 0 ? (
          <p className="rounded-md border px-3 py-4 text-center text-sm text-muted-foreground">
            Nobody has been added yet.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {members.map((m) => {
              const isLead = isCompany && (m.access === "lead" || m.user_id === project.lead_id);
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <Initials name={m.name} />
                  <span className="min-w-0 flex-1 truncate text-sm">{m.name}</span>
                  {isCompany && canManage && !isLead && (
                    <select
                      value={m.access === "viewer" ? "viewer" : "member"}
                      onChange={(e) => changeAccess(m, e.target.value as Access)}
                      aria-label={`What ${m.name} can do`}
                      className="h-8 rounded-md border bg-background px-2 text-xs"
                      disabled={update.isPending}
                    >
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  )}
                  {isCompany && (!canManage || isLead) && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {isLead ? "Lead" : MEMBER_ACCESS_LABELS[m.access]}
                    </span>
                  )}
                  {canManage && !isLead && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removePerson(m)}
                    >
                      Remove
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {canManage ? (
          <div
            className={
              isCompany
                ? "grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7.5rem_auto]"
                : "grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]"
            }
          >
            <select
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              aria-label="Person to add"
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="">Choose a person…</option>
              {addable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {isCompany && (
              <select
                value={access}
                onChange={(e) => setAccess(e.target.value as Access)}
                aria-label="What they can do"
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            )}
            <Button onClick={addPerson} disabled={!personId || add.isPending}>
              {add.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-1 h-4 w-4" />
              )}
              Add to project
            </Button>
          </div>
        ) : (
          <p className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
            {isCompany
              ? `Only ${project.lead_name ?? "the project's lead"} can change who is on the team.`
              : `Only ${project.department_name} staff who can edit this project can change its team.`}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
