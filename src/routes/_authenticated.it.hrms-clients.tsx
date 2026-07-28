import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  const licenses = licensesQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">HRMS Clients</h1>
          <p className="text-xs text-muted-foreground">
            Companies licensing Amsol's HRMS software — tier, seats and renewal.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4 mr-1" /> New license
          </Button>
        )}
      </div>

      {licensesQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : licenses.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
          No HRMS licenses registered yet.
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Active users</TableHead>
                <TableHead>Renewal</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {licenses.map((l) => {
                const renewal = getRenewalInfo(l.renewalDate ? l.renewalDate.slice(0, 10) : null);
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="font-medium">{l.client.name}</div>
                      {l.notes && <div className="text-xs text-muted-foreground line-clamp-1">{l.notes}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{HRMS_LICENSE_TIER_LABELS[l.tier]}</TableCell>
                    <TableCell>
                      <Badge className={HRMS_LICENSE_STATUS_STYLES[l.status]} variant="secondary">
                        {HRMS_LICENSE_STATUS_LABELS[l.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.activeUsers ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={renewal.className} variant="secondary">
                        {renewal.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {canManage && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditing(l)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (!window.confirm(`Remove license for "${l.client.name}"?`)) return;
                              deleteLicense.mutate(l.id, {
                                onError: (err) =>
                                  toast.error(err instanceof Error ? err.message : "Failed to delete"),
                              });
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <EditLicenseDialog value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function EditLicenseDialog({
  value,
  onClose,
}: {
  value: HrmsLicenseRow | "new" | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!value} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {value && <EditLicenseForm value={value === "new" ? null : value} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function EditLicenseForm({ value, onDone }: { value: HrmsLicenseRow | null; onDone: () => void }) {
  const save = useSaveHrmsLicense();
  const clientsQ = useClients();
  const [clientId, setClientId] = useState(value?.clientId ?? "");
  const [tier, setTier] = useState<HrmsLicenseTier>(value?.tier ?? "starter");
  const [status, setStatus] = useState<HrmsLicenseStatus>(value?.status ?? "trial");
  const [activeUsers, setActiveUsers] = useState(value?.activeUsers?.toString() ?? "");
  const [renewalDate, setRenewalDate] = useState(value?.renewalDate?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(value?.notes ?? "");

  const submit = () => {
    if (!value && !clientId) {
      toast.error("Client is required");
      return;
    }
    save.mutate(
      {
        id: value?.id,
        clientId: value ? undefined : clientId,
        tier,
        status,
        activeUsers: activeUsers ? Number(activeUsers) : undefined,
        renewalDate: renewalDate || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success(value ? "Updated" : "License added");
          onDone();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{value ? "Edit license" : "New HRMS license"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        {!value && (
          <div>
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {(clientsQ.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tier</Label>
            <Select value={tier} onValueChange={(v) => setTier(v as HrmsLicenseTier)}>
              <SelectTrigger>
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
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as HrmsLicenseStatus)}>
              <SelectTrigger>
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
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Active users</Label>
            <Input
              type="number"
              min={0}
              value={activeUsers}
              onChange={(e) => setActiveUsers(e.target.value)}
            />
          </div>
          <div>
            <Label>Renewal date</Label>
            <Input type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </>
  );
}
