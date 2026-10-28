import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown, Loader2 } from "lucide-react";
import { useClients, type Client } from "@/features/finance/use-finance-data";
import {
  CURRENCY_CODES,
  useDepartments,
  useEligibleDepartments,
  useProfilesLite,
  useSaveClient,
} from "@/features/clients/use-clients-contracts";
import { useCompanySettings } from "@/features/settings/use-company-settings";
import { FormField, RequiredNote } from "@/components/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { cn } from "@/lib/utils";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COMPANY_SUFFIXES = new Set(["ltd", "limited", "plc", "company", "co"]);

/** "Imara Insurance Ltd." and "imara insurance limited" both become "imara insurance". */
export function normalizeClientName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !COMPANY_SUFFIXES.has(w))
    .join(" ");
}

export function findDuplicateClient(name: string, clients: Client[], excludeId?: string) {
  const key = normalizeClientName(name);
  if (!key) return undefined;
  return clients.find((c) => c.id !== excludeId && normalizeClientName(c.name) === key);
}

type Draft = {
  name: string;
  contact_email: string;
  contact_phone: string;
  country: string;
  currency_code: string;
  industry: string;
  segment: string;
  department_id: string;
  account_manager_id: string;
  code: string;
  is_active: boolean;
};

type Errors = Partial<Record<"name" | "contact_email" | "form", string>>;

/** Create or edit a client. The one client form used across AIMS. */
export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  defaultName = "",
  departmentId,
  onSaved,
  onUseExisting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edits this client; omit to create a new one. */
  client?: Client | null;
  defaultName?: string;
  /** Pre-selects the capturing department on a new client. */
  departmentId?: string;
  onSaved?: (client: { id: string; name: string }) => void;
  /** When set, a likely duplicate offers "Use existing client". */
  onUseExisting?: (client: Client) => void;
}) {
  const [dirty, setDirty] = useState(false);
  const { guardClose } = useUnsavedChanges(dirty);
  const close = () => {
    setDirty(false);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && guardClose(close)}>
      {open && (
        <ClientForm
          key={client?.id ?? "new"}
          client={client ?? null}
          defaultName={defaultName}
          departmentId={departmentId}
          onDirtyChange={setDirty}
          onCancel={() => guardClose(close)}
          onSaved={(saved) => {
            onSaved?.(saved);
            close();
          }}
          onUseExisting={
            onUseExisting
              ? (existing) => {
                  onUseExisting(existing);
                  close();
                }
              : undefined
          }
        />
      )}
    </Dialog>
  );
}

