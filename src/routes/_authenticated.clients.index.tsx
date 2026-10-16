import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Loader2, Plus, Pencil, Trash2, Users, Mail, Phone, Star } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import {
  useClients,
  useClientFacets,
  type Client,
  type ClientLifecycle,
  type ClientRelationship,
} from "@/features/finance/use-finance-data";
import {
  useClientContacts,
  useClientPermissions,
  useDeleteClient,
  useSaveContact,
  useDeleteContact,
  useProfilesLite,
  type ClientContactRow,
} from "@/features/clients/use-clients-contracts";
import { ClientFormDialog } from "@/features/clients/client-form-dialog";
import { FormField } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { RowActions } from "@/components/row-actions";
import { usePagination } from "@/hooks/use-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { PaginationBar } from "@/components/pagination-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Switch } from "@/components/ui/switch";

const searchSchema = z.object({
  q: z.preprocess((v) => (v == null || v === "" ? undefined : String(v)), z.string().optional()),
});

export const Route = createFileRoute("/_authenticated/clients/")({
  validateSearch: searchSchema,
  component: ClientsList,
});

const LIFECYCLE_PILLS: Record<ClientLifecycle, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-success/15 text-success" },
  past: { label: "Past client", className: "bg-muted text-muted-foreground" },
  prospect: { label: "Prospect", className: "bg-primary/10 text-primary" },
};

