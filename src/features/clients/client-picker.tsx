import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { useClients, useCreateClient } from "@/features/finance/use-finance-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/dialog";

const CREATE_NEW_VALUE = "__create_new_client__";

/**
 * Client select that also lets you create the client inline (name + basics) instead of forcing
 * a context-switch to the Clients module first — used everywhere a won lead/request/tender is
 * being onboarded and might not have a real Client record yet.
 */
export function ClientPicker({
  value,
  onChange,
  placeholder = "Select a client…",
}: {
  value: string;
  onChange: (clientId: string) => void;
  placeholder?: string;
}) {
  const clientsQ = useClients();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === CREATE_NEW_VALUE) {
            setCreateOpen(true);
            return;
          }
          onChange(v);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {(clientsQ.data ?? []).map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
          <SelectItem value={CREATE_NEW_VALUE} className="text-primary font-medium">
            <span className="inline-flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" /> Create new client…
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <NewClientForm
            onCreated={(clientId) => {
              onChange(clientId);
              setCreateOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewClientForm({ onCreated }: { onCreated: (clientId: string) => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [country, setCountry] = useState("");
  const [industry, setIndustry] = useState("");
  const [segment, setSegment] = useState("");
  const create = useCreateClient();

  const submit = () => {
    if (!name.trim()) {
      toast.error("Client name is required");
      return;
    }
    create.mutate(
      {
        name: name.trim(),
        code: code.trim() || undefined,
        country: country.trim() || undefined,
        industry: industry.trim() || undefined,
        segment: segment.trim() || undefined,
      },
      {
        onSuccess: (client) => {
          toast.success(`${client.name} added as a client`);
          onCreated(client.id);
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to create client"),
      },
    );
  };

  return (
    <div>
      <DialogHeader>
        <DialogTitle>Create new client</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <div>
          <Label>Client name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Company name"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Code (optional)</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. CL-012"
            />
          </div>
          <div>
            <Label>Country (optional)</Label>
            <Input value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Industry (optional)</Label>
            <Input value={industry} onChange={(e) => setIndustry(e.target.value)} />
          </div>
          <div>
            <Label>Segment (optional)</Label>
            <Input
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              placeholder="Enterprise / SME"
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={create.isPending}>
          {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Create client
        </Button>
      </DialogFooter>
    </div>
  );
}
