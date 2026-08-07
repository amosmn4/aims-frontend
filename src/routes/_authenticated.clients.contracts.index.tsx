import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import { useClients, useServiceLines } from "@/features/finance/use-finance-data";
import {
  useContracts,
  useSaveContract,
  useDeleteContract,
  useDepartments,
  useProfilesLite,
  getRenewalInfo,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_STYLES,
  BILLING_LABELS,
  type ContractStatus,
  type BillingFrequency,
} from "@/features/clients/use-clients-contracts";
import { formatCurrency } from "@/features/finance/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/_authenticated/clients/contracts/")({
  component: ContractsList,
});

const STATUSES: ContractStatus[] = ["draft", "active", "on_hold", "expired", "terminated"];
const FREQS: BillingFrequency[] = ["one_off", "monthly", "quarterly", "annual"];

type Draft = {
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
const empty = (): Draft => ({
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

function ContractsList() {
  const clientsQ = useClients();
  const deptsQ = useDepartments();
  const profilesQ = useProfilesLite();
  const linesQ = useServiceLines();
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const contractsQ = useContracts({ departmentId: deptFilter === "all" ? null : deptFilter });
  const save = useSaveContract();
  const del = useDeleteContract();
  const [draft, setDraft] = useState<Draft | null>(null);

  const clientMap = useMemo(
    () => new Map((clientsQ.data ?? []).map((c) => [c.id, c])),
    [clientsQ.data],
  );
  const deptMap = useMemo(
    () => new Map((deptsQ.data ?? []).map((d) => [d.id, d.name])),
    [deptsQ.data],
  );
  const profileMap = useMemo(
    () => new Map((profilesQ.data ?? []).map((p) => [p.id, p.full_name ?? p.email])),
    [profilesQ.data],
  );
  const lineMap = useMemo(
    () => new Map((linesQ.data ?? []).map((l) => [l.id, l.name])),
    [linesQ.data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (contractsQ.data ?? []).filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (q) {
        const client = clientMap.get(c.client_id)?.name ?? "";
        if (
          !c.title.toLowerCase().includes(q) &&
          !(c.contract_number ?? "").toLowerCase().includes(q) &&
          !client.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [contractsQ.data, statusFilter, search, clientMap]);

  const totals = useMemo(() => {
    let total = 0,
      active = 0,
      activeVal = 0;
    for (const c of filtered) {
      total += Number(c.value);
      if (c.status === "active") {
        active++;
        activeVal += Number(c.value);
      }
    }
    return { count: filtered.length, total, active, activeVal };
  }, [filtered]);

  const submit = async () => {
    if (!draft) return;
    if (!draft.title.trim() || !draft.client_id || !draft.start_date) {
      toast.error("Title, client and start date are required");
      return;
    }
    try {
      await save.mutateAsync({
        id: draft.id,
        title: draft.title.trim(),
        contract_number: draft.contract_number.trim() || null,
        client_id: draft.client_id,
        department_id: draft.department_id || null,
        service_line_id: draft.service_line_id || null,
        account_manager_id: draft.account_manager_id || null,
        status: draft.status,
        billing_frequency: draft.billing_frequency,
        start_date: draft.start_date,
        end_date: draft.end_date || null,
        value: Number(draft.value) || 0,
        currency: draft.currency || "USD",
        next_invoice_date: draft.next_invoice_date || null,
        auto_renew: draft.auto_renew,
        description: draft.description.trim() || null,
        notes: draft.notes.trim() || null,
      });
      toast.success(draft.id ? "Contract updated" : "Contract created");
      setDraft(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const remove = async (id: string, title: string) => {
    const ok = await confirmDialog({
      title: `Delete contract "${title}"?`,
      description: "Attached documents will also be removed.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(id);
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg border bg-card p-3">
          <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
            Contracts
          </div>
          <div className="text-base font-semibold tabular-nums">{totals.count}</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
            Active
          </div>
          <div className="text-base font-semibold tabular-nums">{totals.active}</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
            Total value
          </div>
          <div className="text-base font-semibold tabular-nums">{formatCurrency(totals.total)}</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
            Active value
          </div>
          <div className="text-base font-semibold tabular-nums">
            {formatCurrency(totals.activeVal)}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3 flex gap-2 flex-wrap items-center">
        <Input
          placeholder="Search title, number, client…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-9"
        />
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {(deptsQ.data ?? []).map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {CONTRACT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button size="sm" onClick={() => setDraft(empty())}>
          <Plus className="h-4 w-4 mr-1" /> New contract
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        {contractsQ.isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Number</th>
                  <th className="px-3 py-2 text-left font-medium">Title</th>
                  <th className="px-3 py-2 text-left font-medium">Client</th>
                  <th className="px-3 py-2 text-left font-medium">Department</th>
                  <th className="px-3 py-2 text-left font-medium">Service line</th>
                  <th className="px-3 py-2 text-left font-medium">Manager</th>
                  <th className="px-3 py-2 text-left font-medium">Billing</th>
                  <th className="px-3 py-2 text-right font-medium">Value</th>
                  <th className="px-3 py-2 text-left font-medium">Period</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-3 py-8 text-center text-muted-foreground text-xs"
                    >
                      No contracts match your filters.
                    </td>
                  </tr>
                )}
                {filtered.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-secondary/20">
                    <td className="px-3 py-2 font-mono text-xs">{c.contract_number ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Link
                        to="/clients/contracts/$id"
                        params={{ id: c.id }}
                        className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {c.title} <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                    <td className="px-3 py-2">{clientMap.get(c.client_id)?.name ?? "—"}</td>
                    <td className="px-3 py-2">
                      {c.department_id ? (deptMap.get(c.department_id) ?? "—") : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {c.service_line_id ? (lineMap.get(c.service_line_id) ?? "—") : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {c.account_manager_id ? (profileMap.get(c.account_manager_id) ?? "—") : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">{BILLING_LABELS[c.billing_frequency]}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(Number(c.value))}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      <div>
                        {c.start_date}
                        {c.end_date ? ` → ${c.end_date}` : ""}
                      </div>
                      {(() => {
                        const r = getRenewalInfo(c.end_date);
                        if (r.status === "ok" || r.status === "no_end") return null;
                        return (
                          <span
                            className={`mt-0.5 inline-flex items-center gap-1 text-[0.625rem] px-1.5 py-0.5 rounded ${r.className}`}
                          >
                            <AlertTriangle className="h-3 w-3" /> {r.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-[0.625rem] px-1.5 py-0.5 rounded ${CONTRACT_STATUS_STYLES[c.status]}`}
                      >
                        {CONTRACT_STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setDraft({
                            id: c.id,
                            title: c.title,
                            contract_number: c.contract_number ?? "",
                            client_id: c.client_id,
                            department_id: c.department_id ?? "",
                            service_line_id: c.service_line_id ?? "",
                            account_manager_id: c.account_manager_id ?? "",
                            status: c.status,
                            billing_frequency: c.billing_frequency,
                            start_date: c.start_date,
                            end_date: c.end_date ?? "",
                            value: String(c.value),
                            currency: c.currency,
                            next_invoice_date: c.next_invoice_date ?? "",
                            auto_renew: c.auto_renew,
                            description: c.description ?? "",
                            notes: c.notes ?? "",
                          })
                        }
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(c.id, c.title)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit contract" : "New contract"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Title *</Label>
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Contract number</Label>
                <Input
                  value={draft.contract_number}
                  onChange={(e) => setDraft({ ...draft, contract_number: e.target.value })}
                  placeholder="e.g. AMS-2026-001"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={draft.status}
                  onValueChange={(v) => setDraft({ ...draft, status: v as ContractStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
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
                  value={draft.client_id || undefined}
                  onValueChange={(v) => setDraft({ ...draft, client_id: v })}
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
                  value={draft.department_id || "none"}
                  onValueChange={(v) =>
                    setDraft({ ...draft, department_id: v === "none" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {(deptsQ.data ?? []).map((d) => (
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
                  value={draft.service_line_id || "none"}
                  onValueChange={(v) =>
                    setDraft({ ...draft, service_line_id: v === "none" ? "" : v })
                  }
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
                  value={draft.account_manager_id || "none"}
                  onValueChange={(v) =>
                    setDraft({ ...draft, account_manager_id: v === "none" ? "" : v })
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
                  value={draft.billing_frequency}
                  onValueChange={(v) =>
                    setDraft({ ...draft, billing_frequency: v as BillingFrequency })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQS.map((f) => (
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
                  value={draft.start_date}
                  onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>End date</Label>
                <Input
                  type="date"
                  value={draft.end_date}
                  onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Value</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.value}
                  onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                />
              </div>
              <div>
                <Label>Currency</Label>
                <Input
                  value={draft.currency}
                  onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <Label>Next invoice date</Label>
                <Input
                  type="date"
                  value={draft.next_invoice_date}
                  onChange={(e) => setDraft({ ...draft, next_invoice_date: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={draft.auto_renew}
                  onCheckedChange={(v) => setDraft({ ...draft, auto_renew: v })}
                />
                <Label>Auto-renew</Label>
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label>Internal notes</Label>
                <Textarea
                  rows={2}
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {draft?.id ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
