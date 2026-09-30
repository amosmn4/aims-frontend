import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, Save, Send, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useItSystems } from "@/features/it/use-it-systems";
import {
  TICKET_PRIORITIES,
  TICKET_PRIORITY_HINTS,
  TICKET_PRIORITY_LABELS,
  TICKET_SOURCE_LABELS,
  personName,
  useCreateTicket,
  useTicketStaff,
  useUpdateTicket,
  type TicketPriority,
  type TicketRow,
  type TicketSource,
} from "@/features/it/use-tickets";
import { FormField, RequiredNote } from "@/components/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

/** new = IT raises a ticket; help = anyone asks IT; edit = change an existing ticket. */
export type TicketFormMode = "new" | "help" | "edit";

const NONE = "none";

export function TicketFormDialog({
  open,
  mode,
  ticket,
  canManage = false,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: TicketFormMode;
  ticket?: TicketRow | null;
  /** Edit mode: IT can change priority and system too. */
  canManage?: boolean;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  if (!open) return null;
  return (
    <TicketForm
      mode={mode}
      ticket={ticket}
      canManage={canManage}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function TicketForm({
  mode,
  ticket,
  canManage,
  onClose,
  onSaved,
}: {
  mode: TicketFormMode;
  ticket?: TicketRow | null;
  canManage: boolean;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const { user } = useAuth();
  const plain = mode === "help" || (mode === "edit" && !canManage);
  const showPriorityAndSystem = mode !== "edit" || canManage;
  const initial = {
    title: ticket?.title ?? "",
    description: ticket?.description ?? "",
    priority: (ticket?.priority ?? "medium") as TicketPriority,
    systemId: ticket?.systemId ?? NONE,
    assigneeId: NONE,
    requesterId: user?.id ?? NONE,
    source: "internal" as TicketSource,
  };
  const [form, setForm] = useState(initial);
  const [titleError, setTitleError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | undefined>();
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some(
    (k) => form[k] !== initial[k],
  );
  const { guardClose } = useUnsavedChanges(dirty);

  const systemsQ = useItSystems();
  const staffQ = useTicketStaff(mode === "new");
  const systems = (systemsQ.data ?? []).filter(
    (s) => s.status === "active" || s.id === initial.systemId,
  );

  const create = useCreateTicket();
  const update = useUpdateTicket();
  const saving = create.isPending || update.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setServerError(undefined);
    const title = form.title.trim();
    if (!title) {
      setTitleError(plain ? "Say what the problem is" : "Enter a title");
      return;
    }
    setTitleError(undefined);
    const systemId = form.systemId === NONE ? null : form.systemId;
    const onError = (err: unknown) => {
      const message = err instanceof Error ? err.message : "Couldn't save. Try again.";
      setServerError(message);
      toast.error(message);
    };

    if (mode === "edit" && ticket) {
      update.mutate(
        {
          id: ticket.id,
          title,
          description: form.description.trim(),
          ...(showPriorityAndSystem && { priority: form.priority, systemId }),
        },
        {
          onSuccess: () => {
            toast.success("Ticket saved");
            onSaved?.(ticket.id);
            onClose();
          },
          onError,
        },
      );
      return;
    }

    create.mutate(
      {
        title,
        description: form.description.trim(),
        priority: form.priority,
        systemId,
        ...(mode === "new" && {
          assigneeId: form.assigneeId === NONE ? null : form.assigneeId,
          requesterId: form.requesterId === NONE ? undefined : form.requesterId,
          source: form.source,
        }),
      },
      {
        onSuccess: (created) => {
          toast.success(
            mode === "help"
              ? "Sent to IT. You'll get a notification when they reply."
              : "Ticket created",
          );
          onSaved?.(created.id);
          onClose();
        },
        onError,
      },
    );
  };

  const heading =
    mode === "help" ? "Ask IT for help" : mode === "new" ? "New ticket" : "Edit ticket";
  const intro =
    mode === "help"
      ? "Tell IT what's wrong. They'll reply in Messages on your request."
      : mode === "new"
        ? "Record a problem someone reported to IT."
        : plain
          ? "You can change your request until IT starts on it."
          : "Change the ticket's details.";

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onClose)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{heading}</DialogTitle>
            <DialogDescription>{intro}</DialogDescription>
          </DialogHeader>
          <RequiredNote className="mt-2" />

          <div className="space-y-4 py-4">
            <FormField
              id="ticket-title"
              label={plain ? "What's the problem?" : "Title"}
              required
              error={titleError}
            >
              <Input
                id="ticket-title"
                value={form.title}
                autoFocus
                maxLength={200}
                aria-invalid={!!titleError}
                aria-describedby={titleError ? "ticket-title-error" : undefined}
                placeholder={
                  plain ? "e.g. I can't log in to email" : "e.g. Printer on floor 2 jams"
                }
                onChange={(e) => {
                  set("title", e.target.value);
                  if (titleError && e.target.value.trim()) setTitleError(undefined);
                }}
              />
            </FormField>

            <FormField
              id="ticket-description"
              label={plain ? "Details" : "Description"}
              hint={plain ? "What happened, any error message, and when it started." : undefined}
            >
              <Textarea
                id="ticket-description"
                rows={4}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </FormField>

            {showPriorityAndSystem && (
              <FormField
                id="ticket-system"
                label={plain ? "Which system?" : "System"}
                hint={
                  systemsQ.isError
                    ? "Couldn't load the systems list. You can leave this empty."
                    : plain
                      ? "Optional. Leave as “Not sure” if you don't know."
                      : undefined
                }
              >
                <Select value={form.systemId} onValueChange={(v) => set("systemId", v)}>
                  <SelectTrigger id="ticket-system">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{plain ? "Not sure / none" : "No system"}</SelectItem>
                    {systems.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}

            {showPriorityAndSystem && plain && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">How urgent?</legend>
                <RadioGroup
                  value={form.priority}
                  onValueChange={(v) => set("priority", v as TicketPriority)}
                  className="gap-2"
                >
                  {TICKET_PRIORITIES.map((p) => (
                    <Label
                      key={p}
                      htmlFor={`ticket-priority-${p}`}
                      className="flex cursor-pointer items-start gap-3 rounded-md border p-2.5 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
                    >
                      <RadioGroupItem id={`ticket-priority-${p}`} value={p} className="mt-0.5" />
                      <span>
                        <span className="block text-sm font-medium">
                          {TICKET_PRIORITY_LABELS[p]}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {TICKET_PRIORITY_HINTS[p]}
                        </span>
                      </span>
                    </Label>
                  ))}
                </RadioGroup>
              </fieldset>
            )}

            {showPriorityAndSystem && !plain && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField id="ticket-priority" label="Priority">
                  <Select
                    value={form.priority}
                    onValueChange={(v) => set("priority", v as TicketPriority)}
                  >
                    <SelectTrigger id="ticket-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {TICKET_PRIORITY_LABELS[p]} — {TICKET_PRIORITY_HINTS[p].toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                {mode === "new" && (
                  <FormField id="ticket-source" label="Where it came from">
                    <Select
                      value={form.source}
                      onValueChange={(v) => set("source", v as TicketSource)}
                    >
                      <SelectTrigger id="ticket-source">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(TICKET_SOURCE_LABELS) as TicketSource[]).map((s) => (
                          <SelectItem key={s} value={s}>
                            {TICKET_SOURCE_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                )}
              </div>
            )}

            {mode === "new" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  id="ticket-requester"
                  label="Asked by"
                  hint={
                    staffQ.isError ? "Couldn't load staff. It will be recorded as you." : undefined
                  }
                >
                  <Select value={form.requesterId} onValueChange={(v) => set("requesterId", v)}>
                    <SelectTrigger id="ticket-requester">
                      <SelectValue placeholder="You" />
                    </SelectTrigger>
                    <SelectContent>
                      {user && !(staffQ.data ?? []).some((s) => s.id === user.id) && (
                        <SelectItem value={user.id}>You</SelectItem>
                      )}
                      {(staffQ.data ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.id === user?.id ? `${personName(s)} (you)` : personName(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField
                  id="ticket-assignee"
                  label="Assign to"
                  hint={staffQ.isError ? "Couldn't load staff. Assign it later." : undefined}
                >
                  <Select value={form.assigneeId} onValueChange={(v) => set("assigneeId", v)}>
                    <SelectTrigger id="ticket-assignee">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nobody yet</SelectItem>
                      {(staffQ.data ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.id === user?.id ? `${personName(s)} (you)` : personName(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            )}

            {serverError && (
              <p role="alert" className="text-sm text-destructive">
                {serverError}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => guardClose(onClose)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : mode === "help" ? (
                <Send className="mr-1 h-4 w-4" />
              ) : mode === "new" ? (
                <Plus className="mr-1 h-4 w-4" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              {mode === "help" ? "Send to IT" : mode === "new" ? "Create ticket" : "Save ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
