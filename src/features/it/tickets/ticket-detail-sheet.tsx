import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2, UserCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format-date";
import {
  TICKET_PRIORITY_LABELS,
  TICKET_SOURCE_LABELS,
  TICKET_STATUSES,
  TICKET_STATUS_HINTS,
  TICKET_STATUS_LABELS,
  personName,
  useAddTicketComment,
  useDeleteTicket,
  useDeleteTicketComment,
  useTicket,
  useTicketComments,
  useTicketStaff,
  useUpdateTicket,
  useUpdateTicketStatus,
  type TicketDetail,
  type TicketStatus,
} from "@/features/it/use-tickets";
import { TicketPriorityBadge, TicketStatusBadge } from "./ticket-badges";
import { TicketFormDialog } from "./ticket-form-dialog";
import { Thread, type ThreadItem } from "@/components/thread/thread";
import { LoadError } from "@/components/load-error";
import { confirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const NONE = "none";

const errorText = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

/** One ticket: details, IT actions and the Messages thread. Shared by IT tickets and IT help. */
export function TicketDetailSheet({
  ticketId,
  onClose,
}: {
  ticketId: string | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!ticketId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {ticketId && <TicketDetailBody key={ticketId} ticketId={ticketId} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function TicketDetailBody({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const ticketQ = useTicket(ticketId);

  if (ticketQ.isLoading) {
    return (
      <>
        <SheetTitle className="sr-only">Loading ticket</SheetTitle>
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading ticket" />
        </div>
      </>
    );
  }
  if (ticketQ.isError || !ticketQ.data) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Ticket</SheetTitle>
        </SheetHeader>
        <LoadError
          what="this ticket"
          error={ticketQ.error}
          onRetry={() => ticketQ.refetch()}
          className="mt-4"
        />
      </>
    );
  }
  return <TicketDetailLoaded ticket={ticketQ.data} onClose={onClose} />;
}

function TicketDetailLoaded({ ticket: t, onClose }: { ticket: TicketDetail; onClose: () => void }) {
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const commentsQ = useTicketComments(t.id);
  const staffQ = useTicketStaff(t.canManage);
  const updateStatus = useUpdateTicketStatus();
  const update = useUpdateTicket();
  const remove = useDeleteTicket();
  const addComment = useAddTicketComment(t.id);
  const deleteComment = useDeleteTicketComment();

  const staff = staffQ.data ?? [];
  const staffOptions =
    t.assignee && !staff.some((s) => s.id === t.assignee?.id) ? [t.assignee, ...staff] : staff;

  const move = (status: TicketStatus) =>
    updateStatus.mutate(
      { id: t.id, status },
      {
        onSuccess: () => toast.success(`Moved to ${TICKET_STATUS_LABELS[status]}`),
        onError: (err) => toast.error(errorText(err, "Couldn't move the ticket")),
      },
    );

  const assign = (assigneeId: string | null) =>
    update.mutate(
      { id: t.id, assigneeId },
      {
        onSuccess: () => {
          const who = staffOptions.find((s) => s.id === assigneeId);
          toast.success(
            assigneeId
              ? `Assigned to ${assigneeId === user?.id ? "you" : personName(who)}`
              : "Ticket unassigned",
          );
        },
        onError: (err) => toast.error(errorText(err, "Couldn't assign the ticket")),
      },
    );

  const deleteTicket = async () => {
    const ok = await confirmDialog({
      title: `Delete ticket "${t.title}"?`,
      description: "The ticket and all its messages will be deleted. This can't be undone.",
      confirmLabel: "Delete ticket",
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(t.id, {
      onSuccess: () => {
        toast.success("Ticket deleted");
        onClose();
      },
      onError: (err) => toast.error(errorText(err, "Couldn't delete the ticket")),
    });
  };

  const items: ThreadItem[] = (commentsQ.data ?? []).map((c) => ({
    id: c.id,
    parentId: c.parentId,
    authorName: personName(c.author),
    createdAt: c.createdAt,
    body: c.body,
    badge: t.canManage && c.authorId === t.requesterId ? { label: "Asked for help" } : undefined,
    canDelete: c.authorId === user?.id || t.canManage,
  }));

  const requester = personName(t.requester, "Unknown");
  const canEdit = t.canEditDetails;

  return (
    <div className="space-y-5">
      <SheetHeader className="pr-8">
        <SheetTitle className="text-base leading-snug">{t.title}</SheetTitle>
        <SheetDescription className="text-xs">
          Asked by {t.requesterId === user?.id ? "you" : requester} on {formatDate(t.createdAt)}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-wrap items-center gap-2">
        <TicketStatusBadge status={t.status} />
        <TicketPriorityBadge priority={t.priority} />
        <span className="text-xs text-muted-foreground">{TICKET_STATUS_HINTS[t.status]}</span>
      </div>

      {t.canManage && (
        <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
          <FormField id={`ticket-move-${t.id}`} label="Move to…">
            <Select
              value=""
              onValueChange={(v) => move(v as TicketStatus)}
              disabled={updateStatus.isPending}
            >
              <SelectTrigger id={`ticket-move-${t.id}`}>
                <SelectValue placeholder={`Now: ${TICKET_STATUS_LABELS[t.status]}`} />
              </SelectTrigger>
              <SelectContent>
                {TICKET_STATUSES.filter((s) => s !== t.status).map((s) => (
                  <SelectItem key={s} value={s}>
                    {TICKET_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            id={`ticket-assign-${t.id}`}
            label="Assign to"
            error={staffQ.isError ? "Couldn't load staff. Try reopening the ticket." : undefined}
          >
            <Select
              value={t.assigneeId ?? NONE}
              onValueChange={(v) => assign(v === NONE ? null : v)}
              disabled={update.isPending}
            >
              <SelectTrigger id={`ticket-assign-${t.id}`}>
                <SelectValue placeholder={personName(t.assignee, "Nobody yet")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nobody yet</SelectItem>
                {staffOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.id === user?.id ? `${personName(s)} (you)` : personName(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {user && t.assigneeId !== user.id && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="sm:col-span-2 sm:justify-self-start"
              onClick={() => assign(user.id)}
              disabled={update.isPending}
            >
              <UserCheck className="mr-1 h-4 w-4" /> Assign ticket to me
            </Button>
          )}
        </div>
      )}

      {(canEdit || t.canManage) && (
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1 h-4 w-4" /> {t.canManage ? "Edit ticket" : "Edit request"}
            </Button>
          )}
          {t.canManage && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={deleteTicket}
              disabled={remove.isPending}
            >
              {remove.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-1 h-4 w-4" />
              )}
              Delete ticket
            </Button>
          )}
        </div>
      )}
      {!t.canManage && (
        <p className="text-xs text-muted-foreground">
          {canEdit
            ? "You can change your request until IT starts on it. IT updates the status."
            : "IT has started on this, so only IT can change it. Send a message below if anything changes."}
        </p>
      )}

      <section aria-labelledby={`ticket-desc-${t.id}`}>
        <h3 id={`ticket-desc-${t.id}`} className="mb-1 text-sm font-semibold">
          Description
        </h3>
        {t.description ? (
          <p className="whitespace-pre-wrap text-sm">{t.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No details given.</p>
        )}
      </section>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 rounded-lg border p-3 text-sm sm:grid-cols-2">
        <Detail label="Status">{TICKET_STATUS_LABELS[t.status]}</Detail>
        <Detail label="Priority">{TICKET_PRIORITY_LABELS[t.priority]}</Detail>
        <Detail label="System">{t.system?.name ?? "None given"}</Detail>
        <Detail label="Asked by">{requester}</Detail>
        <Detail label="Assigned to">{personName(t.assignee, "Nobody yet")}</Detail>
        <Detail label="Created">
          <time dateTime={t.createdAt} title={formatDateTime(t.createdAt)}>
            {formatDate(t.createdAt)}
          </time>
        </Detail>
        <Detail label="Resolved">{formatDate(t.resolvedAt, "Not yet")}</Detail>
        {t.closedAt && <Detail label="Closed">{formatDate(t.closedAt)}</Detail>}
        {t.canManage && (
          <Detail label="Where it came from">{TICKET_SOURCE_LABELS[t.source]}</Detail>
        )}
      </dl>

      {commentsQ.isError ? (
        <LoadError what="messages" error={commentsQ.error} onRetry={() => commentsQ.refetch()} />
      ) : commentsQ.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Loading messages" />
        </div>
      ) : (
        <Thread
          title="Messages"
          headingLevel="h3"
          items={items}
          emptyText={
            t.canManage
              ? "No messages yet. Write to the person who asked for help."
              : "No messages yet. IT will reply here."
          }
          canPost
          sending={addComment.isPending}
          placeholder={t.canManage ? `Message ${requester}…` : "Message IT…"}
          onSend={(body, parentId) =>
            addComment.mutateAsync({ body, parentId }).catch((err) => {
              toast.error(errorText(err, "Couldn't send the message"));
              throw err;
            })
          }
          onDelete={(item) =>
            deleteComment
              .mutateAsync(item.id)
              .then(() => toast.success("Message deleted"))
              .catch((err) => toast.error(errorText(err, "Couldn't delete the message")))
          }
        />
      )}

      <TicketFormDialog
        open={editOpen}
        mode="edit"
        ticket={t}
        canManage={t.canManage}
        onClose={() => setEditOpen(false)}
      />
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
