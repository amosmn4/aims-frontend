import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Eye, Loader2, MapPin, Pencil, Trash2, User } from "lucide-react";
import { confirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { formatEventWhen, useDeleteCalendarEvent, type CalendarEvent } from "./use-calendar";

/** Shows one calendar event, with edit and delete for the people allowed to change it. */
export function EventDetailsDialog({
  open,
  event: liveEvent,
  loading,
  onClose,
  onEdit,
}: {
  open: boolean;
  event: CalendarEvent | null;
  loading: boolean;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
}) {
  const { user } = useAuth();
  const remove = useDeleteCalendarEvent();
  // Keeps the last event on screen while the dialog animates closed.
  const [lastEvent, setLastEvent] = useState<CalendarEvent | null>(liveEvent);
  if (liveEvent && liveEvent !== lastEvent) setLastEvent(liveEvent);
  const event = open ? liveEvent : lastEvent;

  const audience = (e: CalendarEvent) => {
    if (e.visibility === "everyone") return "Everyone in the company";
    if (e.visibility === "department") {
      return e.department ? `${e.department.name} department` : "One department";
    }
    return e.createdBy === user?.id ? "Only me" : "Only the person who added it";
  };

  const deleteEvent = async (e: CalendarEvent) => {
    const ok = await confirmDialog({
      title: `Delete "${e.title}"?`,
      description: "It will be removed from the calendar for everyone who can see it.",
      confirmLabel: "Delete event",
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(e.id, {
      onSuccess: () => {
        toast.success("Event deleted");
        onClose();
      },
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Couldn't delete the event"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        {open && loading ? (
          <>
            <DialogHeader>
              <DialogTitle>Event</DialogTitle>
              <DialogDescription className="sr-only">Loading the event</DialogDescription>
            </DialogHeader>
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          </>
        ) : !event ? (
          <DialogHeader>
            <DialogTitle>Event</DialogTitle>
            <DialogDescription>
              This event has been removed or you can no longer see it.
            </DialogDescription>
          </DialogHeader>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6">{event.title}</DialogTitle>
              <DialogDescription className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 shrink-0" />
                {formatEventWhen(event)}
              </DialogDescription>
            </DialogHeader>

            <ul className="space-y-2 text-sm">
              {event.location && (
                <li className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <span>
                    <span className="sr-only">Location: </span>
                    {event.location}
                  </span>
                </li>
              )}
              <li className="flex items-start gap-2">
                <Eye className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <span>
                  <span className="sr-only">Who can see this: </span>
                  {audience(event)}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <User className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <span>Added by {event.creator.fullName || event.creator.email}</span>
              </li>
            </ul>

            {event.description && (
              <div className="text-sm">
                <h3 className="text-xs font-medium text-muted-foreground">Details</h3>
                <p className="whitespace-pre-wrap">{event.description}</p>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              {event.canEdit ? (
                <>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive sm:mr-auto"
                    disabled={remove.isPending}
                    onClick={() => deleteEvent(event)}
                  >
                    {remove.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-1" />
                    )}
                    Delete event
                  </Button>
                  <Button variant="outline" onClick={onClose}>
                    Close
                  </Button>
                  <Button onClick={() => onEdit(event)}>
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit event
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground sm:mr-auto sm:self-center">
                    Only the person who added it, or the CEO, can change this event.
                  </p>
                  <Button variant="outline" onClick={onClose}>
                    Close
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        )}
        {(!event || (open && loading)) && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
