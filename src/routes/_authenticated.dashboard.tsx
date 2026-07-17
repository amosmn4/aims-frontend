import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useCallback } from "react";
import { z } from "zod";

import { useAuth } from "@/lib/auth";
import { RequireRole } from "@/components/require-role";
import { FunnelChart, type FunnelStage } from "@/components/funnel-chart";
import {
  useInvoices,
  usePayments,
  useClients,
  useServiceLines,
  paymentsByInvoice,
} from "@/features/finance/use-finance-data";
import { computeAging, formatCurrency, invoiceOutstanding } from "@/features/finance/finance";
import {
  useProjects,
  useTasks,
  PROJECT_STATUS_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLUMNS,
  type ProjectStatus,
} from "@/features/projects/use-projects";
import { useDepartments, useOffices } from "@/features/clients/use-clients-contracts";
import { useTenderPipelineSummary, TENDER_STAGE_LABELS } from "@/features/tender/use-tender";
import {
  useClientRequestPipelineSummary,
  useLostBreakdown,
  CLIENT_REQUEST_STAGE_LABELS,
} from "@/features/client-requests/use-client-requests";
import {
  DollarSign,
  TrendingUp,
  Users,
  Percent,
  Activity,
  FileWarning,
  AlertTriangle,
  Repeat,
  CheckCircle2,
  Briefcase,
  Loader2,
  ArrowRight,
  Bell,
  MapPin,
  User as UserIcon,
  Filter,
  Info,
  CheckCircle,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ComposedChart,
} from "recharts";

// Every field falls back to a default via .catch(), so the route's search input is
// optional (callers can navigate({ to: "/dashboard" }) with no search at all) while
// Route.useSearch() still returns a fully-populated DashSearch.
const dashSearchSchema = z.object({
  months: z
    .preprocess((v) => Number(v), z.union([z.literal(3), z.literal(6), z.literal(12)]))
    .catch(6),
  sl: z.string().catch("all"),
  dept: z.string().catch("all"),
  view: z.union([z.literal("revenue"), z.literal("projects")]).catch("revenue"),
});

type DashSearch = z.output<typeof dashSearchSchema>;

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "CEO Executive Dashboard — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: dashSearchSchema,
  component: () => (
    <RequireRole
      roles={[]}
      message="The CEO Executive Dashboard is restricted to the CEO and System Administrator."
    >
      <Dashboard />
    </RequireRole>
  ),
});

function KpiCell({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "positive" | "warning" | "danger";
}) {
  const toneCls =
    tone === "positive"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-destructive"
          : "text-primary";
  return (
    <div className="min-w-0 px-2.5 py-2 rounded-md bg-secondary/60 border border-border/40 flex flex-col justify-center">
      <div className="flex items-center gap-1">
        <Icon className={`h-3 w-3 shrink-0 ${toneCls}`} />
        <span className="text-[0.5625rem] uppercase tracking-wide text-muted-foreground font-medium truncate">
          {label}
        </span>
      </div>
      <div className={`mt-0.5 text-sm font-bold tabular-nums truncate ${toneCls}`}>{value}</div>
      {hint && <div className="text-[0.5625rem] text-muted-foreground truncate">{hint}</div>}
    </div>
  );
}

const DEPT_COLORS = ["#085599", "#F5821F", "#22c55e", "#eab308", "#a855f7", "#06b6d4"];

const DEPT_OPTIONS = [
  { value: "all", label: "All departments" },
  { value: "finance", label: "Finance" },
  { value: "hr", label: "HR" },
  { value: "it", label: "IT" },
  { value: "marketing_ops", label: "Marketing & Ops" },
  { value: "tender", label: "Tender" },
];

const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  "planning",
  "active",
  "on_hold",
  "completed",
  "cancelled",
];

const RANGE_OPTIONS = [
  { value: 3, label: "3 months" },
  { value: 6, label: "6 months" },
  { value: 12, label: "12 months" },
];

type View = DashSearch["view"];