function ClientForm({
  client,
  defaultName,
  departmentId,
  onDirtyChange,
  onCancel,
  onSaved,
  onUseExisting,
}: {
  client: Client | null;
  defaultName: string;
  departmentId?: string;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onSaved: (client: { id: string; name: string }) => void;
  onUseExisting?: (client: Client) => void;
}) {
  const settingsQ = useCompanySettings();
  const clientsQ = useClients();
  const departmentsQ = useDepartments();
  const eligibleQ = useEligibleDepartments();
  const profilesQ = useProfilesLite();
  const save = useSaveClient();

  const initial = useMemo<Draft>(
    () => ({
      name: client?.name ?? defaultName,
      contact_email: client?.contact_email ?? "",
      contact_phone: client?.contact_phone ?? "",
      country: client ? (client.country ?? "") : "Kenya",
      // Empty means "use the company currency".
      currency_code: client?.currency_code ?? "",
      industry: client?.industry ?? "",
      segment: client?.segment ?? "",
      department_id: client ? (client.department_id ?? "") : (departmentId ?? ""),
      account_manager_id: client?.account_manager_id ?? "",
      code: client?.code ?? "",
      is_active: client?.is_active ?? true,
    }),
    [client, defaultName, departmentId],
  );
  const [draft, setDraft] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [showMore, setShowMore] = useState(
    !!client && !!(client.industry || client.segment || client.account_manager_id || client.code),
  );
  const [dupNudge, setDupNudge] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const companyCurrency = settingsQ.data?.currencyCode ?? "KES";
  const currency = draft.currency_code || companyCurrency;
  const currencyOptions = CURRENCY_CODES.includes(currency as (typeof CURRENCY_CODES)[number])
    ? [...CURRENCY_CODES]
    : [currency, ...CURRENCY_CODES];

  // Keep the client's current department selectable even if the viewer can't assign it.
  const departmentOptions = (() => {
    const eligible = eligibleQ.data ?? [];
    const current = draft.department_id
      ? (departmentsQ.data ?? []).find((d) => d.id === draft.department_id)
      : undefined;
    return current && !eligible.some((d) => d.id === current.id)
      ? [current, ...eligible]
      : eligible;
  })();

  // Warn while typing (debounced); after a blocked submit, check the exact name.
  const debouncedName = useDebouncedValue(draft.name, 250);
  const duplicate = client
    ? undefined
    : findDuplicateClient(dupNudge ? draft.name : debouncedName, clientsQ.data ?? []);
  const showDuplicate =
    !!duplicate && normalizeClientName(draft.name) === normalizeClientName(duplicate.name);

  const edit = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => {
      const next: Errors = { ...e, form: undefined };
      for (const k of Object.keys(patch)) delete next[k as keyof Errors];
      return next;
    });
    if ("name" in patch) setDupNudge(false);
  };

  const submit = async (createAnyway = false) => {
    const found: Errors = {};
    if (!draft.name.trim()) found.name = "Enter the client's name";
    const email = draft.contact_email.trim();
    if (email && !EMAIL_PATTERN.test(email)) found.contact_email = "Enter a valid email address";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const dup = client ? undefined : findDuplicateClient(draft.name, clientsQ.data ?? []);
    if (dup && !createAnyway) {
      setDupNudge(true);
      return;
    }

    try {
      const saved = await save.mutateAsync({
        id: client?.id,
        name: draft.name.trim(),
        code: draft.code.trim() || null,
        country: draft.country.trim() || null,
        currency_code: currency,
        industry: draft.industry.trim() || null,
        segment: draft.segment.trim() || null,
        account_manager_id: draft.account_manager_id || null,
        is_active: draft.is_active,
        department_id: draft.department_id || null,
        contact_email: email || null,
        contact_phone: draft.contact_phone.trim() || null,
      });
      toast.success(client ? `${saved.name} updated` : `${saved.name} added as a client`);
      onSaved(saved);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong. Please try again.";
      setErrors({ [message.toLowerCase().includes("email") ? "contact_email" : "form"]: message });
    }
  };

  return (
    <DialogContent className="max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-4"
        noValidate
      >
        <DialogHeader>
          <DialogTitle>{client ? `Edit client ${client.name}` : "New client"}</DialogTitle>
          <DialogDescription>
            {client
              ? "Changes apply everywhere this client is used."
              : "Add the organisation you'll invoice and sign contracts with."}
          </DialogDescription>
          <RequiredNote />
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <FormField id="client-name" label="Name" required error={errors.name}>
              <Input
                id="client-name"
                value={draft.name}
                autoFocus
                placeholder="e.g. Imara Insurance Ltd"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "client-name-error" : undefined}
                onChange={(e) => edit({ name: e.target.value })}
              />
            </FormField>
            {showDuplicate && duplicate && (
              <div
                role={dupNudge ? "alert" : "status"}
                className={cn(
                  "flex flex-col gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm sm:flex-row sm:items-center",
                  dupNudge && "ring-2 ring-warning",
                )}
              >
                <AlertTriangle className="hidden h-4 w-4 shrink-0 text-warning sm:block" />
                <span className="flex-1">
                  <strong>{duplicate.name}</strong> already exists — use it instead?
                </span>
                <div className="flex flex-wrap gap-2">
                  {onUseExisting && (
                    <Button type="button" size="sm" onClick={() => onUseExisting(duplicate)}>
                      Use existing client
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={save.isPending}
                    onClick={() => submit(true)}
                  >
                    Create anyway
                  </Button>
                </div>
              </div>
            )}
          </div>

          <FormField id="client-email" label="Contact person email" error={errors.contact_email}>
            <Input
              id="client-email"
              type="email"
              value={draft.contact_email}
              placeholder="e.g. accounts@client.co.ke"
              aria-invalid={!!errors.contact_email}
              aria-describedby={errors.contact_email ? "client-email-error" : undefined}
              onChange={(e) => edit({ contact_email: e.target.value })}
            />
          </FormField>
          <FormField id="client-phone" label="Contact phone">
            <Input
              id="client-phone"
              type="tel"
              value={draft.contact_phone}
              placeholder="e.g. +254 712 345 678"
              onChange={(e) => edit({ contact_phone: e.target.value })}
            />
          </FormField>
          <FormField id="client-country" label="Country">
            <Input
              id="client-country"
              value={draft.country}
              onChange={(e) => edit({ country: e.target.value })}
            />
          </FormField>
          <FormField id="client-currency" label="Currency" hint="Used for this client's invoices">
            <Select value={currency} onValueChange={(v) => edit({ currency_code: v })}>
              <SelectTrigger id="client-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencyOptions.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
            aria-controls="client-more-details"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", showMore && "rotate-180")} />
            More details
            <span className="text-xs font-normal">
              (industry, segment, department, account manager{client ? ", active" : ""})
            </span>
          </button>
          {showMore && (
            <div
              id="client-more-details"
              className="mt-3 grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2"
            >
              <FormField id="client-industry" label="Industry">
                <Input
                  id="client-industry"
                  value={draft.industry}
                  placeholder="e.g. Insurance"
                  onChange={(e) => edit({ industry: e.target.value })}
                />
              </FormField>
              <FormField id="client-segment" label="Segment">
                <Input
                  id="client-segment"
                  value={draft.segment}
                  placeholder="e.g. Enterprise, SME"
                  onChange={(e) => edit({ segment: e.target.value })}
                />
              </FormField>
              <FormField
                id="client-department"
                label="Department"
                hint="The department that brought in this client"
              >
                <Select
                  value={draft.department_id || "none"}
                  onValueChange={(v) => edit({ department_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger id="client-department">
                    <SelectValue placeholder="No department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No department</SelectItem>
                    {departmentOptions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="client-manager" label="Account manager">
                <Select
                  value={draft.account_manager_id || "none"}
                  onValueChange={(v) => edit({ account_manager_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger id="client-manager">
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
              </FormField>
              <FormField id="client-code" label="Client code" hint="Your internal code, if any">
                <Input
                  id="client-code"
                  value={draft.code}
                  placeholder="e.g. CL-012"
                  onChange={(e) => edit({ code: e.target.value })}
                />
              </FormField>
              <div className="flex items-center gap-2 sm:pt-6">
                <Switch
                  id="client-active"
                  checked={draft.is_active}
                  onCheckedChange={(v) => edit({ is_active: v })}
                />
                <Label htmlFor="client-active">Active client</Label>
              </div>
            </div>
          )}
        </div>

        {errors.form && (
          <p role="alert" className="text-sm text-destructive">
            {errors.form}
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {client ? "Save client" : "Create client"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
