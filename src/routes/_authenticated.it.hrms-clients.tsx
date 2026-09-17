import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import { Armchair, Gauge, Loader2, Pencil, Plus, Save, Trash2, Users } from "lucide-react";
import {
  useHrmsLicenses,
  useSaveHrmsLicense,
  useDeleteHrmsLicense,
  HRMS_LICENSE_TIER_LABELS,
  HRMS_LICENSE_STATUS_LABELS,
  HRMS_LICENSE_STATUS_STYLES,
  type HrmsLicenseRow,
  type HrmsLicenseTier,
  type HrmsLicenseStatus,
} from "@/features/it/use-hrms-licenses";
import { useClients } from "@/features/finance/use-finance-data";
import { getRenewalInfo } from "@/features/clients/use-clients-contracts";
import { PageHeader } from "@/components/app-shell";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { formatDate } from "@/lib/format-date";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export const Route = createFileRoute("/_authenticated/it/hrms-clients")({
  head: () => ({ meta: [{ title: "HRMS Clients — AIMS" }] }),
  component: HrmsClients,
});

function HrmsClients() {
  const { isAdminOrCeo, hasRole } = useAuth();
  const canManage = isAdminOrCeo || hasRole("it");
  const licensesQ = useHrmsLicenses();
  const deleteLicense = useDeleteHrmsLicense();
  const [editing, setEditing] = useState<HrmsLicenseRow | "new" | null>(null);
  const licenses = useMemo(() => licensesQ.data ?? [], [licensesQ.data]);

  // Cancelled licenses don't use seats, so they're left out of the totals.
  const totals = useMemo(() => {
    const live = licenses.filter((l) => l.status !== "cancelled");
    const withSeats = live.filter((l) => l.licensedSeats != null);
    const seats = withSeats.reduce((sum, l) => sum + (l.licensedSeats ?? 0), 0);
    const usersOnSeats = withSeats.reduce((sum, l) => sum + (l.activeUsers ?? 0), 0);
    return {
      users: live.reduce((sum, l) => sum + (l.activeUsers ?? 0), 0),
      seats,
      inUse: seats > 0 ? Math.round((usersOnSeats / seats) * 100) : null,
    };
  }, [licenses]);

  const handleDelete = async (l: HrmsLicenseRow) => {
    const ok = await confirmDialog({
      title: `Delete the HRMS license for "${l.client.name}"?`,
      description: `${l.client.name} will no longer be listed as an HRMS client. The client itself is not deleted. This can't be undone.`,
      confirmLabel: "Delete license",
      destructive: true,
    });
    if (!ok) return;
    deleteLicense.mutate(l.id, {
      onSuccess: () => toast.success(`License for ${l.client.name} deleted`),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't delete license"),
    });
  };

  const addButton = (
    <Button size="sm" onClick={() => setEditing("new")}>
      <Plus className="h-4 w-4 mr-1" /> New license
    </Button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="HRMS Clients"
        description="Companies licensing Amsol's HRMS software — their tier, seats in use and when they renew."
        actions={canManage ? addButton : undefined}
      />
      {!canManage && <ViewOnlyBanner area="HRMS Clients" />}

      {licenses.length > 0 && (
        <div className="space-y-1">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TotalCard icon={Users} label="Active users" value={totals.users.toLocaleString()} />
            <TotalCard
              icon={Armchair}
              label="Licensed seats"
              value={totals.seats.toLocaleString()}
            />
            <TotalCard
              icon={Gauge}
              label="Seats in use"
              value={
                totals.inUse != null
                  ? `${totals.inUse}%${totals.inUse > 100 ? " (over)" : ""}`
                  : "—"
              }
              warn={totals.inUse != null && totals.inUse > 100}
            />
          </div>
          <p className="text-xs text-muted-foreground">Not counting cancelled licenses.</p>
        </div>
      )}

      {licensesQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : licensesQ.isError ? (
        <LoadError
          what="HRMS licenses"
          error={licensesQ.error}
          onRetry={() => licensesQ.refetch()}
        />
      ) : licenses.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <span>No HRMS licenses yet</span>
          {canManage && addButton}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active users</TableHead>
                  <TableHead>Renewal</TableHead>
                  {canManage && (
                    <TableHead className="w-20">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {licenses.map((l) => {
                  const renewal = getRenewalInfo(l.renewalDate ? l.renewalDate.slice(0, 10) : null);
                  return (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="font-medium">{l.client.name}</div>
                        {l.notes && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {l.notes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{HRMS_LICENSE_TIER_LABELS[l.tier]}</TableCell>
                      <TableCell>
                        <Badge className={HRMS_LICENSE_STATUS_STYLES[l.status]} variant="secondary">
                          {HRMS_LICENSE_STATUS_LABELS[l.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <SeatUsage activeUsers={l.activeUsers} licensedSeats={l.licensedSeats} />
                      </TableCell>
                      <TableCell>
                        <Badge className={renewal.className} variant="secondary">
                          {renewal.label}
                        </Badge>
                        {l.renewalDate && (
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {formatDate(l.renewalDate.slice(0, 10))}
                          </div>
                        )}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setEditing(l)}
                              aria-label={`Edit license for ${l.client.name}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-muted-foreground hover:text-destructive"
                              aria-label={`Delete license for ${l.client.name}`}
                              disabled={deleteLicense.isPending}
                              onClick={() => handleDelete(l)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <EditLicenseDialog value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function TotalCard({
  icon: Icon,
  label,
  value,
  warn,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
      </div>
      <div className={cn("mt-1 text-xl font-semibold tabular-nums", warn && "text-warning")}>
        {value}
      </div>
    </div>
  );
}

// "180 of 200 seats", flagged when a client uses more seats than they pay for.
function SeatUsage({
  activeUsers,
  licensedSeats,
}: {
  activeUsers: number | null;
  licensedSeats: number | null;
}) {
  if (licensedSeats == null) return <>{activeUsers ?? "—"}</>;
  const over = activeUsers != null && activeUsers > licensedSeats;
  return (
    <span className="tabular-nums">
      <span className={cn(over && "font-semibold text-destructive")}>{activeUsers ?? "—"}</span> of{" "}
      {licensedSeats.toLocaleString()} seats
      {over && (
        <span className="block text-xs text-destructive">
          {activeUsers - licensedSeats} over the license
        </span>
      )}
    </span>
  );
}

function EditLicenseDialog({
  value,
  onClose,
}: {
  value: HrmsLicenseRow | "new" | null;
  onClose: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const { guardClose } = useUnsavedChanges(dirty);
  const close = () => {
    setDirty(false);
    onClose();
  };
  return (
    <Dialog open={!!value} onOpenChange={(open) => !open && guardClose(close)}>
      <DialogContent>
        {value && (
          <EditLicenseForm
            value={value === "new" ? null : value}
            onDirtyChange={setDirty}
            onCancel={() => guardClose(close)}
            onDone={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type LicenseErrors = Partial<Record<"clientId" | "activeUsers" | "licensedSeats", string>>;

const wholeNumberError = (raw: string) => {
  if (!raw.trim()) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? undefined : "Enter a whole number, 0 or more";
};

function EditLicenseForm({
  value,
  onDirtyChange,
  onCancel,
  onDone,
}: {
  value: HrmsLicenseRow | null;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const save = useSaveHrmsLicense();
  const clientsQ = useClients();
  const initial = {
    clientId: value?.clientId ?? "",
    tier: value?.tier ?? ("starter" as HrmsLicenseTier),
    status: value?.status ?? ("trial" as HrmsLicenseStatus),
    activeUsers: value?.activeUsers?.toString() ?? "",
    licensedSeats: value?.licensedSeats?.toString() ?? "",
    renewalDate: value?.renewalDate?.slice(0, 10) ?? "",
    notes: value?.notes ?? "",
  };
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<LicenseErrors>({});

  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some(
    (k) => initial[k] !== draft[k],
  );
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const edit = (patch: Partial<typeof initial>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as keyof LicenseErrors];
      return next;
    });
  };

  const submit = () => {
    const found: LicenseErrors = {
      clientId: !value && !draft.clientId ? "Choose the client" : undefined,
      activeUsers: wholeNumberError(draft.activeUsers),
      licensedSeats: wholeNumberError(draft.licensedSeats),
    };
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    save.mutate(
      {
        id: value?.id,
        clientId: value ? undefined : draft.clientId,
        tier: draft.tier,
        status: draft.status,
        activeUsers: draft.activeUsers ? Number(draft.activeUsers) : undefined,
        licensedSeats: draft.licensedSeats.trim() ? Number(draft.licensedSeats) : null,
        renewalDate: draft.renewalDate || undefined,
        notes: draft.notes || undefined,
      },
      {
        onSuccess: () => {
          const name =
            value?.client.name ?? clientsQ.data?.find((c) => c.id === draft.clientId)?.name;
          toast.success(
            value
              ? `License for ${name} updated`
              : `HRMS license added${name ? ` for ${name}` : ""}`,
          );
          onDone();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save license"),
      },
    );
  };

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {value ? `Edit HRMS license for ${value.client.name}` : "New HRMS license"}
        </DialogTitle>
        <DialogDescription>Each client has one HRMS license.</DialogDescription>
      </DialogHeader>
      <RequiredNote />
      <div className="space-y-3">
        {!value && (
          <FormField
            id="hrms-client"
            label="Client"
            required
            error={
              errors.clientId ??
              (clientsQ.isError ? "Couldn't load clients. Close and try again." : undefined)
            }
            hint={
              clientsQ.isSuccess && (clientsQ.data ?? []).length === 0
                ? "No clients yet. Add the client in Clients first."
                : undefined
            }
          >
            <Select value={draft.clientId} onValueChange={(v) => edit({ clientId: v })}>
              <SelectTrigger
                id="hrms-client"
                aria-invalid={!!errors.clientId}
                aria-describedby={errors.clientId ? "hrms-client-error" : undefined}
              >
                <SelectValue
                  placeholder={clientsQ.isLoading ? "Loading clients…" : "Select a client"}
                />
              </SelectTrigger>
              <SelectContent>
                {(clientsQ.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField id="hrms-tier" label="Tier" required>
            <Select value={draft.tier} onValueChange={(v) => edit({ tier: v as HrmsLicenseTier })}>
              <SelectTrigger id="hrms-tier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(HRMS_LICENSE_TIER_LABELS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="hrms-status" label="Status" required>
            <Select
              value={draft.status}
              onValueChange={(v) => edit({ status: v as HrmsLicenseStatus })}
            >
              <SelectTrigger id="hrms-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(HRMS_LICENSE_STATUS_LABELS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            id="hrms-active-users"
            label="Active users (optional)"
            hint="People using the HRMS now"
            error={errors.activeUsers}
          >
            <Input
              id="hrms-active-users"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={draft.activeUsers}
              onChange={(e) => edit({ activeUsers: e.target.value })}
              aria-invalid={!!errors.activeUsers}
              aria-describedby={errors.activeUsers ? "hrms-active-users-error" : undefined}
            />
          </FormField>
          <FormField
            id="hrms-licensed-seats"
            label="Licensed seats (optional)"
            hint="Seats the client pays for"
            error={errors.licensedSeats}
          >
            <Input
              id="hrms-licensed-seats"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={draft.licensedSeats}
              onChange={(e) => edit({ licensedSeats: e.target.value })}
              aria-invalid={!!errors.licensedSeats}
              aria-describedby={errors.licensedSeats ? "hrms-licensed-seats-error" : undefined}
            />
          </FormField>
        </div>
        <FormField id="hrms-renewal" label="Renewal date (optional)">
          <Input
            id="hrms-renewal"
            type="date"
            value={draft.renewalDate}
            onChange={(e) => edit({ renewalDate: e.target.value })}
          />
        </FormField>
        <FormField id="hrms-notes" label="Notes (optional)">
          <Textarea
            id="hrms-notes"
            value={draft.notes}
            onChange={(e) => edit({ notes: e.target.value })}
            rows={3}
          />
        </FormField>
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {value ? "Save license" : "Add license"}
        </Button>
      </DialogFooter>
    </form>
  );
}
