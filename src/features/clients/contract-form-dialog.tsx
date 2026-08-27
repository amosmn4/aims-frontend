import { useState } from "react";
import { toast } from "sonner";
import {
  useSaveContract,
  useDepartments,
  useProfilesLite,
  CONTRACT_STATUS_LABELS,
  BILLING_LABELS,
  type ContractStatus,
  type BillingFrequency,
} from "@/features/clients/use-clients-contracts";
import { useClients, useServiceLines } from "@/features/finance/use-finance-data";
import { useAuth, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
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

export const CONTRACT_STATUSES: ContractStatus[] = [
  "draft",
  "active",
  "on_hold",
  "expired",
  "terminated",
];
export const CONTRACT_FREQS: BillingFrequency[] = ["one_off", "monthly", "quarterly", "annual"];

export type ContractDraft = {
  id?: string;
  title: string;
  contract_number: string;
  client_id: string;
  department_id: string;
  service_line_id: string;
  account_manager_id: string;
  status: ContractStatus;
  billing_frequency: BillingFrequency;
  start_date: string;
  end_date: string;
  value: string;
  currency: string;
  next_invoice_date: string;
  auto_renew: boolean;
  description: string;
  notes: string;
};

export const emptyContractDraft = (): ContractDraft => ({
  title: "",
  contract_number: "",
  client_id: "",
  department_id: "",
  service_line_id: "",
  account_manager_id: "",
  status: "draft",
  billing_frequency: "one_off",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: "",
  value: "0",
  currency: "USD",
  next_invoice_date: "",
  auto_renew: false,
  description: "",
  notes: "",
});

// Shared New/Edit contract form — used from both the Contracts list page and a single
// contract's detail page, so the field set can't drift between the two entry points. Callers
// mount this conditionally (`{draft && <ContractFormDialog key={draft.id ?? "new"} .../>}`) —
// the key forces a fresh mount (and fresh useState) whenever a different record is opened,
// matching the conditional-mount dialog pattern used throughout this app.
export function ContractFormDialog({
  draft,
  onClose,
}: {
  draft: ContractDraft;
  onClose: () => void;
}) {
  const { isAdminOrCeo, hasRole } = useAuth();
  const clientsQ = useClients();
  const deptsQ = useDepartments();
  const linesQ = useServiceLines();
  const profilesQ = useProfilesLite();
  const save = useSaveContract();
  const [local, setLocal] = useState<ContractDraft>(draft);

  const eligibleDepartments = (deptsQ.data ?? []).filter(
    (d) => isAdminOrCeo || hasRole(d.code as AppRole),
  );

  const submit = async () => {
    if (!local.title.trim() || !local.client_id || !local.start_date) {
      toast.error("Title, client and start date are required");
      return;
    }
    try {
      await save.mutateAsync({
        id: local.id,
        title: local.title.trim(),
        contract_number: local.contract_number.trim() || null,
        client_id: local.client_id,
        department_id: local.department_id || null,
        service_line_id: local.service_line_id || null,
        account_manager_id: local.account_manager_id || null,
        status: local.status,
        billing_frequency: local.billing_frequency,
        start_date: local.start_date,
        end_date: local.end_date || null,
        value: Number(local.value) || 0,
        currency: local.currency || "USD",
        next_invoice_date: local.next_invoice_date || null,
        auto_renew: local.auto_renew,
        description: local.description.trim() || null,
        notes: local.notes.trim() || null,
      });
      toast.success(local.id ? "Contract updated" : "Contract created");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{local.id ? "Edit contract" : "New contract"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Title *</Label>
            <Input
              value={local.title}
              onChange={(e) => setLocal({ ...local, title: e.target.value })}
            />
          </div>
          <div>
            <Label>Contract number</Label>
            <Input
              value={local.contract_number}
              onChange={(e) => setLocal({ ...local, contract_number: e.target.value })}
              placeholder="e.g. AMS-2026-001"
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={local.status}
              onValueChange={(v) => setLocal({ ...local, status: v as ContractStatus })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTRACT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {CONTRACT_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Client *</Label>
            <Select
              value={local.client_id || undefined}
              onValueChange={(v) => setLocal({ ...local, client_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
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
          <div>
            <Label>Department</Label>
            <Select
              value={local.department_id || "none"}
              onValueChange={(v) => setLocal({ ...local, department_id: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {eligibleDepartments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Service line</Label>
            <Select
              value={local.service_line_id || "none"}
              onValueChange={(v) => setLocal({ ...local, service_line_id: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {(linesQ.data ?? []).map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Account manager</Label>
            <Select
              value={local.account_manager_id || "none"}
              onValueChange={(v) =>
                setLocal({ ...local, account_manager_id: v === "none" ? "" : v })
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
          <div>
            <Label>Billing frequency</Label>
            <Select
              value={local.billing_frequency}
              onValueChange={(v) =>
                setLocal({ ...local, billing_frequency: v as BillingFrequency })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTRACT_FREQS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {BILLING_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Start date *</Label>
            <Input
              type="date"
              value={local.start_date}
              onChange={(e) => setLocal({ ...local, start_date: e.target.value })}
            />
          </div>
          <div>
            <Label>End date</Label>
            <Input
              type="date"
              value={local.end_date}
              onChange={(e) => setLocal({ ...local, end_date: e.target.value })}
            />
          </div>
          <div>
            <Label>Value</Label>
            <Input
              type="number"
              step="0.01"
              value={local.value}
              onChange={(e) => setLocal({ ...local, value: e.target.value })}
            />
          </div>
          <div>
            <Label>Currency</Label>
            <Input
              value={local.currency}
              onChange={(e) => setLocal({ ...local, currency: e.target.value.toUpperCase() })}
            />
          </div>
          <div>
            <Label>Next invoice date</Label>
            <Input
              type="date"
              value={local.next_invoice_date}
              onChange={(e) => setLocal({ ...local, next_invoice_date: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch
              checked={local.auto_renew}
              onCheckedChange={(v) => setLocal({ ...local, auto_renew: v })}
            />
            <Label>Auto-renew</Label>
          </div>
          <div className="col-span-2">
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={local.description}
              onChange={(e) => setLocal({ ...local, description: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <Label>Internal notes</Label>
            <Textarea
              rows={2}
              value={local.notes}
              onChange={(e) => setLocal({ ...local, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {local.id ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
