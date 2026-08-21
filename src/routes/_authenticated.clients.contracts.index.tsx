import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import {
  useContracts,
  useContractsSummary,
  useDeleteContract,
  useDepartments,
  useProfilesLite,
  getRenewalInfo,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_STYLES,
  BILLING_LABELS,
  type ContractStatus,
} from "@/features/clients/use-clients-contracts";
import { useClients, useServiceLines } from "@/features/finance/use-finance-data";
import {
  ContractFormDialog,
  emptyContractDraft,
  CONTRACT_STATUSES as STATUSES,
  type ContractDraft,
} from "@/features/clients/contract-form-dialog";
import { formatCurrency } from "@/features/finance/finance";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/pagination-bar";
import { useAuth, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// Mirrors the backend's exact @Roles() list on POST/PATCH/DELETE /contracts.
const CONTRACT_WRITE_ROLES: AppRole[] = ["finance", "hr", "it", "marketing", "tender"];

function ContractsList() {
  const { isAdminOrCeo, hasRole } = useAuth();
  const clientsQ = useClients();
  const deptsQ = useDepartments();
  const profilesQ = useProfilesLite();
  const linesQ = useServiceLines();
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const { page, pageSize, setPage, setPageSize } = usePagination(25);

  const filters = {
    departmentId: deptFilter === "all" ? null : deptFilter,
    status: statusFilter === "all" ? undefined : (statusFilter as ContractStatus),
    q: search.trim() || undefined,
  };
  const contractsQ = useContracts(filters, { page, pageSize });
  const summaryQ = useContractsSummary(filters);
  const del = useDeleteContract();
  const [draft, setDraft] = useState<ContractDraft | null>(null);

  const clientMap = useMemo(
    () => new Map((clientsQ.data ?? []).map((c) => [c.id, c])),
    [clientsQ.data],
  );
  const deptMap = useMemo(
    () => new Map((deptsQ.data ?? []).map((d) => [d.id, d.name])),
    [deptsQ.data],
  );
  const deptCodeMap = useMemo(
    () => new Map((deptsQ.data ?? []).map((d) => [d.id, d.code])),
    [deptsQ.data],
  );
  // Mirrors the backend's assertContractDeptAccess exactly: a department-less contract is
  // admin/CEO-only to manage; a department-scoped one needs that department's own role.
  const canManageContract = (departmentId: string | null) => {
    if (!departmentId) return isAdminOrCeo;
    const code = deptCodeMap.get(departmentId);
    return isAdminOrCeo || (!!code && hasRole(code as AppRole));
  };
  const canCreate = isAdminOrCeo || hasRole(CONTRACT_WRITE_ROLES);
  const profileMap = useMemo(
    () => new Map((profilesQ.data ?? []).map((p) => [p.id, p.full_name ?? p.email])),
    [profilesQ.data],
  );
  const lineMap = useMemo(
    () => new Map((linesQ.data ?? []).map((l) => [l.id, l.name])),
    [linesQ.data],
  );

  const contractsResult = contractsQ.data;
  const filtered = contractsResult
    ? Array.isArray(contractsResult)
      ? contractsResult
      : contractsResult.data
    : [];
  const contractsTotal =
    contractsResult && !Array.isArray(contractsResult) ? contractsResult.total : filtered.length;

  const totals = {
    count: summaryQ.data?.count ?? 0,
    total: summaryQ.data?.value ?? 0,
    active: summaryQ.data?.active_count ?? 0,
    activeVal: summaryQ.data?.active_value ?? 0,
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
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs h-9"
        />
        <Select
          value={deptFilter}
          onValueChange={(v) => {
            setDeptFilter(v);
            setPage(1);
          }}
        >
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
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
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
        {canCreate && (
          <Button size="sm" onClick={() => setDraft(emptyContractDraft())}>
            <Plus className="h-4 w-4 mr-1" /> New contract
          </Button>
        )}
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
                      {canManageContract(c.department_id) && (
                        <>
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
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar
              page={page}
              pageSize={pageSize}
              total={contractsTotal}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      {draft && (
        <ContractFormDialog key={draft.id ?? "new"} draft={draft} onClose={() => setDraft(null)} />
      )}
    </div>
  );
}
