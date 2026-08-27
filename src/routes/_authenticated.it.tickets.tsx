import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import {
  useTickets,
  useSaveTicket,
  useUpdateTicketStatus,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_STYLES,
  TICKET_SOURCE_LABELS,
  type TicketStatus,
  type TicketPriority,
} from "@/features/it/use-tickets";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/it/tickets")({
  head: () => ({ meta: [{ title: "Tickets — AIMS" }] }),
  component: TicketsBoard,
});

function TicketsBoard() {
  const { isAdminOrCeo, hasRole } = useAuth();
  const canManage = isAdminOrCeo || hasRole("it");
  const ticketsQ = useTickets();
  const updateStatus = useUpdateTicketStatus();
  const [newOpen, setNewOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TicketStatus | null>(null);

  const tickets = ticketsQ.data ?? [];

  const move = (id: string, status: TicketStatus) => {
    updateStatus.mutate(
      { id, status },
      {
        onSuccess: () => toast.success(`Moved to ${TICKET_STATUS_LABELS[status]}`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Move failed"),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Tickets</h1>
          <p className="text-xs text-muted-foreground">
            IT support requests — internal and from HRMS-licensed clients.
          </p>
        </div>
        {canManage && (
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> New ticket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <NewTicketForm onDone={() => setNewOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {ticketsQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 overflow-x-auto sm:grid-cols-2 lg:grid-cols-4">
          {TICKET_STATUSES.map((status) => {
            const columnTickets = tickets.filter((t) => t.status === status);
            return (
              <div
                key={status}
                className={`rounded-lg border bg-muted/30 p-2 min-h-[200px] ${
                  dragOverStatus === status ? "border-primary bg-primary/5" : ""
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStatus(status);
                }}
                onDragLeave={() => setDragOverStatus((cur) => (cur === status ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverStatus(null);
                  if (dragId) move(dragId, status);
                  setDragId(null);
                }}
              >
                <div className="flex items-center justify-between px-1 pb-2 text-xs font-semibold">
                  <span>{TICKET_STATUS_LABELS[status]}</span>
                  <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {columnTickets.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {columnTickets.length === 0 ? (
                    <div className="py-6 text-center text-[11px] text-muted-foreground">No tickets</div>
                  ) : (
                    columnTickets.map((t) => (
                      <div
                        key={t.id}
                        draggable={canManage}
                        onDragStart={() => setDragId(t.id)}
                        onDragEnd={() => setDragId(null)}
                        className={`rounded-lg border bg-card p-2.5 shadow-sm ${
                          dragId === t.id ? "opacity-50" : ""
                        }`}
                      >
                        <div className="text-[13px] font-medium leading-snug">{t.title}</div>
                        {t.description && (
                          <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                            {t.description}
                          </div>
                        )}
                        <div className="mt-1.5 flex items-center justify-between">
                          <Badge className={TICKET_PRIORITY_STYLES[t.priority]} variant="secondary">
                            {TICKET_PRIORITY_LABELS[t.priority]}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {TICKET_SOURCE_LABELS[t.source]}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewTicketForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const save = useSaveTicket();

  const submit = () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    save.mutate(
      { title: title.trim(), description: description || undefined, priority },
      {
        onSuccess: () => {
          toast.success("Ticket created");
          onDone();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
      },
    );
  };

  return (
    <div>
      <DialogHeader>
        <DialogTitle>New ticket</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's broken?" />
        </div>
        <div>
          <Label>Priority</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TICKET_PRIORITY_LABELS).map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </div>
  );
}
