import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Briefcase,
  Users,
  FileText,
} from "lucide-react";
import {
  useContracts,
  useDepartments,
  useProfilesLite,
  getRenewalInfo,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_STYLES,
  BILLING_LABELS,
} from "@/features/clients/use-clients-contracts";
import { useClients, useServiceLines } from "@/features/finance/use-finance-data";
import { formatCurrency } from "@/features/finance/finance";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/departments/$deptId")({
  component: DepartmentWorkspace,
});

function DepartmentWorkspace() {
  const { deptId } = Route.useParams();
  const deptsQ = useDepartments();
  const clientsQ = useClients();
  const linesQ = useServiceLines();
  const profilesQ = useProfilesLite();
  const contractsQ = useContracts({ departmentId: deptId });
  const [tab, setTab] = useState<"clients" | "contracts">("contracts");
  const [search, setSearch] = useState("");

  const dept = deptsQ.data?.find((d) => d.id === deptId);
  const clientMap = useMemo(
    () => new Map((clientsQ.data ?? []).map((c) => [c.id, c])),
    [clientsQ.data],
  );
  const lineMap = useMemo(
    () => new Map((linesQ.data ?? []).map((l) => [l.id, l.name])),
    [linesQ.data],
  );
  const profileMap = useMemo(
    () => new Map((profilesQ.data ?? []).map((p) => [p.id, p.full_name ?? p.email])),
    [profilesQ.data],
  );

  const contracts = useMemo(() => contractsQ.data ?? [], [contractsQ.data]);
  const filteredContracts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contracts;
    return contracts.filter((c) => {
      const cn = clientMap.get(c.client_id)?.name ?? "";
      return (
        c.title.toLowerCase().includes(q) ||
        (c.contract_number ?? "").toLowerCase().includes(q) ||
        cn.toLowerCase().includes(q)
      );
    });
  }, [contracts, search, clientMap]);

  // Clients in this department = clients that have at least one contract here
  const deptClients = useMemo(() => {
    const ids = new Set(contracts.map((c) => c.client_id));
    return (clientsQ.data ?? []).filter((c) => ids.has(c.id));
  }, [contracts, clientsQ.data]);
  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deptClients;
    return deptClients.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.code ?? "").toLowerCase().includes(q),
    );
  }, [deptClients, search]);

  // KPIs
  const kpi = useMemo(() => {
    let value = 0,
      active = 0,
      activeVal = 0,
      renewSoon = 0;
    for (const c of contracts) {
      value += Number(c.value);
      if (c.status === "active") {
        active++;
        activeVal += Number(c.value);
      }
      const r = getRenewalInfo(c.end_date);
      if (r.status === "critical" || r.status === "soon" || r.status === "expired") renewSoon++;
    }
    return {
      count: contracts.length,
      value,
      active,
      activeVal,
      renewSoon,
      clientCount: deptClients.length,
    };
  }, [contracts, deptClients.length]);

  if (deptsQ.isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!dept) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Department not found.{" "}
        <Link to="/departments" className="text-primary underline">
          Back to departments
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Link
        to="/departments"
        className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back to departments
      </Link>

      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" /> {dept.name} — Clients & Contracts
        </h1>
        <p className="text-xs text-muted-foreground">
          Scoped view of the central clients & contracts module for the {dept.name} department. Full
          CRUD is available from the{" "}
          <Link to="/clients" className="text-primary hover:underline">
            central module
          </Link>
          .
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Kpi label="Clients" value={String(kpi.clientCount)} />
        <Kpi label="Contracts" value={String(kpi.count)} />
        <Kpi label="Active" value={String(kpi.active)} />
        <Kpi label="Active value" value={formatCurrency(kpi.activeVal)} />
        <Kpi
          label="Renewal alerts"
          value={String(kpi.renewSoon)}
          tone={kpi.renewSoon > 0 ? "warn" : undefined}
        />
      </div>

      <div className="rounded-lg border bg-card p-3 flex gap-2 flex-wrap items-center">
        <div className="flex gap-1">
          <button
            onClick={() => setTab("contracts")}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded border ${tab === "contracts" ? "bg-primary text-primary-foreground border-primary" : "bg-card"}`}
          >
            <FileText className="h-3 w-3" /> Contracts ({contracts.length})
          </button>
          <button
            onClick={() => setTab("clients")}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded border ${tab === "clients" ? "bg-primary text-primary-foreground border-primary" : "bg-card"}`}
          >
            <Users className="h-3 w-3" /> Clients ({deptClients.length})
          </button>
        </div>
        <div className="flex-1" />
        <Input
          placeholder={tab === "clients" ? "Search clients…" : "Search contracts…"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-9"
        />
      </div>

      {contractsQ.isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : tab === "contracts" ? (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Number</th>
                  <th className="px-3 py-2 text-left font-medium">Title</th>
                  <th className="px-3 py-2 text-left font-medium">Client</th>
                  <th className="px-3 py-2 text-left font-medium">Service line</th>
                  <th className="px-3 py-2 text-left font-medium">Manager</th>
                  <th className="px-3 py-2 text-left font-medium">Billing</th>
                  <th className="px-3 py-2 text-right font-medium">Value</th>
                  <th className="px-3 py-2 text-left font-medium">Period</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredContracts.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground text-xs">
                      No contracts for this department yet.
                    </td>
                  </tr>
                )}
                {filteredContracts.map((c) => {
                  const r = getRenewalInfo(c.end_date);
                  return (
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
                        {r.status !== "ok" && r.status !== "no_end" && (
                          <span
                            className={`mt-0.5 inline-flex items-center gap-1 text-[0.625rem] px-1.5 py-0.5 rounded ${r.className}`}
                          >
                            <AlertTriangle className="h-3 w-3" /> {r.label}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-[0.625rem] px-1.5 py-0.5 rounded ${CONTRACT_STATUS_STYLES[c.status]}`}
                        >
                          {CONTRACT_STATUS_LABELS[c.status]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Code</th>
                  <th className="px-3 py-2 text-left font-medium">Industry</th>
                  <th className="px-3 py-2 text-left font-medium">Segment</th>
                  <th className="px-3 py-2 text-right font-medium">Contracts</th>
                  <th className="px-3 py-2 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground text-xs">
                      No clients tied to contracts in this department.
                    </td>
                  </tr>
                )}
                {filteredClients.map((c) => {
                  const rows = contracts.filter((x) => x.client_id === c.id);
                  const val = rows.reduce((s, x) => s + Number(x.value), 0);
                  const ind = (c as unknown as { industry?: string | null }).industry ?? "";
                  const seg = (c as unknown as { segment?: string | null }).segment ?? "";
                  return (
                    <tr key={c.id} className="border-t hover:bg-secondary/20">
                      <td className="px-3 py-2 font-medium">{c.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{c.code ?? "—"}</td>
                      <td className="px-3 py-2">{ind || "—"}</td>
                      <td className="px-3 py-2">{seg || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{rows.length}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(val)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className={`rounded-lg border bg-card p-3 ${tone === "warn" ? "border-warning/40" : ""}`}>
      <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`text-base font-semibold tabular-nums ${tone === "warn" ? "text-warning" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
