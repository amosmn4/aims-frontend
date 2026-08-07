import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, Users, Mail, Phone, Star } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import { useClients } from "@/features/finance/use-finance-data";
import {
  useClientContacts,
  useSaveClient,
  useDeleteClient,
  useSaveContact,
  useDeleteContact,
  useProfilesLite,
  type ClientContactRow,
} from "@/features/clients/use-clients-contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/clients/")({
  component: ClientsList,
});

type ClientDraft = {
  id?: string;
  name: string;
  code: string;
  country: string;
  currency_code: string;
  industry: string;
  segment: string;
  account_manager_id: string;
  is_active: boolean;
};
const emptyClient: ClientDraft = {
  name: "",
  code: "",
  country: "",
  currency_code: "USD",
  industry: "",
  segment: "",
  account_manager_id: "",
  is_active: true,
};

function ClientsList() {
  const clientsQ = useClients();
  const profilesQ = useProfilesLite();
  const save = useSaveClient();
  const del = useDeleteClient();

  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("all");
  const [segment, setSegment] = useState("all");
  const [editing, setEditing] = useState<ClientDraft | null>(null);
  const [contactsFor, setContactsFor] = useState<{ id: string; name: string } | null>(null);

  const industries = useMemo(() => {
    const s = new Set<string>();
    (clientsQ.data ?? []).forEach((c) => {
      const v = (c as unknown as { industry?: string | null }).industry;
      if (v) s.add(v);
    });
    return Array.from(s).sort();
  }, [clientsQ.data]);
  const segments = useMemo(() => {
    const s = new Set<string>();
    (clientsQ.data ?? []).forEach((c) => {
      const v = (c as unknown as { segment?: string | null }).segment;
      if (v) s.add(v);
    });
    return Array.from(s).sort();
  }, [clientsQ.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (clientsQ.data ?? []).filter((c) => {
      const ind = (c as unknown as { industry?: string | null }).industry ?? "";
      const seg = (c as unknown as { segment?: string | null }).segment ?? "";
      if (industry !== "all" && ind !== industry) return false;
      if (segment !== "all" && seg !== segment) return false;
      if (q && !c.name.toLowerCase().includes(q) && !(c.code ?? "").toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [clientsQ.data, search, industry, segment]);

  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    (profilesQ.data ?? []).forEach((p) => m.set(p.id, p.full_name ?? p.email));
    return m;
  }, [profilesQ.data]);

  const submit = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      await save.mutateAsync({
        id: editing.id,
        name: editing.name.trim(),
        code: editing.code.trim() || null,
        country: editing.country.trim() || null,
        currency_code: editing.currency_code.trim() || "USD",
        industry: editing.industry.trim() || null,
        segment: editing.segment.trim() || null,
        account_manager_id: editing.account_manager_id || null,
        is_active: editing.is_active,
      });
      toast.success(editing.id ? "Client updated" : "Client added");
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const remove = async (id: string, name: string) => {
    const ok = await confirmDialog({
      title: `Delete ${name}?`,
      description: "Contracts referencing this client will block deletion.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(id);
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cannot delete — client is in use");
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card p-3 flex gap-2 flex-wrap items-center">
        <Input
          placeholder="Search name or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-9"
        />
        <Select value={industry} onValueChange={setIndustry}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Industry" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All industries</SelectItem>
            {industries.map((i) => (
              <SelectItem key={i} value={i}>
                {i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={segment} onValueChange={setSegment}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Segment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All segments</SelectItem>
            {segments.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button size="sm" onClick={() => setEditing({ ...emptyClient })}>
          <Plus className="h-4 w-4 mr-1" /> New client
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        {clientsQ.isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Code</th>
                  <th className="px-3 py-2 text-left font-medium">Industry</th>
                  <th className="px-3 py-2 text-left font-medium">Segment</th>
                  <th className="px-3 py-2 text-left font-medium">Account manager</th>
                  <th className="px-3 py-2 text-left font-medium">Country</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground text-xs">
                      No clients match your filters.
                    </td>
                  </tr>
                )}
                {filtered.map((c) => {
                  const ind = (c as unknown as { industry?: string | null }).industry ?? "";
                  const seg = (c as unknown as { segment?: string | null }).segment ?? "";
                  const am =
                    (c as unknown as { account_manager_id?: string | null }).account_manager_id ??
                    null;
                  return (
                    <tr key={c.id} className="border-t hover:bg-secondary/20">
                      <td className="px-3 py-2 font-medium">{c.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{c.code ?? "—"}</td>
                      <td className="px-3 py-2">{ind || "—"}</td>
                      <td className="px-3 py-2">{seg || "—"}</td>
                      <td className="px-3 py-2">{am ? (profileMap.get(am) ?? "—") : "—"}</td>
                      <td className="px-3 py-2">{c.country ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-[0.625rem] px-1.5 py-0.5 rounded ${c.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
                        >
                          {c.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setContactsFor({ id: c.id, name: c.name })}
                        >
                          <Users className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setEditing({
                              id: c.id,
                              name: c.name,
                              code: c.code ?? "",
                              country: c.country ?? "",
                              currency_code: c.currency_code,
                              industry: ind,
                              segment: seg,
                              account_manager_id: am ?? "",
                              is_active: c.is_active,
                            })
                          }
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(c.id, c.name)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Client edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit client" : "New client"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Name *</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Code</Label>
                <Input
                  value={editing.code}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                />
              </div>
              <div>
                <Label>Currency</Label>
                <Input
                  value={editing.currency_code}
                  onChange={(e) =>
                    setEditing({ ...editing, currency_code: e.target.value.toUpperCase() })
                  }
                />
              </div>
              <div>
                <Label>Industry</Label>
                <Input
                  value={editing.industry}
                  onChange={(e) => setEditing({ ...editing, industry: e.target.value })}
                  placeholder="e.g. Oil & Gas"
                />
              </div>
              <div>
                <Label>Segment</Label>
                <Input
                  value={editing.segment}
                  onChange={(e) => setEditing({ ...editing, segment: e.target.value })}
                  placeholder="e.g. Enterprise, SMB"
                />
              </div>
              <div>
                <Label>Country</Label>
                <Input
                  value={editing.country}
                  onChange={(e) => setEditing({ ...editing, country: e.target.value })}
                />
              </div>
              <div>
                <Label>Account manager</Label>
                <Select
                  value={editing.account_manager_id || "none"}
                  onValueChange={(v) =>
                    setEditing({ ...editing, account_manager_id: v === "none" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {(profilesQ.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name ?? p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Switch
                  checked={editing.is_active}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editing?.id ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contacts dialog */}
      <ContactsDialog client={contactsFor} onClose={() => setContactsFor(null)} />
    </div>
  );
}

function ContactsDialog({
  client,
  onClose,
}: {
  client: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const q = useClientContacts(client?.id);
  const save = useSaveContact();
  const del = useDeleteContact();
  const [draft, setDraft] = useState<Partial<ClientContactRow> | null>(null);

  const submit = async () => {
    if (!client || !draft?.name?.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      await save.mutateAsync({
        ...draft,
        client_id: client.id,
        name: draft.name.trim(),
      });
      setDraft(null);
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const remove = async (id: string) => {
    if (!client) return;
    const ok = await confirmDialog({ description: "Delete this contact?", destructive: true });
    if (!ok) return;
    await del.mutateAsync({ id, client_id: client.id });
  };

  return (
    <Dialog open={!!client} onOpenChange={(o) => !o && (onClose(), setDraft(null))}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Contacts — {client?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {q.isLoading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (q.data ?? []).length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">No contacts yet.</div>
          ) : (
            (q.data ?? []).map((c) => (
              <div
                key={c.id}
                className="border rounded p-2 flex items-start justify-between gap-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium flex items-center gap-1.5">
                    {c.is_primary && <Star className="h-3 w-3 text-warning fill-warning" />}
                    {c.name}
                    {c.role && <span className="text-xs text-muted-foreground">· {c.role}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-3 flex-wrap mt-0.5">
                    {c.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {c.email}
                      </span>
                    )}
                    {c.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {c.phone}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setDraft(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t pt-3 space-y-2">
          {draft ? (
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Name *"
                value={draft.name ?? ""}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              <Input
                placeholder="Role"
                value={draft.role ?? ""}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
              />
              <Input
                placeholder="Email"
                value={draft.email ?? ""}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
              <Input
                placeholder="Phone"
                value={draft.phone ?? ""}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
              <div className="col-span-2 flex items-center gap-2 text-sm">
                <Switch
                  checked={!!draft.is_primary}
                  onCheckedChange={(v) => setDraft({ ...draft, is_primary: v })}
                />
                <Label>Primary contact</Label>
              </div>
              <Textarea
                className="col-span-2"
                placeholder="Notes"
                rows={2}
                value={draft.notes ?? ""}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
              <div className="col-span-2 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={submit} disabled={save.isPending}>
                  {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDraft({ name: "", is_primary: false })}
            >
              <Plus className="h-4 w-4 mr-1" /> Add contact
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
