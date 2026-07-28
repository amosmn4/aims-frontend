import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import {
  useSaveClientRequest,
  SOURCE_LABELS,
  type ClientRequestSource,
} from "@/features/client-requests/use-client-requests";
import { useClients, useServiceLines } from "@/features/finance/use-finance-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface NewRequestDialogProps {
  /** Custom trigger element (e.g. themed differently on the Kanban board). Defaults to a plain "New request" button. */
  trigger?: ReactNode;
  /** Pre-selects a source (e.g. the Kanban board defaults to "operations") without hardcoding/hiding the field — still user-editable. */
  defaultSource?: ClientRequestSource;
  /** Toast copy shown on success; differs slightly between the Inbox and the Kanban board. */
  successMessage?: string;
  onCreated?: () => void;
}

// Canonical client-request creation form, shared by both the Requests Inbox and the Client
// Requests Kanban board so the two never drift into different field sets again — they already
// read/write through the same `client_requests` table and the same `useClientRequests` query key.
export function NewRequestDialog({
  trigger,
  defaultSource = "operations",
  successMessage = "Request logged",
  onCreated,
}: NewRequestDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [source, setSource] = useState<ClientRequestSource>(defaultSource);
  const [clientMode, setClientMode] = useState<"existing" | "prospect">("existing");
  const [clientId, setClientId] = useState("");
  const [prospectClientName, setProspectClientName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [serviceLineId, setServiceLineId] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [description, setDescription] = useState("");

  const clientsQ = useClients();
  const serviceLinesQ = useServiceLines();
  const save = useSaveClientRequest();

  const reset = () => {
    setTitle("");
    setSource(defaultSource);
    setClientMode("existing");
    setClientId("");
    setProspectClientName("");
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    setServiceLineId("");
    setEstimatedValue("");
    setDescription("");
  };

  const submit = () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    save.mutate(
      {
        title: title.trim(),
        source,
        client_id: clientMode === "existing" ? clientId || undefined : undefined,
        prospect_client_name: clientMode === "prospect" ? prospectClientName.trim() || undefined : undefined,
        contact_name: contactName || undefined,
        contact_email: contactEmail || undefined,
        contact_phone: contactPhone || undefined,
        service_line_id: serviceLineId || undefined,
        estimated_value: estimatedValue ? Number(estimatedValue) : undefined,
        description: description || undefined,
      },
      {
        onSuccess: () => {
          toast.success(successMessage);
          setOpen(false);
          reset();
          onCreated?.();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> New request
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a client request</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is being requested?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Source</Label>
              <Select value={source} onValueChange={(v) => setSource(v as ClientRequestSource)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SOURCE_LABELS).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Service line</Label>
              <Select value={serviceLineId} onValueChange={setServiceLineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {(serviceLinesQ.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Client (optional)</Label>
              <button
                type="button"
                onClick={() => setClientMode(clientMode === "existing" ? "prospect" : "existing")}
                className="text-[0.6875rem] text-primary hover:underline"
              >
                {clientMode === "existing" ? "+ New company" : "Pick existing client"}
              </button>
            </div>
            {clientMode === "existing" ? (
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Not yet known" />
                </SelectTrigger>
                <SelectContent>
                  {(clientsQ.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={prospectClientName}
                onChange={(e) => setProspectClientName(e.target.value)}
                placeholder="Company name (not in system yet)"
              />
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Contact name</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div>
              <Label>Contact email</Label>
              <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
            <div>
              <Label>Contact phone</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Est. value (optional)</Label>
            <Input type="number" value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Log request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
