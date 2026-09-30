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
import {
  computeAging,
  formatCurrency,
  invoiceOutstanding,
  invoiceRevenue,
  isBilledInvoice,
  monthlyRecurringRevenue,
} from "@/features/finance/finance";
import {
  useProjects,
  useTasks,
  PROJECT_STATUS_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLUMNS,
  isTaskOverdue,
  type ProjectStatus,
} from "@/features/projects/use-projects";
import { useContracts, useDepartments, useOffices } from "@/features/clients/use-clients-contracts";
import { useTenderPipelineSummary, TENDER_STAGE_LABELS } from "@/features/tender/use-tender";
import { useHrmsLicenses } from "@/features/it/use-hrms-licenses";
import { useReportsInbox } from "@/features/reports/use-department-reports";
import { useMyWork } from "@/features/my-work/use-my-work";
import { useCompanySettings } from "@/features/settings/use-company-settings";
import { LoadError } from "@/components/load-error";
import { formatDate } from "@/lib/format-date";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  FolderArchive,
  CalendarClock,
  FileText,
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
    <RequireRole roles={[]} message="The Executive Dashboard is restricted to the CEO.">
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
  onClick,
  to,
  ariaLabel,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "positive" | "warning" | "danger";
  onClick?: () => void;
  to?: "/clients" | "/finance/debtors";
  ariaLabel?: string;
}) {
  const toneCls =
    tone === "positive"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-destructive"
          : "text-primary";
  const body = (
    <>
      <div className="flex items-start gap-1.5">
        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${toneCls}`} />
        <span className="text-xs leading-tight text-muted-foreground font-medium">{label}</span>
      </div>
      <div className={`mt-1 text-base font-bold tabular-nums truncate ${toneCls}`}>{value}</div>
      {hint && <div className="text-xs leading-tight text-muted-foreground">{hint}</div>}
    </>
  );
  const cls =
    "min-w-0 px-3 py-2 rounded-md bg-secondary/60 border border-border/40 flex flex-col justify-start";
  const interactiveCls =
    "text-left hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  if (to) {
    return (
      <Link to={to} aria-label={ariaLabel} className={`${cls} ${interactiveCls}`}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={`${cls} ${interactiveCls}`}
      >
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

type DashboardAlert = {
  key: string;
  title: string;
  detail: string;
  to: "/finance/invoices" | "/finance/debtors" | "/reports/departments/finance" | "/reports";
  search?: { status: "overdue" };
};

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

function AlertsSheet({
  open,
  onOpenChange,
  alerts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alerts: DashboardAlert[];
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Alerts</SheetTitle>
          <SheetDescription className="sr-only">
            Things that need your attention, with a link to where each is handled.
          </SheetDescription>
        </SheetHeader>
        {alerts.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No alerts right now.</p>
        ) : (
          <ul className="mt-4 divide-y rounded-lg border">
            {alerts.map((a) => (
              <li key={a.key} className="flex items-center gap-3 px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">{a.detail}</div>
                </div>
                <Link
                  to={a.to}
                  search={a.search}
                  onClick={() => onOpenChange(false)}
                  aria-label={`Open ${a.title.toLowerCase()}`}
                  className="shrink-0 inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium text-primary hover:bg-secondary"
                >
                  Open <ArrowRight className="h-3 w-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}

const DEPT_COLORS = ["#085599", "#F5821F", "#22c55e", "#eab308", "#a855f7", "#06b6d4"];

const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  "planning",
  "active",
  "on_hold",
  "completed",
  "cancelled",
];

const REPORTING_DEPARTMENTS = new Set(["finance", "hr", "it", "marketing", "tender", "operations"]);

const RANGE_OPTIONS = [
  { value: 3, label: "3 months" },
  { value: 6, label: "6 months" },
  { value: 12, label: "12 months" },
];

type View = DashSearch["view"];

function Dashboard() {
  const { profile, roles, isAdminOrCeo } = useAuth();

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
  const deptValue = (d: { id: string; code: string | null }) => d.code ?? d.id;
  const departmentOptions = [
    { value: "all", label: "All departments" },
    ...(departmentsQ.data ?? []).map((d) => ({ value: deptValue(d), label: d.name })),
  ];
  const selectedDepartment =
    department === "all" ? undefined : departmentsQ.data?.find((d) => deptValue(d) === department);
  const departmentFilter = selectedDepartment?.id;

  const invoicesQ = useInvoices({ departmentId: departmentFilter });
  const paymentsQ = usePayments();
  const clientsQ = useClients();
  const slQ = useServiceLines();
  const contractsQ = useContracts({ departmentId: departmentFilter });
  const projectsQ = useProjects({ departmentId: departmentFilter });
  const tasksQ = useTasks({ departmentId: departmentFilter });
  const officesQ = useOffices();
  const tenderPipelineQ = useTenderPipelineSummary({ departmentId: departmentFilter });
  const requestPipelineQ = useClientRequestPipelineSummary({ departmentId: departmentFilter });
  const requestLostBreakdownQ = useLostBreakdown({ departmentId: departmentFilter });
  const hrmsLicensesQ = useHrmsLicenses();
  const reportsInboxQ = useReportsInbox(isAdminOrCeo);
  const myWorkQ = useMyWork();
  const companyQ = useCompanySettings();
  const [alertsOpen, setAlertsOpen] = useState(false);

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
  const moneyFailed = invoicesQ.isError || paymentsQ.isError;
  const reviewsWaiting = myWorkQ.data?.reviews?.waiting ?? 0;

  // Live HRMS usage across licences that are still in force.
  const hrms = useMemo(() => {
    const live = (hrmsLicensesQ.data ?? []).filter((l) => l.status !== "cancelled");
    return {
      users: live.reduce((s, l) => s + (l.activeUsers ?? 0), 0),
      seats: live.reduce((s, l) => s + (l.licensedSeats ?? 0), 0),
    };
  }, [hrmsLicensesQ.data]);
  const hrmsValue = hrmsLicensesQ.isLoading
    ? "…"
    : hrmsLicensesQ.isError
      ? "—"
      : hrms.users.toLocaleString();
  const hrmsHint = hrmsLicensesQ.isError
    ? "Couldn't load licences"
    : hrms.seats > 0
      ? `of ${hrms.seats.toLocaleString()} seats`
      : "No seat limits set";

  const kpis = useMemo(() => {
    const invoicesAll = invoicesQ.data ?? [];
    const payments = paymentsQ.data ?? [];
    const clients = clientsQ.data ?? [];
    const serviceLines = slQ.data ?? [];
    const paidMap = paymentsByInvoice(payments);

    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    // Money owed uses every open invoice; the date range applies to revenue figures only.
    const inLine = invoicesAll.filter(
      (i) => serviceLineId === "all" || i.service_line_id === serviceLineId,
    );
    const openInvoices = inLine.filter(isBilledInvoice);
    const invoices = inLine.filter((i) => new Date(i.issue_date) >= rangeStart);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonth = invoices.filter(
      (i) => new Date(i.issue_date) >= monthStart && isBilledInvoice(i),
    );
    const lastMonth = invoices.filter(
      (i) =>
        new Date(i.issue_date) >= lastMonthStart &&
        new Date(i.issue_date) < monthStart &&
        isBilledInvoice(i),
    );
    // Revenue is before VAT throughout.
    const monthRevenue = thisMonth.reduce((s, i) => s + invoiceRevenue(i), 0);
    const lastMonthRevenue = lastMonth.reduce((s, i) => s + invoiceRevenue(i), 0);
    const mom =
      lastMonthRevenue > 0
        ? ((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : monthRevenue > 0
          ? 100
          : 0;
    const mrr = monthlyRecurringRevenue(
      (contractsQ.data ?? []).filter(
        (c) => serviceLineId === "all" || c.service_line_id === serviceLineId,
      ),
    );

    const outstanding = openInvoices.reduce(
      (s, i) => s + invoiceOutstanding(i, paidMap.get(i.id) ?? 0),
      0,
    );
    const aging = computeAging(openInvoices, paidMap);
    const overdue = aging.slice(1).reduce((s, b) => s + b.amount, 0);
    const critical = aging[4].amount;
    const overdueCount = aging.slice(1).reduce((s, b) => s + b.count, 0);

    const eligible = invoices.filter(isBilledInvoice);
    const totalRevenue = eligible.reduce((s, i) => s + invoiceRevenue(i), 0);
    const totalCost = eligible.reduce((s, i) => s + Number(i.direct_cost), 0);
    const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

    const pipeline = inLine
      .filter((i) => i.status === "draft")
      .reduce((s, i) => s + invoiceRevenue(i), 0);

    const monthly: {
      key: string;
      label: string;
      recurring: number;
      oneOff: number;
      target: number | null;
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
      if (inv.is_recurring) monthly[i].recurring += invoiceRevenue(inv);
      else monthly[i].oneOff += invoiceRevenue(inv);
    }
    // Target = monthly targets of the service lines in view (same filters as the chart).
    const targetLines = serviceLines.filter(
      (sl) =>
        sl.is_active &&
        sl.monthly_target != null &&
        (serviceLineId === "all" || sl.id === serviceLineId) &&
        (!departmentFilter || sl.department_id === departmentFilter),
    );
    const monthlyTarget = targetLines.reduce((s, sl) => s + (sl.monthly_target ?? 0), 0);
    const hasTarget = targetLines.length > 0 && monthlyTarget > 0;
    let running = 0;
    monthly.forEach((m) => {
      m.target = hasTarget ? monthlyTarget : null;
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
      cur.total += invoiceRevenue(inv);
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
      activeClients: clients.filter(
        (c) => c.is_active && (!departmentFilter || c.department_id === departmentFilter),
      ).length,
      totalRevenue,
      monthly,
      hasTarget,
      aging,
      lines,
      serviceLines,
    };
  }, [
    invoicesQ.data,
    paymentsQ.data,
    clientsQ.data,
    slQ.data,
    contractsQ.data,
    months,
    serviceLineId,
    departmentFilter,
  ]);

  const agingChart = kpis.aging.map((b) => ({ label: b.label, amount: b.amount, count: b.count }));
  const linesPie = kpis.lines.map((l) => ({ name: l.name, value: l.total }));

  // Real tender pipeline funnel — counts from the Tender module's own backend aggregation
  // (GET /tenders/pipeline-summary), not a fabricated shape derived from unrelated invoice data.
  const tenderSummary = tenderPipelineQ.data ?? [];
  const tenderTotal = tenderSummary.reduce((s, r) => s + r.count, 0);
  const tenderWon = tenderSummary.find((r) => r.stage === "won")?.count ?? 0;
  const tenderLost = tenderSummary.find((r) => r.stage === "lost")?.count ?? 0;
  const tenderWinRate =
    tenderWon + tenderLost > 0 ? tenderWon / (tenderWon + tenderLost) : undefined;
  const TENDER_FUNNEL_STAGE_ORDER = [
    "identified",
    "applying",
    "submitted",
    "won",
    "lost",
    "withdrawn",
  ] as const;
  const TENDER_FUNNEL_COLORS: Record<string, string> = {
    identified: "#8C8C8C",
    applying: "#085599",
    submitted: "#F5821F",
    won: "#2E9E4F",
    lost: "#D64545",
    withdrawn: "#94a3b8",
  };
  // Pass-through funnel: cumulative_count is "how many tenders ever reached at least this
  // stage" (never shrinks as tenders advance, only when one's deleted) — not the live `count`.
  const tenderFunnel: FunnelStage[] = TENDER_FUNNEL_STAGE_ORDER.map((stage) => ({
    stage: TENDER_STAGE_LABELS[stage],
    value: tenderSummary.find((r) => r.stage === stage)?.cumulative_count ?? 0,
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
  const requestConversionRate =
    requestResolved > 0 ? requestConverted / requestResolved : undefined;
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
  // Pass-through funnel — see the tender funnel's identical comment above.
  const requestFunnel: FunnelStage[] = REQUEST_FUNNEL_STAGE_ORDER.map((stage) => ({
    stage: CLIENT_REQUEST_STAGE_LABELS[stage],
    value: requestSummary.find((r) => r.stage === stage)?.cumulative_count ?? 0,
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
      text: `${formatCurrency(kpis.critical)} owed for more than 90 days — recover this month.`,
    });
  if (kpis.overdueCount > 0)
    insights.push({
      type: "warn",
      text: `${kpis.overdueCount} invoice(s) overdue totalling ${formatCurrency(kpis.overdue)}.`,
    });
  if (kpis.mom > 0)
    insights.push({
      type: "positive",
      text: `Revenue this month is up ${kpis.mom.toFixed(1)}% vs last month.`,
    });
  else if (kpis.mom < 0)
    insights.push({
      type: "warn",
      text: `Revenue this month is down ${Math.abs(kpis.mom).toFixed(1)}% vs last month.`,
    });
  if (kpis.grossMargin < 30 && kpis.totalRevenue > 0)
    insights.push({
      type: "warn",
      text: `Gross margin (revenue left after direct costs) is ${kpis.grossMargin.toFixed(1)}% — below the 30% target.`,
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

  const alerts: DashboardAlert[] = [];
  if (kpis.overdueCount > 0)
    alerts.push({
      key: "overdue",
      title: "Overdue invoices",
      detail: `${plural(kpis.overdueCount, "invoice")} · ${formatCurrency(kpis.overdue)} unpaid`,
      to: "/finance/invoices",
      search: { status: "overdue" },
    });
  if (kpis.critical > 0)
    alerts.push({
      key: "critical",
      title: "Money owed for more than 90 days",
      detail: formatCurrency(kpis.critical),
      to: "/finance/debtors",
    });
  if (kpis.grossMargin < 30 && kpis.totalRevenue > 0)
    alerts.push({
      key: "margin",
      title: "Gross margin below 30%",
      detail: `${kpis.grossMargin.toFixed(1)}% for the selected period`,
      to: "/reports/departments/finance",
    });
  const reportsWaiting = (reportsInboxQ.data ?? []).filter((r) => r.status === "submitted").length;
  if (reportsWaiting > 0)
    alerts.push({
      key: "reports",
      title: "Reports waiting for your review",
      detail:
        department === "all"
          ? plural(reportsWaiting, "report")
          : `${plural(reportsWaiting, "report")} · all departments`,
      to: "/reports",
    });

  // Department status combines overdue tasks, late or off-track projects, and last month's report.
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthName = lastMonth.toLocaleDateString("en-GB", { month: "long" });
  const reportDueDay = companyQ.data?.reportDueDay ?? 5;
  const reportDueDate = new Date(now.getFullYear(), now.getMonth(), reportDueDay);
  const reportsSent = new Set(
    (reportsInboxQ.data ?? [])
      .filter((r) => r.periodStart.slice(0, 7) === lastMonthKey)
      .map((r) => r.department.code),
  );

  const deptStatus = (departmentsQ.data ?? [])
    .filter((d) => !departmentFilter || d.id === departmentFilter)
    .map((d) => {
      const deptProjects = allProjects.filter((p) => p.department_id === d.id);
      const projectIds = new Set(deptProjects.map((p) => p.id));
      const deptTasks = allTasks.filter((t) => projectIds.has(t.project_id));
      const completed = deptTasks.filter((t) => t.status === "completed").length;
      const openTasks = deptTasks.length - completed;
      const overdue = deptTasks.filter((t) => isTaskOverdue(t)).length;
      const openProjects = deptProjects.filter(
        (p) => p.status !== "completed" && p.status !== "cancelled",
      );
      const troubled = openProjects.filter(
        (p) => p.health === "red" || (!!p.end_date && p.end_date < todayKey),
      ).length;
      const report = !REPORTING_DEPARTMENTS.has(d.code ?? "")
        ? "none"
        : !reportsInboxQ.isSuccess
          ? "unknown"
          : reportsSent.has(d.code ?? "")
            ? "sent"
            : now.getDate() > reportDueDay
              ? "missing"
              : "not_due";

      const overdueShare = openTasks > 0 ? overdue / openTasks : 0;
      let score = 0;
      if (overdue >= 3 || overdueShare >= 0.1)
        score += overdue >= 3 && overdueShare >= 0.25 ? 2 : 1;
      if (troubled > 0) score += troubled >= 2 || troubled / openProjects.length >= 0.5 ? 2 : 1;
      if (report === "missing") score += 1;

      const hasData =
        deptTasks.length > 0 ||
        openProjects.length > 0 ||
        report === "sent" ||
        report === "missing";
      const status = !hasData
        ? "No data"
        : score === 0
          ? "On track"
          : score === 1
            ? "At risk"
            : "Behind";
      const detail = [
        deptTasks.length > 0 &&
          (overdue > 0 ? plural(overdue, "overdue task") : "No overdue tasks"),
        troubled > 0 && plural(troubled, "late or off-track project"),
        report === "sent" && `${lastMonthName} report sent`,
        report === "missing" && `${lastMonthName} report not sent`,
        report === "not_due" && `${lastMonthName} report due ${formatDate(reportDueDate)}`,
      ]
        .filter(Boolean)
        .join(" · ");
      const progress = deptTasks.length > 0 ? Math.round((completed / deptTasks.length) * 100) : 0;
      return {
        id: d.id,
        name: d.name,
        progress,
        status,
        hasTasks: deptTasks.length > 0,
        detail: detail || "Nothing recorded yet",
      };
    });

  const quarter = `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`;
  const office = officesQ.data?.find((o) => o.id === profile?.officeId)?.name ?? "—";
  const roleLabel = isAdminOrCeo ? "CEO" : (roles[0] ?? "Staff");

  return (
    <div>
      <AlertsSheet open={alertsOpen} onOpenChange={setAlertsOpen} alerts={alerts} />
      {/* Executive banner strip */}
      <div className="rounded-lg bg-primary text-primary-foreground mb-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5 text-sm">
          <div className="flex items-center gap-2 font-semibold tracking-wide">
            <span>AIMS</span>
            <span className="opacity-40">|</span>
            <span>CEO Executive Dashboard</span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <Link
              to="/documents"
              className="flex items-center gap-1 rounded bg-white/15 px-2 py-1 font-medium hover:bg-white/25"
            >
              <FolderArchive className="h-3.5 w-3.5" /> Documents
            </Link>
            <Link
              to="/calendar"
              className="flex items-center gap-1 rounded bg-white/15 px-2 py-1 font-medium hover:bg-white/25"
            >
              <CalendarClock className="h-3.5 w-3.5" /> Calendar
            </Link>
            <span className="hidden sm:inline font-medium">{quarter}</span>
            <span className="opacity-40 hidden sm:inline">|</span>
            <span className="hidden sm:flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {office}
            </span>
            <span className="opacity-40 hidden sm:inline">|</span>
            <button
              type="button"
              onClick={() => setAlertsOpen(true)}
              aria-label={`Alerts, ${alerts.length}`}
              className="flex items-center gap-1 hover:opacity-80"
            >
              <Bell className="h-3.5 w-3.5" />
              Alerts{" "}
              <span className="ml-1 px-1.5 rounded-full bg-accent text-accent-foreground text-xs font-bold">
                {alerts.length}
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

      {reviewsWaiting > 0 && (
        <Link
          to="/reports"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5 hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4 text-accent" aria-hidden="true" />
            Waiting for your review ({reviewsWaiting})
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            Open reports <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </Link>
      )}

      {/* Filter bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">Filters:</span>
        <select
          value={months}
          aria-label="Date range"
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
          aria-label="Service line"
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
          aria-label="Department"
          onChange={(e) => setDepartment(e.target.value)}
          className="text-xs rounded border bg-background px-2 py-1"
        >
          {departmentOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="ml-auto inline-flex rounded-md border overflow-hidden">
          <button
            type="button"
            aria-pressed={view === "revenue"}
            onClick={() => setView("revenue")}
            className={`px-3 py-1 text-xs ${view === "revenue" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-secondary"}`}
          >
            Revenue vs Target
          </button>
          <button
            type="button"
            aria-pressed={view === "projects"}
            onClick={() => setView("projects")}
            className={`px-3 py-1 text-xs ${view === "projects" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-secondary"}`}
          >
            Project analytics
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : moneyFailed ? (
        <LoadError
          what="invoices and payments"
          error={invoicesQ.error ?? paymentsQ.error}
          onRetry={() => {
            if (invoicesQ.isError) invoicesQ.refetch();
            if (paymentsQ.isError) paymentsQ.refetch();
          }}
        />
      ) : (
        <>
          {/* Executive Decision Support — moved here, right under the filters, so it's the first
              thing read rather than something scrolled past two-thirds down the page. Same card,
              same content as the original dashboard; only the position changed. */}
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-primary">Executive Decision Support</div>
              <span className="text-xs text-muted-foreground">Insights & Actions</span>
            </div>
            <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
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
                  <li key={i} className="flex items-start gap-2 text-xs leading-snug">
                    <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${cls}`} />
                    <span className="min-w-0">{it.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <KpiCell
              label="Revenue this month so far"
              value={formatCurrency(kpis.monthRevenue)}
              hint={`${kpis.mom >= 0 ? "+" : ""}${kpis.mom.toFixed(1)}% vs last month`}
              icon={DollarSign}
              tone={kpis.mom >= 0 ? "positive" : "warning"}
            />
            <KpiCell
              label="Monthly recurring revenue"
              value={formatCurrency(kpis.mrr)}
              hint="From active recurring contracts"
              icon={Repeat}
              tone="positive"
            />
            <KpiCell
              label="Draft invoices"
              value={formatCurrency(kpis.pipeline)}
              hint="Not yet sent to clients"
              icon={TrendingUp}
              tone="warning"
            />
            <KpiCell
              label="Clients"
              value={String(kpis.activeClients)}
              hint="Active"
              icon={Users}
              to="/clients"
              ariaLabel={`Clients, ${kpis.activeClients} active. Open clients`}
            />
            <KpiCell
              label="Outstanding"
              value={formatCurrency(kpis.outstanding)}
              hint={`Unpaid invoices · ${kpis.overdueCount} overdue`}
              icon={FileWarning}
              tone={kpis.overdue > 0 ? "danger" : "default"}
              to="/finance/debtors"
              ariaLabel={`Outstanding, ${formatCurrency(kpis.outstanding)}. Open debtors`}
            />
            <KpiCell
              label="Owed over 90 days"
              value={formatCurrency(kpis.critical)}
              hint="Chase these first"
              icon={AlertTriangle}
              tone="danger"
              to="/finance/debtors"
              ariaLabel={`Owed for more than 90 days, ${formatCurrency(kpis.critical)}. Open debtors`}
            />
            <KpiCell
              label="Gross margin"
              value={`${kpis.grossMargin.toFixed(1)}%`}
              hint="Revenue left after direct costs"
              icon={Percent}
              tone="positive"
            />
            <KpiCell
              label={`Revenue, last ${months} months`}
              value={formatCurrency(kpis.totalRevenue)}
              hint="Before VAT"
              icon={Activity}
            />
            <KpiCell
              label="HRMS users"
              value={hrmsValue}
              hint={department === "all" ? hrmsHint : `All departments · ${hrmsHint}`}
              icon={Briefcase}
            />
            <KpiCell
              label="Alerts"
              value={String(alerts.length)}
              hint="Debts, margin, reports"
              icon={CheckCircle2}
              tone={alerts.length > 0 ? "warning" : "positive"}
              onClick={() => setAlertsOpen(true)}
              ariaLabel={`Alerts, ${alerts.length}`}
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
                      <div className="text-xs text-muted-foreground">
                        {kpis.hasTarget
                          ? "Actual (solid) vs Target (dashed) · before VAT"
                          : "Actual revenue · before VAT"}
                      </div>
                    </div>
                    <Link
                      to="/reports/departments/finance"
                      className="text-xs text-primary hover:underline"
                    >
                      Open financial report
                    </Link>
                  </div>
                  <div className="h-56">
                    <ResponsiveContainer>
                      <ComposedChart
                        data={kpis.monthly}
                        margin={{ top: 5, right: 8, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="label" fontSize={12} />
                        <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line
                          type="monotone"
                          dataKey={(d) => d.recurring + d.oneOff}
                          name="Revenue"
                          stroke="#085599"
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                        />
                        {kpis.hasTarget && (
                          <Line
                            type="monotone"
                            dataKey="target"
                            name="Target"
                            stroke="#F5821F"
                            strokeWidth={2}
                            strokeDasharray="6 4"
                            dot={false}
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  {!kpis.hasTarget && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      No targets set — add monthly targets in{" "}
                      <Link to="/admin/departments" className="text-primary hover:underline">
                        Admin → Departments &amp; Offices
                      </Link>
                    </p>
                  )}
                </div>

                {/* Tenders by stage */}
                <div className="lg:col-span-3 rounded-lg border bg-card p-3 min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs font-semibold text-primary">Tenders by stage</div>
                    <div className="flex items-center gap-2">
                      {tenderWinRate != null && (
                        <span className="text-xs text-muted-foreground">
                          Win rate {(tenderWinRate * 100).toFixed(0)}%
                        </span>
                      )}
                      <Link to="/tender" className="text-xs text-primary hover:underline">
                        Open tenders
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
                  <div className="text-xs font-semibold text-primary mb-1">Top service lines</div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Revenue per service line · before VAT
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
                          <XAxis dataKey="name" fontSize={12} />
                          <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
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
                  <div className="text-xs text-muted-foreground mb-1">
                    Share of each department's tasks that are done
                  </div>
                  <div className="h-56">
                    {deptStatus.every((d) => !d.hasTasks) ? (
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
                          <XAxis dataKey="name" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="progress" stackId="a" fill="#085599" name="Progress %" />
                          <Bar dataKey="gap" stackId="a" fill="#e2e8f0" name="Remaining %" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-4 rounded-lg border bg-card p-3 min-w-0 overflow-hidden">
                  <div className="text-xs font-semibold text-primary mb-1">
                    Tasks by status — {selectedDepartment?.name ?? "all departments"}
                  </div>
                  <FunnelChart stages={taskFunnel} formatValue={(v) => `${v} tasks`} />
                </div>

                <div className="lg:col-span-4 rounded-lg border bg-card p-3">
                  <div className="text-xs font-semibold text-primary mb-1">
                    Project status (all projects)
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">
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
                          <Legend wrapperStyle={{ fontSize: 12 }} />
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
                  <div className="text-xs font-semibold text-primary">Client requests by stage</div>
                  <div className="flex items-center gap-2">
                    {requestConversionRate != null && (
                      <span className="text-xs text-muted-foreground">
                        Conversion rate {(requestConversionRate * 100).toFixed(0)}%
                      </span>
                    )}
                    <Link to="/requests" className="text-xs text-primary hover:underline">
                      Open client requests
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
                <div className="text-xs text-muted-foreground mb-1">
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
                          <li key={r.stage} className="text-xs">
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

          {/* Second row: aging/project detail — Executive Decision Support used to live here
              alongside this card; now that it's been promoted to the top, this card takes the
              full row instead of sharing it. */}
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
            {view === "revenue" ? (
              /* Debtor aging */
              <div className="lg:col-span-12 rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-primary">Debtor ageing</div>
                    <div className="text-xs text-muted-foreground mb-1">
                      {formatCurrency(kpis.aging.reduce((s, b) => s + b.amount, 0))} outstanding ·
                      all open invoices, any date
                    </div>
                  </div>
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
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              /* By project — task breakdown for a selected project */
              <div className="lg:col-span-12 rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-semibold text-primary">Project progress</div>
                  {allProjects.length > 0 && (
                    <select
                      value={chartProject?.id ?? ""}
                      onChange={(e) => setSelectedProjectIdForChart(e.target.value)}
                      aria-label="Project"
                      className="text-xs rounded border bg-background px-1.5 py-0.5 max-w-40"
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
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}
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
                    <Link to="/finance/revenue" className="text-xs text-primary hover:underline">
                      Revenue details
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
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-4 rounded-lg border bg-card p-3">
                  <div className="text-xs font-semibold text-primary">Cumulative revenue</div>
                  <div className="text-xs text-muted-foreground mb-1">Last {months} months</div>
                  <div className="h-48">
                    <ResponsiveContainer>
                      <LineChart data={kpis.monthly}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="label" fontSize={12} />
                        <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
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
                          <XAxis dataKey="name" fontSize={12} />
                          <YAxis fontSize={12} allowDecimals={false} />
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
                          <XAxis type="number" fontSize={12} allowDecimals={false} />
                          <YAxis type="category" dataKey="name" fontSize={12} width={70} />
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
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-primary">Departments</div>
                <Link to="/departments" className="text-xs text-primary hover:underline">
                  All departments
                </Link>
              </div>
              <p className="mb-2 text-xs text-muted-foreground">
                Based on overdue tasks, late projects and reports
              </p>
              {deptStatus.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2">No departments yet.</div>
              ) : (
                <ul className="space-y-2">
                  {deptStatus.map((d) => (
                    <li key={d.id}>
                      <div className="flex justify-between gap-2 text-xs">
                        <span className="font-medium">{d.name}</span>
                        <span
                          className={
                            d.status === "On track"
                              ? "font-medium text-success"
                              : d.status === "At risk"
                                ? "font-medium text-warning"
                                : d.status === "Behind"
                                  ? "font-medium text-destructive"
                                  : "text-muted-foreground"
                          }
                        >
                          {d.status}
                        </span>
                      </div>
                      <div className="text-xs leading-snug text-muted-foreground">{d.detail}</div>
                    </li>
                  ))}
                </ul>
              )}
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