const RELATIONSHIP_PILLS: Record<ClientRelationship, { label: string; className: string } | null> =
  {
    recurring: { label: "Recurring", className: "bg-primary/10 text-primary" },
    one_off: { label: "One-off", className: "bg-accent/15 text-accent" },
    none: null,
  };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ClientsList() {
  const { canCreateClient, canEditClient: canManage } = useClientPermissions();
  const { q: urlQuery } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [search, setSearch] = useState(urlQuery ?? "");
  const [industry, setIndustry] = useState("all");
  const [segment, setSegment] = useState("all");
  const { page, pageSize, setPage, setPageSize } = usePagination(25);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const writtenQuery = useRef(urlQuery ?? "");

  // Keep ?q= in step with the typed search so the page can be shared or refreshed.
  useEffect(() => {
    if (debouncedSearch === (urlQuery ?? "")) return;
    writtenQuery.current = debouncedSearch;
    navigate({ search: { q: debouncedSearch || undefined }, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to typing
  }, [debouncedSearch]);

  // A link such as /clients?q=Acme fills the search box.
  useEffect(() => {
    if ((urlQuery ?? "") === writtenQuery.current) return;
    writtenQuery.current = urlQuery ?? "";
    setSearch(urlQuery ?? "");
    setPage(1);
  }, [urlQuery, setPage]);

  const clearSearch = () => {
    setSearch("");
    setPage(1);
  };

  const clientsQ = useClients(
    {
      industry: industry === "all" ? undefined : industry,
      segment: segment === "all" ? undefined : segment,
      q: debouncedSearch || undefined,
    },
    { page, pageSize },
  );
  const isFiltered = !!search.trim() || industry !== "all" || segment !== "all";
  const facetsQ = useClientFacets();
  const profilesQ = useProfilesLite();
  const del = useDeleteClient();
  // null opens a new client; a client opens it for editing.
  const [form, setForm] = useState<{ client: Client | null } | null>(null);
  const [contactsFor, setContactsFor] = useState<{ id: string; name: string } | null>(null);

  const industries = facetsQ.data?.industries ?? [];
  const segments = facetsQ.data?.segments ?? [];

  const clientsResult = clientsQ.data;
  const filtered = clientsResult
    ? Array.isArray(clientsResult)
      ? clientsResult
      : clientsResult.data
    : [];
  const clientsTotal =
    clientsResult && !Array.isArray(clientsResult) ? clientsResult.total : filtered.length;

  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    (profilesQ.data ?? []).forEach((p) => m.set(p.id, p.full_name ?? p.email));
    return m;
  }, [profilesQ.data]);

  const remove = async (id: string, name: string) => {
    const ok = await confirmDialog({
      title: `Delete ${name}?`,
      description: "A client with contracts can't be deleted.",
      confirmLabel: "Delete client",
      destructive: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(id);
      toast.success("Client deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cannot delete — client is in use");
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card p-3 flex gap-2 flex-wrap items-center">
        <Input
          placeholder="Search name, code, email or phone"
          aria-label="Search clients"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs h-9"
        />
        <Select
          value={industry}
          onValueChange={(v) => {
            setIndustry(v);
            setPage(1);
          }}
        >
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
        <Select
          value={segment}
          onValueChange={(v) => {
            setSegment(v);
            setPage(1);
          }}
        >
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
        {canCreateClient && (
          <Button size="sm" onClick={() => setForm({ client: null })}>
            <Plus className="h-4 w-4 mr-1" /> New client
          </Button>
        )}
      </div>
      {!canCreateClient ? (
        <ViewOnlyBanner area="clients" action="add or edit clients" />
      ) : (
        !canManage && (
          <p className="text-xs text-muted-foreground">
            Only Finance and HR can edit or delete a client. You can add new clients and contacts.
          </p>
        )
      )}

      <div className="rounded-lg border bg-card overflow-hidden">
        {clientsQ.isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : clientsQ.isError ? (
          <LoadError
            what="clients"
            error={clientsQ.error}
            onRetry={() => clientsQ.refetch()}
            className="m-3"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Code</th>
                  <th className="px-3 py-2 text-left font-medium">Department</th>
                  <th className="px-3 py-2 text-left font-medium">Industry</th>
                  <th className="px-3 py-2 text-left font-medium">Segment</th>
                  <th className="px-3 py-2 text-left font-medium">Account manager</th>
                  <th className="px-3 py-2 text-left font-medium">Country</th>
                  <th className="px-3 py-2 text-left font-medium">Relationship</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-3 py-8 text-center text-muted-foreground text-xs"
                    >
                      {isFiltered ? (
                        <div className="flex flex-col items-center gap-2">
                          <span>No clients match your search or filters</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              clearSearch();
                              setIndustry("all");
                              setSegment("all");
                            }}
                          >
                            Clear filters
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <span>No clients yet</span>
                          {canCreateClient && (
                            <Button size="sm" onClick={() => setForm({ client: null })}>
                              <Plus className="h-4 w-4 mr-1" /> New client
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                {filtered.map((c) => {
                  const ind = c.industry ?? "";
                  const seg = c.segment ?? "";
                  const am = c.account_manager_id;
                  const lifecycle = c.lifecycle ? LIFECYCLE_PILLS[c.lifecycle] : null;
                  const relationship = c.relationship ? RELATIONSHIP_PILLS[c.relationship] : null;
                  return (
                    <tr key={c.id} className="border-t hover:bg-secondary/20">
                      <td className="px-3 py-2">
                        <div className="font-medium">{c.name}</div>
                        {(c.contact_email || c.contact_phone) && (
                          <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
                            {c.contact_email && (
                              <span className="inline-flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {c.contact_email}
                              </span>
                            )}
                            {c.contact_phone && (
                              <span className="inline-flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {c.contact_phone}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{c.code ?? "—"}</td>
                      <td className="px-3 py-2">{c.department_name ?? "—"}</td>
                      <td className="px-3 py-2">{ind || "—"}</td>
                      <td className="px-3 py-2">{seg || "—"}</td>
                      <td className="px-3 py-2">{am ? (profileMap.get(am) ?? "—") : "—"}</td>
                      <td className="px-3 py-2">{c.country ?? "—"}</td>
                      <td className="px-3 py-2">
                        {relationship ? (
                          <span
                            className={`text-[0.625rem] px-1.5 py-0.5 rounded whitespace-nowrap ${relationship.className}`}
                          >
                            {relationship.label}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {lifecycle ? (
                          <span
                            className={`text-[0.625rem] px-1.5 py-0.5 rounded whitespace-nowrap ${lifecycle.className}`}
                          >
                            {lifecycle.label}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setContactsFor({ id: c.id, name: c.name })}
                            title={`Contacts for ${c.name}`}
                            aria-label={`Contacts for ${c.name}`}
                          >
                            <Users className="h-3.5 w-3.5" />
                          </Button>
                          {canManage && (
                            <RowActions
                              label={c.name}
                              onEdit={() => setForm({ client: c })}
                              onDelete={() => remove(c.id, c.name)}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <PaginationBar
              page={page}
              pageSize={pageSize}
              total={clientsTotal}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      <ClientFormDialog
        open={!!form}
        onOpenChange={(o) => !o && setForm(null)}
        client={form?.client}
      />

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
  const [draft, setDraftState] = useState<Partial<ClientContactRow> | null>(null);
  const [errors, setErrors] = useState<{ name?: string; email?: string; form?: string }>({});
  const setDraft = (next: Partial<ClientContactRow> | null) => {
    setDraftState(next);
    setErrors({});
  };

  const submit = async () => {
    if (!client || !draft) return;
    const found: typeof errors = {};
    const name = draft.name?.trim() ?? "";
    const email = draft.email?.trim() ?? "";
    if (!name) found.name = "Enter the contact's name";
    if (email && !EMAIL_PATTERN.test(email)) found.email = "Enter a valid email address";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    try {
      await save.mutateAsync({ ...draft, client_id: client.id, name, email: email || null });
      setDraft(null);
      toast.success("Contact saved");
    } catch (e) {
      setErrors({ form: e instanceof Error ? e.message : "Couldn't save the contact. Try again." });
    }
  };

  const close = () => {
    onClose();
    setDraft(null);
  };
  const contacts = q.data ?? [];

  const remove = async (id: string, contactName: string) => {
    if (!client) return;
    const ok = await confirmDialog({
      title: `Delete ${contactName}?`,
      description: "They will be removed from this client's contacts.",
      confirmLabel: "Delete contact",
      destructive: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync({ id, client_id: client.id });
      toast.success("Contact deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the contact");
    }
  };

  return (
    <Dialog open={!!client} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Contacts — {client?.name}</DialogTitle>
          <DialogDescription>People you deal with at this client.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {q.isLoading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : q.isError ? (
            <LoadError what="contacts" error={q.error} onRetry={() => q.refetch()} />
          ) : contacts.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">No contacts yet.</div>
          ) : (
            contacts.map((c) => (
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
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDraft(c)}
                    title={`Edit contact ${c.name}`}
                    aria-label={`Edit contact ${c.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(c.id, c.name)}
                    title={`Delete contact ${c.name}`}
                    aria-label={`Delete contact ${c.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t pt-3 space-y-2">
          {draft ? (
            <form
              noValidate
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <FormField id="contact-name" label="Name" required error={errors.name}>
                <Input
                  id="contact-name"
                  value={draft.name ?? ""}
                  aria-invalid={!!errors.name}
                  autoFocus
                  onChange={(e) => {
                    setDraftState({ ...draft, name: e.target.value });
                    setErrors((x) => ({ ...x, name: undefined, form: undefined }));
                  }}
                />
              </FormField>
              <FormField id="contact-role" label="Role">
                <Input
                  id="contact-role"
                  value={draft.role ?? ""}
                  placeholder="e.g. HR manager"
                  onChange={(e) => setDraftState({ ...draft, role: e.target.value })}
                />
              </FormField>
              <FormField id="contact-email" label="Email" error={errors.email}>
                <Input
                  id="contact-email"
                  type="email"
                  value={draft.email ?? ""}
                  aria-invalid={!!errors.email}
                  onChange={(e) => {
                    setDraftState({ ...draft, email: e.target.value });
                    setErrors((x) => ({ ...x, email: undefined, form: undefined }));
                  }}
                />
              </FormField>
              <FormField id="contact-phone" label="Phone">
                <Input
                  id="contact-phone"
                  type="tel"
                  value={draft.phone ?? ""}
                  onChange={(e) => setDraftState({ ...draft, phone: e.target.value })}
                />
              </FormField>
              <div className="sm:col-span-2 flex items-center gap-2 text-sm">
                <Switch
                  id="contact-primary"
                  checked={!!draft.is_primary}
                  onCheckedChange={(v) => setDraftState({ ...draft, is_primary: v })}
                />
                <Label htmlFor="contact-primary">Primary contact</Label>
              </div>
              <FormField id="contact-notes" label="Notes" className="sm:col-span-2">
                <Textarea
                  id="contact-notes"
                  rows={2}
                  value={draft.notes ?? ""}
                  onChange={(e) => setDraftState({ ...draft, notes: e.target.value })}
                />
              </FormField>
              {errors.form && (
                <p role="alert" className="sm:col-span-2 text-sm text-destructive">
                  {errors.form}
                </p>
              )}
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={save.isPending}>
                  {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save contact
                </Button>
              </div>
            </form>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDraft({ name: "", is_primary: false })}
            >
              <Plus className="h-4 w-4 mr-1" /> New contact
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