function Dashboard() {
  const { profile, roles } = useAuth();

  // ---- filters (URL-persisted) ----
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const months = search.months;
  const serviceLineId = search.sl;
  const department = search.dept;
  const view = search.view;

  const departmentsQ = useDepartments();
  // The filter select's value is a department *code* (matches AppRole names, e.g. "finance"),
  // but every backend endpoint filters by department *id* — resolve one to the other here so
  // there's a single source of truth instead of repeating the lookup at each call site.
  const departmentFilter =
    department === "all" ? undefined : departmentsQ.data?.find((d) => d.code === department)?.id;

  const invoicesQ = useInvoices({ departmentId: departmentFilter });
  const paymentsQ = usePayments();
  const clientsQ = useClients();
  const slQ = useServiceLines();
  const projectsQ = useProjects({ departmentId: departmentFilter });
  const tasksQ = useTasks({ departmentId: departmentFilter });
  const officesQ = useOffices();
  const tenderPipelineQ = useTenderPipelineSummary({ departmentId: departmentFilter });
  const requestPipelineQ = useClientRequestPipelineSummary({ departmentId: departmentFilter });
  const requestLostBreakdownQ = useLostBreakdown({ departmentId: departmentFilter });

  const updateSearch = useCallback(
    (patch: Partial<DashSearch>) => {
      navigate({ search: (prev: DashSearch) => ({ ...prev, ...patch }), replace: true });
    },
    [navigate],
  );
  const setMonths = (m: number) =>
    updateSearch({ months: (m === 3 || m === 12 ? m : 6) as 3 | 6 | 12 });
  const setServiceLineId = (sl: string) => updateSearch({ sl });
  const setDepartment = (dept: string) => updateSearch({ dept });
  const setView = (v: View) => updateSearch({ view: v });

  const loading = invoicesQ.isLoading || paymentsQ.isLoading;

  const kpis = useMemo(() => {
    const invoicesAll = invoicesQ.data ?? [];
    const payments = paymentsQ.data ?? [];
    const clients = clientsQ.data ?? [];
    const serviceLines = slQ.data ?? [];
    const paidMap = paymentsByInvoice(payments);

    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    // Apply filters (service line, date range)
    const invoices = invoicesAll.filter((i) => {
      if (serviceLineId !== "all" && i.service_line_id !== serviceLineId) return false;
      if (new Date(i.issue_date) < rangeStart) return false;
      return true;
    });

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonth = invoices.filter(
      (i) => new Date(i.issue_date) >= monthStart && i.status !== "draft" && i.status !== "void",
    );
    const lastMonth = invoices.filter(
      (i) =>
        new Date(i.issue_date) >= lastMonthStart &&
        new Date(i.issue_date) < monthStart &&
        i.status !== "draft" &&
        i.status !== "void",
    );
    const monthRevenue = thisMonth.reduce((s, i) => s + Number(i.total), 0);
    const lastMonthRevenue = lastMonth.reduce((s, i) => s + Number(i.total), 0);
    const mom =
      lastMonthRevenue > 0
        ? ((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : monthRevenue > 0
          ? 100
          : 0;
    const mrr = thisMonth.filter((i) => i.is_recurring).reduce((s, i) => s + Number(i.total), 0);

    const outstanding = invoices.reduce(
      (s, i) => s + invoiceOutstanding(i, paidMap.get(i.id) ?? 0),
      0,
    );
    const aging = computeAging(invoices, paidMap);
    const overdue = aging.slice(1).reduce((s, b) => s + b.amount, 0);
    const critical = aging[4].amount;
    const overdueCount = aging.slice(1).reduce((s, b) => s + b.count, 0);

    const eligible = invoices.filter((i) => i.status !== "draft" && i.status !== "void");
    const totalRevenue = eligible.reduce((s, i) => s + Number(i.total), 0);
    const totalCost = eligible.reduce((s, i) => s + Number(i.direct_cost), 0);
    const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

    const pipeline = invoices
      .filter((i) => i.status === "draft")
      .reduce((s, i) => s + Number(i.total), 0);

    const monthly: {
      key: string;
      label: string;
      recurring: number;
      oneOff: number;
      target: number;
      cumulative: number;
    }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthly.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString("en", { month: "short" }),
        recurring: 0,
        oneOff: 0,
        target: 0,
        cumulative: 0,
      });
    }
    const idx = new Map(monthly.map((b, i) => [b.key, i]));
    for (const inv of eligible) {
      const d = new Date(inv.issue_date);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const i = idx.get(k);
      if (i === undefined) continue;
      if (inv.is_recurring) monthly[i].recurring += Number(inv.total);
      else monthly[i].oneOff += Number(inv.total);
    }
    const avg =
      monthly.reduce((s, m) => s + m.recurring + m.oneOff, 0) / Math.max(1, monthly.length);
    let running = 0;
    monthly.forEach((m) => {
      m.target = Math.round(avg * 1.1);
      running += m.recurring + m.oneOff;
      m.cumulative = running;
    });

    const slMap = new Map(serviceLines.map((s) => [s.id, s]));
    const byLine = new Map<string, { name: string; recurring: boolean; total: number }>();
    for (const inv of eligible) {
      if (!inv.service_line_id) continue;
      const sl = slMap.get(inv.service_line_id);
      if (!sl) continue;
      const cur = byLine.get(sl.id) ?? { name: sl.name, recurring: sl.is_recurring, total: 0 };
      cur.total += Number(inv.total);
      byLine.set(sl.id, cur);
    }
    const lines = Array.from(byLine.values()).sort((a, b) => b.total - a.total);

    return {
      monthRevenue,
      mom,
      mrr,
      outstanding,
      overdue,
      overdueCount,
      critical,
      grossMargin,
      pipeline,
      activeClients: clients.filter((c) => c.is_active).length,
      totalRevenue,
      monthly,
      aging,
      lines,
      serviceLines,
    };
  }, [invoicesQ.data, paymentsQ.data, clientsQ.data, slQ.data, months, serviceLineId]);

  const agingChart = kpis.aging.map((b) => ({ label: b.label, amount: b.amount, count: b.count }));
  const linesPie = kpis.lines.map((l) => ({ name: l.name, value: l.total }));

  // Real tender pipeline funnel — counts from the Tender module's own backend aggregation
  // (GET /tenders/pipeline-summary), not a fabricated shape derived from unrelated invoice data.
  const tenderSummary = tenderPipelineQ.data ?? [];
  const tenderTotal = tenderSummary.reduce((s, r) => s + r.count, 0);
  const tenderWon = tenderSummary.find((r) => r.stage === "won")?.count ?? 0;
  const tenderLost = tenderSummary.find((r) => r.stage === "lost")?.count ?? 0;
  const tenderWinRate = tenderWon + tenderLost > 0 ? tenderWon / (tenderWon + tenderLost) : undefined;
  const TENDER_FUNNEL_STAGE_ORDER = [
    "identified",
    "applying",
    "submitted",
    "evaluation",
    "won",
    "lost",
    "withdrawn",
  ] as const;
  const TENDER_FUNNEL_COLORS: Record<string, string> = {
    identified: "#8C8C8C",
    applying: "#085599",
    submitted: "#F5821F",
    evaluation: "#6B5490",
    won: "#2E9E4F",
    lost: "#D64545",
    withdrawn: "#94a3b8",
  };
  const tenderFunnel: FunnelStage[] = TENDER_FUNNEL_STAGE_ORDER.map((stage) => ({
    stage: TENDER_STAGE_LABELS[stage],
    value: tenderSummary.find((r) => r.stage === stage)?.count ?? 0,
    color: TENDER_FUNNEL_COLORS[stage],
  }));

  // Client Request pipeline funnel — from GET /client-requests/pipeline-summary, real backend
  // aggregation only (same discipline as the Tender funnel above).
  const requestSummary = requestPipelineQ.data ?? [];
  const requestTotal = requestSummary.reduce((s, r) => s + r.count, 0);
  const requestConverted = requestSummary.find((r) => r.stage === "won")?.count ?? 0;
  const requestLost = requestSummary.find((r) => r.stage === "lost")?.count ?? 0;
  const requestWithdrawn = requestSummary.find((r) => r.stage === "withdrawn")?.count ?? 0;
  const requestResolved = requestConverted + requestLost + requestWithdrawn;
  const requestConversionRate = requestResolved > 0 ? requestConverted / requestResolved : undefined;
  const REQUEST_FUNNEL_STAGE_ORDER = [
    "new",
    "assigned",
    "engaging",
    "proposal",
    "won",
    "lost",
    "withdrawn",
  ] as const;
  const REQUEST_FUNNEL_COLORS: Record<string, string> = {
    new: "#8C8C8C",
    assigned: "#085599",
    engaging: "#F5821F",
    proposal: "#6B5490",
    won: "#2E9E4F",
    lost: "#D64545",
    withdrawn: "#94a3b8",
  };
  const requestFunnel: FunnelStage[] = REQUEST_FUNNEL_STAGE_ORDER.map((stage) => ({
    stage: CLIENT_REQUEST_STAGE_LABELS[stage],
    value: requestSummary.find((r) => r.stage === stage)?.count ?? 0,
    color: REQUEST_FUNNEL_COLORS[stage],
  }));
  const requestLostBreakdown = requestLostBreakdownQ.data ?? [];
  const requestLostBreakdownTotal = requestLostBreakdown.reduce((s, r) => s + r.count, 0);

  // Company-wide task pipeline, real data across all projects/departments — the same
  // 4 fixed statuses every department kanban board uses.
  const allProjects = projectsQ.data ?? [];
  const allTasks = tasksQ.data ?? [];
  const TASK_FUNNEL_COLORS = ["#085599", "#063D70", "#ef4444", "#F5821F"];
  const taskFunnel: FunnelStage[] = TASK_STATUS_COLUMNS.map((status, i) => ({
    stage: TASK_STATUS_LABELS[status],
    value: allTasks.filter((t) => t.status === status).length,
    color: TASK_FUNNEL_COLORS[i],
  }));

  const projectStatusChart = PROJECT_STATUS_ORDER.map((status) => ({
    name: PROJECT_STATUS_LABELS[status],
    value: allProjects.filter((p) => p.status === status).length,
  })).filter((d) => d.value > 0);

  const projectsByDepartmentChart = Array.from(
    allProjects.reduce((map, p) => {
      map.set(p.department_name, (map.get(p.department_name) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  ).map(([name, count]) => ({ name, count }));

  const [selectedProjectIdForChart, setSelectedProjectIdForChart] = useState<string | null>(null);
  const chartProject =
    allProjects.find((p) => p.id === selectedProjectIdForChart) ?? allProjects[0] ?? null;
  const chartProjectTasks = chartProject
    ? TASK_STATUS_COLUMNS.map((status) => ({
        name: TASK_STATUS_LABELS[status],
        value: allTasks.filter((t) => t.project_id === chartProject.id && t.status === status)
          .length,
      })).filter((d) => d.value > 0)
    : [];

  // Executive insights derived from real data
  const insights: { type: "warn" | "info" | "positive" | "action"; text: string }[] = [];
  if (kpis.critical > 0)
    insights.push({
      type: "warn",
      text: `Debtor: 90+ days bucket ${formatCurrency(kpis.critical)} — recover this month.`,
    });
  if (kpis.overdueCount > 0)
    insights.push({
      type: "warn",
      text: `${kpis.overdueCount} invoice(s) overdue totalling ${formatCurrency(kpis.overdue)}.`,
    });
  if (kpis.mom >= 0)
    insights.push({ type: "positive", text: `Revenue trend: ${kpis.mom.toFixed(1)}% MoM growth.` });
  else
    insights.push({
      type: "warn",
      text: `Revenue declined ${Math.abs(kpis.mom).toFixed(1)}% MoM.`,
    });
  if (kpis.grossMargin < 30 && kpis.totalRevenue > 0)
    insights.push({
      type: "warn",
      text: `Gross margin ${kpis.grossMargin.toFixed(1)}% — below 30% target.`,
    });
  else if (kpis.totalRevenue > 0)
    insights.push({
      type: "positive",
      text: `Gross margin healthy at ${kpis.grossMargin.toFixed(1)}%.`,
    });
  const tenderSubmitted = tenderSummary.find((r) => r.stage === "submitted");
  if (tenderSubmitted && tenderSubmitted.count > 0) {
    insights.push({
      type: "info",
      text: `${tenderSubmitted.count} tender(s) submitted and awaiting outcome, worth ${formatCurrency(tenderSubmitted.total_value ?? 0)}.`,
    });
  }

  // Completion % per department, computed live from real Project/Task data — no fabricated
  // percentages. A department with no tasks yet reports "No data" rather than a made-up number.
  const deptStatus = (departmentsQ.data ?? []).map((d) => {
    const deptProjectIds = new Set(allProjects.filter((p) => p.department_id === d.id).map((p) => p.id));
    const deptTasks = allTasks.filter((t) => deptProjectIds.has(t.project_id));
    const total = deptTasks.length;
    const completed = deptTasks.filter((t) => t.status === "completed").length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    const status = total === 0 ? "No data" : progress >= 70 ? "On track" : progress >= 40 ? "At risk" : "Behind";
    return { name: d.name, progress, status, hasData: total > 0 };
  });

  const quarter = `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`;
  const office = officesQ.data?.find((o) => o.id === profile?.officeId)?.name ?? "—";
  const roleLabel = roles.includes("ceo")
    ? "CEO"
    : roles.includes("system_admin")
      ? "System Admin"
      : (roles[0] ?? "Staff");

  return (
    <div>
      {/* Executive banner strip */}
      <div className="rounded-lg bg-primary text-primary-foreground mb-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5 text-sm">
          <div className="flex items-center gap-2 font-semibold tracking-wide">
            <span>AIMS</span>
            <span className="opacity-40">|</span>
            <span>CEO Executive Dashboard</span>
          </div>
          <div className="ml-auto flex items-center gap-4 text-xs">
            <span className="hidden sm:inline font-medium">{quarter}</span>
            <span className="opacity-40 hidden sm:inline">|</span>
            <span className="hidden sm:flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {office}
            </span>
            <span className="opacity-40 hidden sm:inline">|</span>
            <button className="flex items-center gap-1 hover:opacity-80">
              <Bell className="h-3.5 w-3.5" />
              Alerts{" "}
              <span className="ml-1 px-1.5 rounded-full bg-accent text-accent-foreground text-[0.625rem] font-bold">
                {kpis.overdueCount + (kpis.critical > 0 ? 1 : 0)}
              </span>
            </button>
            <span className="opacity-40">|</span>
            <span className="flex items-center gap-1">
              <UserIcon className="h-3.5 w-3.5" />
              {profile?.fullName?.split(" ")[0] ?? profile?.email ?? "Profile"} · {roleLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[0.6875rem] text-muted-foreground font-medium">Filters:</span>
        <select
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          className="text-xs rounded border bg-background px-2 py-1"
        >
          {RANGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={serviceLineId}
          onChange={(e) => setServiceLineId(e.target.value)}
          className="text-xs rounded border bg-background px-2 py-1 max-w-[180px]"
        >
          <option value="all">All service lines</option>
          {(kpis.serviceLines ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="text-xs rounded border bg-background px-2 py-1"
        >
          {DEPT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="ml-auto inline-flex rounded-md border overflow-hidden">
          <button
            onClick={() => setView("revenue")}
            className={`px-3 py-1 text-[0.6875rem] ${view === "revenue" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-secondary"}`}
          >
            Revenue vs Target
          </button>
          <button
            onClick={() => setView("projects")}
            className={`px-3 py-1 text-[0.6875rem] ${view === "projects" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-secondary"}`}
          >
            Project analytics
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* 10 KPIs single row from md+ */}
          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-1.5">
            <KpiCell
              label="Revenue MTD"
              value={formatCurrency(kpis.monthRevenue)}
              hint={`${kpis.mom >= 0 ? "+" : ""}${kpis.mom.toFixed(1)}% MoM`}
              icon={DollarSign}
              tone={kpis.mom >= 0 ? "positive" : "warning"}
            />
            <KpiCell
              label="MRR"
              value={formatCurrency(kpis.mrr)}
              hint="Recurring"
              icon={Repeat}
              tone="positive"
            />
            <KpiCell
              label="Pipeline"
              value={formatCurrency(kpis.pipeline)}
              hint="Draft"
              icon={TrendingUp}
              tone="warning"
            />
            <KpiCell
              label="Clients"
              value={String(kpis.activeClients)}
              hint="Active"
              icon={Users}
            />
            <KpiCell
              label="Outstanding"
              value={formatCurrency(kpis.outstanding)}
              hint={`${kpis.overdueCount} overdue`}
              icon={FileWarning}
              tone={kpis.overdue > 0 ? "danger" : "default"}
            />
            <KpiCell
              label="90+ Debtors"
              value={formatCurrency(kpis.critical)}
              hint="Critical"
              icon={AlertTriangle}
              tone="danger"
            />
            <KpiCell
              label="Gross Margin"
              value={`${kpis.grossMargin.toFixed(1)}%`}
              icon={Percent}
              tone="positive"
            />
            <KpiCell
              label="Revenue (Range)"
              value={formatCurrency(kpis.totalRevenue)}
              icon={Activity}
            />
            <KpiCell label="HRMS Users" value="—" hint="Licenses" icon={Briefcase} />
            <KpiCell
              label="Alerts"
              value={String(kpis.overdueCount + (kpis.critical > 0 ? 1 : 0))}
              hint="Debtor + margin"
              icon={CheckCircle2}
              tone="warning"
            />
          </div>

          {/* Main visual row */}
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
            {view === "revenue" ? (
              <>
                {/* Trend line - large */}
                <div className="lg:col-span-6 rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <div className="text-xs font-semibold text-primary">
                        Revenue vs Target — Trend ({months} months)
                      </div>
                      <div className="text-[0.625rem] text-muted-foreground">
                        Actual (solid) vs Target (dashed)
                      </div>
                    </div>
                    <Link
                      to="/reports/departments/finance"
                      className="text-[0.625rem] text-primary hover:underline"
                    >
                      View report →
                    </Link>
                  </div>
                  <div className="h-56">
                    <ResponsiveContainer>
                      <ComposedChart
                        data={kpis.monthly}
                        margin={{ top: 5, right: 8, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="label" fontSize={10} />
                        <YAxis fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Line
                          type="monotone"
                          dataKey={(d) => d.recurring + d.oneOff}
                          name="Revenue"
                          stroke="#085599"
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="target"
                          name="Target"
                          stroke="#F5821F"
                          strokeWidth={2}
                          strokeDasharray="6 4"
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Tender Pipeline Funnel */}
                <div className="lg:col-span-3 rounded-lg border bg-card p-3 min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs font-semibold text-primary">Tender Pipeline Funnel</div>
                    <div className="flex items-center gap-2">
                      {tenderWinRate != null && (
                        <span className="text-[0.625rem] text-muted-foreground">
                          Win rate {(tenderWinRate * 100).toFixed(0)}%
                        </span>
                      )}
                      <Link to="/tender" className="text-[0.625rem] text-primary hover:underline">
                        View →
                      </Link>
                    </div>
                  </div>
                  {tenderTotal === 0 ? (
                    <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">
                      No tenders yet.
                    </div>
                  ) : (
                    <FunnelChart stages={tenderFunnel} formatValue={(v) => v.toLocaleString()} />
                  )}
                </div>

                {/* Gross Margin by product/service line */}
                <div className="lg:col-span-3 rounded-lg border bg-card p-3">
                  <div className="text-xs font-semibold text-primary mb-1">
                    Gross Margin by Product
                  </div>
                  <div className="text-[0.625rem] text-muted-foreground mb-1">
                    Revenue per service line
                  </div>
                  <div className="h-48">
                    {kpis.lines.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                        No revenue.
                      </div>
                    ) : (
                      <ResponsiveContainer>
                        <BarChart
                          data={kpis.lines.slice(0, 6).map((l) => ({
                            name: l.name.length > 8 ? l.name.slice(0, 8) : l.name,
                            total: l.total,
                          }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="name" fontSize={9} />
                          <YAxis fontSize={9} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Bar dataKey="total">
                            {kpis.lines.slice(0, 6).map((_, i) => (
                              <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Project analytics view */}
                <div className="lg:col-span-4 rounded-lg border bg-card p-3">
                  <div className="text-xs font-semibold text-primary mb-1">
                    Completion by department
                  </div>
                  <div className="text-[0.625rem] text-muted-foreground mb-1">
                    Rolling progress across active departments
                  </div>
                  <div className="h-56">
                    {deptStatus.every((d) => !d.hasData) ? (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                        No tasks recorded yet.
                      </div>
                    ) : (
                      <ResponsiveContainer>
                        <BarChart
                          data={deptStatus.map((d) => ({
                            name: d.name,
                            progress: d.progress,
                            gap: 100 - d.progress,
                          }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="name" fontSize={10} />
                          <YAxis fontSize={10} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                          <Bar dataKey="progress" stackId="a" fill="#085599" name="Progress %" />
                          <Bar dataKey="gap" stackId="a" fill="#e2e8f0" name="Remaining %" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-4 rounded-lg border bg-card p-3 min-w-0 overflow-hidden">
                  <div className="text-xs font-semibold text-primary mb-1">
                    Task Pipeline — all departments
                  </div>
                  <FunnelChart stages={taskFunnel} formatValue={(v) => `${v} tasks`} />
                </div>

                <div className="lg:col-span-4 rounded-lg border bg-card p-3">
                  <div className="text-xs font-semibold text-primary mb-1">
                    Project status (all projects)
                  </div>
                  <div className="text-[0.625rem] text-muted-foreground mb-1">
                    {allProjects.length} projects tracked
                  </div>
                  <div className="h-48">
                    {projectStatusChart.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                        No projects yet.
                      </div>
                    ) : (
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={projectStatusChart}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={40}
                            outerRadius={70}
                            paddingAngle={2}
                          >
                            {projectStatusChart.map((_, i) => (
                              <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 9 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Client Request pipeline row — cross-departmental lead intake, revenue view only */}
          {view === "revenue" && (
            <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-7 rounded-lg border bg-card p-3 min-w-0 overflow-hidden">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-semibold text-primary">Client Request Pipeline</div>
                  <div className="flex items-center gap-2">
                    {requestConversionRate != null && (
                      <span className="text-[0.625rem] text-muted-foreground">
                        Conversion rate {(requestConversionRate * 100).toFixed(0)}%
                      </span>
                    )}
                    <Link to="/requests" className="text-[0.625rem] text-primary hover:underline">
                      View →
                    </Link>
                  </div>
                </div>
                {requestTotal === 0 ? (
                  <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">
                    No client requests logged yet.
                  </div>
                ) : (
                  <FunnelChart stages={requestFunnel} formatValue={(v) => v.toLocaleString()} />
                )}
              </div>

              <div className="lg:col-span-5 rounded-lg border bg-card p-3">
                <div className="text-xs font-semibold text-primary mb-1">Where requests fail</div>
                <div className="text-[0.625rem] text-muted-foreground mb-1">
                  Stage reached before being marked lost or withdrawn
                </div>
                {requestLostBreakdownTotal === 0 ? (
                  <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">
                    No lost or withdrawn requests yet.
                  </div>
                ) : (
                  <ul className="space-y-1.5 mt-2">
                    {requestLostBreakdown
                      .slice()
                      .sort((a, b) => b.count - a.count)
                      .map((r) => {
                        const pct = (r.count / requestLostBreakdownTotal) * 100;
                        return (
                          <li key={r.stage} className="text-[0.6875rem]">
                            <div className="flex items-center justify-between mb-0.5">
                              <span>{CLIENT_REQUEST_STAGE_LABELS[r.stage]}</span>
                              <span className="text-muted-foreground tabular-nums">{r.count}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div
                                className="h-full bg-destructive/70 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Second row: aging/project detail + insights */}
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
            {view === "revenue" ? (
              /* Debtor aging */
              <div className="lg:col-span-6 rounded-lg border bg-card p-3">
                <div className="text-xs font-semibold text-primary">Debtor ageing</div>
                <div className="text-[0.625rem] text-muted-foreground mb-1">
                  {formatCurrency(kpis.aging.reduce((s, b) => s + b.amount, 0))} outstanding
                </div>
                <div className="h-44">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={agingChart}
                        dataKey="amount"
                        nameKey="label"
                        innerRadius={38}
                        outerRadius={65}
                      >
                        {agingChart.map((_, i) => (
                          <Cell
                            key={i}
                            fill={["#22c55e", "#085599", "#F5821F", "#eab308", "#ef4444"][i]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend wrapperStyle={{ fontSize: 9 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              /* By project — task breakdown for a selected project */
              <div className="lg:col-span-6 rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-semibold text-primary">Project progress</div>
                  {allProjects.length > 0 && (
                    <select
                      value={chartProject?.id ?? ""}
                      onChange={(e) => setSelectedProjectIdForChart(e.target.value)}
                      className="text-[0.625rem] rounded border bg-background px-1.5 py-0.5 max-w-32.5"
                    >
                      {allProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="h-44">
                  {chartProjectTasks.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                      {allProjects.length === 0
                        ? "No projects yet."
                        : "No tasks on this project yet."}
                    </div>
                  ) : (
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={chartProjectTasks}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={38}
                          outerRadius={65}
                        >
                          {chartProjectTasks.map((_, i) => (
                            <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 9 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}

            {/* Executive Decision Support */}
            <div className="lg:col-span-6 rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-primary">Executive Decision Support</div>
                <span className="text-[0.625rem] text-muted-foreground">Insights & Actions</span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {insights.slice(0, 6).map((it, i) => {
                  const Icon =
                    it.type === "warn"
                      ? AlertTriangle
                      : it.type === "positive"
                        ? CheckCircle
                        : it.type === "action"
                          ? Zap
                          : Info;
                  const cls =
                    it.type === "warn"
                      ? "text-destructive"
                      : it.type === "positive"
                        ? "text-success"
                        : it.type === "action"
                          ? "text-accent"
                          : "text-primary";
                  return (
                    <li key={i} className="flex items-start gap-2 text-[0.6875rem] leading-snug">
                      <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${cls}`} />
                      <span className="min-w-0">{it.text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* Third row: revenue/project detail + departments */}
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
            {view === "revenue" ? (
              <>
                <div className="lg:col-span-5 rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs font-semibold text-primary">
                      Revenue by service line
                    </div>
                    <Link
                      to="/finance/revenue"
                      className="text-[0.625rem] text-primary hover:underline"
                    >
                      Details →
                    </Link>
                  </div>
                  <div className="h-48">
                    {linesPie.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                        No revenue yet.
                      </div>
                    ) : (
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={linesPie}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={40}
                            outerRadius={70}
                            paddingAngle={2}
                          >
                            {linesPie.map((_, i) => (
                              <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-4 rounded-lg border bg-card p-3">
                  <div className="text-xs font-semibold text-primary">Cumulative revenue</div>
                  <div className="text-[0.625rem] text-muted-foreground mb-1">
                    Trailing {months} months
                  </div>
                  <div className="h-48">
                    <ResponsiveContainer>
                      <LineChart data={kpis.monthly}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="label" fontSize={10} />
                        <YAxis fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Line
                          type="monotone"
                          dataKey="cumulative"
                          stroke="#085599"
                          strokeWidth={2}
                          dot
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="lg:col-span-5 rounded-lg border bg-card p-3">
                  <div className="text-xs font-semibold text-primary mb-1">
                    Projects by department
                  </div>
                  <div className="h-48">
                    {projectsByDepartmentChart.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                        No projects yet.
                      </div>
                    ) : (
                      <ResponsiveContainer>
                        <BarChart data={projectsByDepartmentChart}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="name" fontSize={10} />
                          <YAxis fontSize={10} allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="count" name="Projects">
                            {projectsByDepartmentChart.map((_, i) => (
                              <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-4 rounded-lg border bg-card p-3">
                  <div className="text-xs font-semibold text-primary mb-1">Projects by status</div>
                  <div className="h-48">
                    {projectStatusChart.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                        No projects yet.
                      </div>
                    ) : (
                      <ResponsiveContainer>
                        <BarChart data={projectStatusChart} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis type="number" fontSize={10} allowDecimals={false} />
                          <YAxis type="category" dataKey="name" fontSize={10} width={70} />
                          <Tooltip />
                          <Bar dataKey="value" name="Projects">
                            {projectStatusChart.map((_, i) => (
                              <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="lg:col-span-3 rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-primary">Departments</div>
                <Link to="/departments" className="text-[0.625rem] text-primary hover:underline">
                  All →
                </Link>
              </div>
              <div className="space-y-2">
                {deptStatus.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">No departments yet.</div>
                ) : (
                  deptStatus.map((d) => (
                    <div key={d.name}>
                      <div className="flex justify-between text-[0.6875rem] mb-0.5">
                        <span className="font-medium">{d.name}</span>
                        <span
                          className={
                            !d.hasData
                              ? "text-muted-foreground"
                              : d.status === "On track"
                                ? "text-success"
                                : d.status === "At risk"
                                  ? "text-warning"
                                  : "text-destructive"
                          }
                        >
                          {d.hasData ? `${d.progress}%` : "No data"}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={
                            !d.hasData
                              ? "h-full bg-muted-foreground/30"
                              : d.progress >= 70
                                ? "h-full bg-success"
                                : d.progress >= 40
                                  ? "h-full bg-warning"
                                  : "h-full bg-destructive"
                          }
                          style={{ width: d.hasData ? `${d.progress}%` : "100%" }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Quick nav row */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/reports/departments/finance"
              className="px-3 py-1.5 rounded border bg-card hover:bg-secondary flex items-center gap-1 text-xs"
            >
              Financial report <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              to="/projects"
              className="px-3 py-1.5 rounded border bg-card hover:bg-secondary flex items-center gap-1 text-xs"
            >
              Projects <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              to="/finance/invoices"
              className="px-3 py-1.5 rounded border bg-card hover:bg-secondary flex items-center gap-1 text-xs"
            >
              Invoices <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
