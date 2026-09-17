import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { KanbanSquare, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/lib/permissions";
import { confirmDialog } from "@/components/confirm-dialog";
import { LoadError } from "@/components/load-error";
import { ActionHint } from "@/components/help-link";
import { useClientRequestsBoardPath } from "@/features/client-requests/board-path";
import { RowActions } from "@/components/row-actions";
import { EditRequestDialog } from "@/features/client-requests/edit-request-dialog";
import {
  useClientRequests,
  useClientRequestPipelineSummary,
  useClientRequestTimeInStage,
  useDeleteClientRequest,
  CLIENT_REQUEST_STAGES,
  CLIENT_REQUEST_STAGE_LABELS,
  CLIENT_REQUEST_STAGE_STYLES,
  SOURCE_LABELS,
  type ClientRequestStage,
  type ClientRequestRow,
} from "@/features/client-requests/use-client-requests";
import { NewRequestDialog } from "@/features/client-requests/new-request-dialog";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { useServiceLines } from "@/features/finance/use-finance-data";
import { formatCurrency } from "@/features/finance/finance";
import { FunnelChart } from "@/components/funnel-chart";
import { DateRangeFilter, type DateRange } from "@/components/date-range-filter";
import { usePagination } from "@/hooks/use-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Button } from "@/components/ui/button";
import { PaginationBar } from "@/components/pagination-bar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

import { OwnWorkPanels } from "@/features/my-work/own-work-panels";
import type { AppRole } from "@/lib/auth";
export const Route = createFileRoute("/_authenticated/requests/")({
  head: () => ({ meta: [{ title: "Requests overview — AIMS" }] }),
  component: ClientRequestsWorkspace,
});

const FUNNEL_STAGES: ClientRequestStage[] = [
  "new",
  "assigned",
  "engaging",
  "proposal",
  "won",
  "lost",
  "withdrawn",
];
const FUNNEL_COLORS: Record<string, string> = {
  new: "#8C8C8C",
  assigned: "#085599",
  engaging: "#F5821F",
  proposal: "#6B5490",
  won: "#2E9E4F",
  lost: "#D64545",
  withdrawn: "#94a3b8",
};

// Also the Operations dashboard; the Client requests board is where requests are worked.
/** With a department code, the page is that department's home and shows the person's own work first. */
export function ClientRequestsWorkspace({ departmentCode }: { departmentCode?: string } = {}) {
  const navigate = useNavigate();
  const perms = usePermissions();
  const boardPath = useClientRequestsBoardPath();
  const canCreate = perms.canManageIntake;
  const [editing, setEditing] = useState<ClientRequestRow | null>(null);
  const deleteRequest = useDeleteClientRequest();
  const removeRequest = async (r: ClientRequestRow) => {
    const ok = await confirmDialog({
      title: `Delete "${r.title}"?`,
      description: "This removes the request and its activity. This can't be undone.",
      confirmLabel: "Delete client request",
      destructive: true,
    });
    if (!ok) return;
    deleteRequest.mutate(r.id, {
      onSuccess: () => toast.success("Client request deleted"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
    });
  };

  const [departmentId, setDepartmentId] = useState("all");
  const [serviceLineId, setServiceLineId] = useState("all");
  const [stage, setStage] = useState<ClientRequestStage | "all">("all");
  const [q, setQ] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({});
  // Bumped on "Clear filters" so the period dropdown resets too.
  const [filterResetKey, setFilterResetKey] = useState(0);
  const { page, pageSize, setPage, setPageSize } = usePagination(25);
  const debouncedQ = useDebouncedValue(q.trim(), 300);

  const filters = {
    departmentId: departmentId === "all" ? undefined : departmentId,
    serviceLineId: serviceLineId === "all" ? undefined : serviceLineId,
    stage: stage === "all" ? undefined : stage,
    q: debouncedQ || undefined,
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  };
  const hasFilters = Object.values(filters).some(Boolean);
  const searchOrStageActive = !!filters.q || !!filters.stage;
  const summaryFiltered = !!(
    filters.departmentId ||
    filters.serviceLineId ||
    filters.dateFrom ||
    filters.dateTo
  );

  const clearFilters = () => {
    setDepartmentId("all");
    setServiceLineId("all");
    setStage("all");
    setQ("");
    setDateRange({});
    setFilterResetKey((k) => k + 1);
    setPage(1);
  };

  const requestsQ = useClientRequests(filters, { page, pageSize });
  // Keep showing the last results while the next filter's page loads.
  const [lastResult, setLastResult] = useState(requestsQ.data);
  if (requestsQ.data && requestsQ.data !== lastResult) setLastResult(requestsQ.data);
  const requestsResult = requestsQ.data ?? lastResult;
  const requests = requestsResult
    ? Array.isArray(requestsResult)
      ? requestsResult
      : requestsResult.data
    : [];
  const requestsTotal =
    requestsResult && !Array.isArray(requestsResult) ? requestsResult.total : requests.length;
  const summaryQ = useClientRequestPipelineSummary({
    departmentId: filters.departmentId,
    serviceLineId: filters.serviceLineId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });
  const departmentsQ = useDepartments();
  const serviceLinesQ = useServiceLines();
  const timeInStageQ = useClientRequestTimeInStage({
    departmentId: filters.departmentId,
    serviceLineId: filters.serviceLineId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });

  const summary = summaryQ.data ?? [];
  const totalRequests = summary.reduce((sum, s) => sum + s.count, 0);
  const inPipeline = summary
    .filter(
      (s) =>
        s.stage === "new" ||
        s.stage === "assigned" ||
        s.stage === "engaging" ||
        s.stage === "proposal",
    )
    .reduce((sum, s) => sum + s.count, 0);
  const convertedCount = summary.find((s) => s.stage === "won")?.count ?? 0;
  const lostCount = summary.find((s) => s.stage === "lost")?.count ?? 0;
  const withdrawnCount = summary.find((s) => s.stage === "withdrawn")?.count ?? 0;
  const resolvedCount = convertedCount + lostCount + withdrawnCount;
  const conversionRate = resolvedCount > 0 ? convertedCount / resolvedCount : null;

  // Pass-through funnel: cumulative_count is "how many requests ever reached at least this
  // stage" (never shrinks as requests advance, only when one's deleted) — not the live `count`
  // of what's sitting in that exact stage right now, which is what a Kanban column shows.
  const funnelData = FUNNEL_STAGES.map((s) => ({
    stage: CLIENT_REQUEST_STAGE_LABELS[s],
    value: summary.find((r) => r.stage === s)?.cumulative_count ?? 0,
    color: FUNNEL_COLORS[s],
  }));

  return (
    <div className="space-y-4">
      {editing && <EditRequestDialog request={editing} onClose={() => setEditing(null)} />}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold">Requests overview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            How client requests are moving: totals, Won rate and what's waiting. Work on them from
            the board.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to={boardPath}>
                <KanbanSquare className="h-4 w-4 mr-1" /> Open the board
              </Link>
            </Button>
            {canCreate && <NewClientRequestButton />}
          </div>
          {!canCreate && (
            <ActionHint>Requests are logged by Operations. Ask them to add one.</ActionHint>
          )}
        </div>
      </div>
      {departmentCode && (
        <OwnWorkPanels departmentCode={departmentCode} role={departmentCode as AppRole} />
      )}

      {summaryQ.isError ? (
        <LoadError
          what="request totals"
          error={summaryQ.error}
          onRetry={() => summaryQ.refetch()}
        />
      ) : (
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">
            All requests
            {searchOrStageActive && " (search and stage filter not applied to these totals)"}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Open requests" value={inPipeline.toLocaleString()} />
            <KpiCard label="Won" value={convertedCount.toLocaleString()} />
            <KpiCard
              label="Won rate"
              value={conversionRate != null ? `${(conversionRate * 100).toFixed(0)}%` : "—"}
            />
            <KpiCard label="Total requests" value={totalRequests.toLocaleString()} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-1 rounded-lg border bg-card p-4 min-w-0 overflow-hidden">
          <h2 className="text-sm font-semibold mb-2">How far requests get (all requests)</h2>
          {summaryQ.isError ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Totals didn't load.</p>
          ) : summaryQ.isLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : totalRequests === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">
              {summaryFiltered ? "No matches for these filters." : "No client requests yet."}
            </div>
          ) : (
            <FunnelChart stages={funnelData} formatValue={(v) => v.toLocaleString()} />
          )}
        </div>

        <div className="lg:col-span-2 rounded-lg border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search title, client, reference or contact"
                aria-label="Search client requests"
                className="pl-7"
              />
            </div>
            <div className="w-40">
              <Select
                value={departmentId}
                onValueChange={(v) => {
                  setDepartmentId(v);
                  setPage(1);
                }}
              >
                <SelectTrigger aria-label="Department">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {(departmentsQ.data ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Select
                value={serviceLineId}
                onValueChange={(v) => {
                  setServiceLineId(v);
                  setPage(1);
                }}
              >
                <SelectTrigger aria-label="Service line">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All service lines</SelectItem>
                  {(serviceLinesQ.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Select
                value={stage}
                onValueChange={(v) => {
                  setStage(v as ClientRequestStage | "all");
                  setPage(1);
                }}
              >
                <SelectTrigger aria-label="Stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  {CLIENT_REQUEST_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {CLIENT_REQUEST_STAGE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DateRangeFilter
              key={filterResetKey}
              value={dateRange}
              onChange={(r) => {
                setDateRange(r);
                setPage(1);
              }}
            />
          </div>

          {requestsQ.isError && !requestsQ.data ? (
            <LoadError
              what="client requests"
              error={requestsQ.error}
              onRetry={() => requestsQ.refetch()}
            />
          ) : !requestsResult && requestsQ.isPending ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : requests.length === 0 && hasFilters ? (
            <div className="py-6 flex flex-col items-center gap-2 text-center">
              <div className="text-sm font-medium">No matches</div>
              <div className="text-xs text-muted-foreground">
                No client requests match these filters.
              </div>
              <Button size="sm" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : requests.length === 0 ? (
            <div className="py-6 flex flex-col items-center gap-2 text-center">
              <div className="text-sm font-medium">No client requests yet</div>
              {canCreate ? (
                <NewClientRequestButton />
              ) : (
                <div className="text-xs text-muted-foreground">
                  Requests are logged by Operations. Ask them to add one.
                </div>
              )}
            </div>
          ) : (
            <div
              className={`overflow-x-auto transition-opacity ${requestsQ.data ? "" : "opacity-60"}`}
              aria-busy={!requestsQ.data}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-secondary/40"
                      onClick={() =>
                        navigate({ to: "/requests/$requestId", params: { requestId: r.id } })
                      }
                    >
                      <TableCell className="font-medium">
                        <Link
                          to="/requests/$requestId"
                          params={{ requestId: r.id }}
                          className="hover:underline"
                        >
                          {r.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.client_name ?? r.prospect_client_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">{SOURCE_LABELS[r.source]}</TableCell>
                      <TableCell className="text-xs">
                        {r.department_name ?? "Not routed yet"}
                      </TableCell>
                      <TableCell>
                        <Badge className={CLIENT_REQUEST_STAGE_STYLES[r.stage]} variant="secondary">
                          {CLIENT_REQUEST_STAGE_LABELS[r.stage]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {r.estimated_value != null
                          ? formatCurrency(r.estimated_value, r.currency)
                          : "—"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <RowActions
                          label={r.title}
                          onEdit={perms.canEditRequest(r) ? () => setEditing(r) : undefined}
                          onDelete={perms.canManageIntake ? () => removeRequest(r) : undefined}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationBar
                page={page}
                pageSize={pageSize}
                total={requestsTotal}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold mb-2">Time in stage</h2>
        {timeInStageQ.isError ? (
          <LoadError
            what="time in stage"
            error={timeInStageQ.error}
            onRetry={() => timeInStageQ.refetch()}
          />
        ) : timeInStageQ.isLoading ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (timeInStageQ.data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Nothing to measure yet. Times show once requests start moving.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {(timeInStageQ.data ?? []).map((entry) => (
              <div key={entry.stage} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">
                    {CLIENT_REQUEST_STAGE_LABELS[entry.stage]}
                  </span>
                  {entry.stuck_count > 0 && (
                    <Badge variant="secondary" className="bg-warning/15 text-warning">
                      {entry.stuck_count} waiting
                    </Badge>
                  )}
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {entry.avg_days != null ? `${entry.avg_days}d` : "—"}
                  <span className="text-xs font-normal text-muted-foreground ml-1">avg</span>
                </div>
                {entry.oldest_stuck && (
                  <Link
                    to="/requests/$requestId"
                    params={{ requestId: entry.oldest_stuck.id }}
                    className="mt-1 block text-xs text-muted-foreground hover:text-primary truncate"
                  >
                    Longest waiting: {entry.oldest_stuck.title} ({entry.oldest_stuck.days}d)
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NewClientRequestButton() {
  return (
    <NewRequestDialog
      trigger={
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> New client request
        </Button>
      }
    />
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
