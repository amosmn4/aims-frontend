import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Plus, Search } from "lucide-react";
import { useCreateCompanyProject } from "@/features/projects/use-projects";
import { useStaffOptions } from "@/features/projects/staff-picker";
import { FormField, RequiredNote } from "@/components/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Access = "member" | "viewer";

/** One screen to set up a company project: what it is, when, and who is on it. */
export function NewCompanyProjectDialog({ size = "default" }: { size?: "sm" | "default" }) {
  const navigate = useNavigate();
  const create = useCreateCompanyProject();
  const { options, meId } = useStaffOptions();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [team, setTeam] = useState<Record<string, Access>>({});
  const [search, setSearch] = useState("");
  const [errors, setErrors] = useState<{ name?: string; endDate?: string }>({});

  const dirty =
    open &&
    (!!name.trim() || !!purpose.trim() || !!startDate || !!endDate || Object.keys(team).length > 0);
  const { guardClose } = useUnsavedChanges(dirty);

  const reset = () => {
    setOpen(false);
    setName("");
    setPurpose("");
    setStartDate("");
    setEndDate("");
    setTeam({});
    setSearch("");
    setErrors({});
  };

  const people = options.filter(
    (p) =>
      p.id !== meId &&
      (!search.trim() ||
        `${p.name} ${p.email}`.toLowerCase().includes(search.trim().toLowerCase())),
  );
  const picked = Object.keys(team).length;

  const toggle = (id: string) =>
    setTeam((t) => {
      const next = { ...t };
      if (next[id]) delete next[id];
      else next[id] = "member";
      return next;
    });

  const submit = () => {
    const found: typeof errors = {};
    if (!name.trim()) found.name = "Give the project a name, e.g. “Africa Expansion”.";
    if (startDate && endDate && endDate < startDate)
      found.endDate = "The end date can't be before the start date.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    create.mutate(
      {
        name: name.trim(),
        description: purpose.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        members: Object.entries(team).map(([userId, access]) => ({ userId, access })),
      },
      {
        onSuccess: (project) => {
          toast.success(
            picked > 0
              ? `${project.name} set up. ${picked === 1 ? "1 person was" : `${picked} people were`} told and can now see it.`
              : `${project.name} set up. Add the team from the project page.`,
          );
          reset();
          navigate({ to: "/projects/$projectId", params: { projectId: project.id } });
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Couldn't set up the project"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : guardClose(reset))}>
      <DialogTrigger asChild>
        <Button size={size}>
          <Plus className="mr-1 h-4 w-4" /> New company project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>New company project</DialogTitle>
            <DialogDescription>
              A project that belongs to no department. You lead it, and only the people you add can
              see it.
            </DialogDescription>
            <RequiredNote />
          </DialogHeader>

          <FormField id="cp-name" label="Project name" required error={errors.name}>
            <Input
              id="cp-name"
              value={name}
              autoFocus
              placeholder="e.g. Africa Expansion"
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!errors.name}
            />
          </FormField>
          <FormField id="cp-purpose" label="What it is for">
            <Textarea
              id="cp-purpose"
              rows={2}
              value={purpose}
              placeholder="One or two lines the whole team will see"
              onChange={(e) => setPurpose(e.target.value)}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="cp-start" label="Starts">
              <Input
                id="cp-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </FormField>
            <FormField id="cp-end" label="Ends" error={errors.endDate}>
              <Input
                id="cp-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                aria-invalid={!!errors.endDate}
              />
            </FormField>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Team
              {picked > 0 && <span className="ml-1 text-muted-foreground">· {picked} added</span>}
            </legend>
            <p className="text-xs text-muted-foreground">
              Members add tasks, deliverables and reports. Viewers follow along and can reply.
            </p>
            <div className="relative">
              <Search
                className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff by name or email"
                aria-label="Search staff"
                className="pl-7"
              />
            </div>
            <ul className="max-h-56 divide-y overflow-y-auto rounded-md border">
              {people.length === 0 ? (
                <li className="px-3 py-4 text-center text-sm text-muted-foreground">No matches.</li>
              ) : (
                people.map((p) => {
                  const access = team[p.id];
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                      <input
                        type="checkbox"
                        id={`cp-m-${p.id}`}
                        checked={!!access}
                        onChange={() => toggle(p.id)}
                        className="h-4 w-4 accent-primary"
                      />
                      <label htmlFor={`cp-m-${p.id}`} className="min-w-0 flex-1 text-sm">
                        <span className="block truncate">{p.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {p.email}
                        </span>
                      </label>
                      {access && (
                        <select
                          value={access}
                          onChange={(e) =>
                            setTeam((t) => ({ ...t, [p.id]: e.target.value as Access }))
                          }
                          aria-label={`What ${p.name} can do`}
                          className="h-8 rounded-md border bg-background px-2 text-xs"
                        >
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => guardClose(reset)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Set up project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
