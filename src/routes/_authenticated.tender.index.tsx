import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Search } from "lucide-react";
import { RequireRole } from "@/components/require-role";
import {
  useTenders,
  useTenderPipelineSummary,
  useTenderTimeMetrics,
  useSaveTender,
  TENDER_STAGES,
  TENDER_STAGE_LABELS,
  TENDER_STAGE_STYLES,
  type TenderStage,
} from "@/features/tender/use-tender";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { useClients, useServiceLines } from "@/features/finance/use-finance-data";
import { formatCurrency } from "@/features/finance/finance";
import { FunnelChart } from "@/components/funnel-chart";
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

export const Route = createFileRoute("/_authenticated/tender/")({
  head: () => ({ meta: [{ title: "Tender — AIMS" }] }),
  component: () => (
    <RequireRole
      roles={["tender"]}
      message="The Tender workspace is restricted to the Tender team, CEO and System Administrator."
    >
      <TenderWorkspace />
    </RequireRole>
  ),
});

const FUNNEL_STAGES: TenderStage[] = ["identified", "applying", "submitted", "evaluation", "won", "lost", "withdrawn"];
const FUNNEL_COLORS: Record<string, string> = {
  identified: "#8C8C8C",
  applying: "#085599",
  submitted: "#F5821F",
  evaluation: "#6B5490",
  won: "#2E9E4F",
  lost: "#D64545",
  withdrawn: "#94a3b8",
};

function TenderWorkspace() {
  const navigate = useNavigate();
  const [departmentId, setDepartmentId] = useState("all");
  const [serviceLineId, setServiceLineId] = useState("all");
  const [stage, setStage] = useState<TenderStage | "all">("all");
  const [q, setQ] = useState("");

  const filters = {
    departmentId: departmentId === "all" ? undefined : departmentId,
    serviceLineId: serviceLineId === "all" ? undefined : serviceLineId,
    stage: stage === "all" ? undefined : stage,
    q: q.trim() || undefined,
  };

  const tendersQ = useTenders(filters);
  const summaryQ = useTenderPipelineSummary({
    departmentId: filters.departmentId,
    serviceLineId: filters.serviceLineId,
  });
  const departmentsQ = useDepartments();
  const serviceLinesQ = useServiceLines();
  const timeMetricsQ = useTenderTimeMetrics({
    departmentId: filters.departmentId,
    serviceLineId: filters.serviceLineId,
  });

  const summary = summaryQ.data ?? [];
  const totalTenders = summary.reduce((sum, s) => sum + s.count, 0);
  const activeCount = summary
    .filter((s) => s.stage === "identified" || s.stage === "applying" || s.stage === "submitted" || s.stage === "evaluation")
    .reduce((sum, s) => sum + s.count, 0);
  const pipelineValue = summary
    .filter((s) => s.stage === "identified" || s.stage === "applying" || s.stage === "submitted" || s.stage === "evaluation")
    .reduce((sum, s) => sum + s.total_value, 0);
  const wonCount = summary.find((s) => s.stage === "won")?.count ?? 0;
  const lostCount = summary.find((s) => s.stage === "lost")?.count ?? 0;
  const winRate = wonCount + lostCount > 0 ? wonCount / (wonCount + lostCount) : null;

  const funnelData = FUNNEL_STAGES.map((s) => ({
    stage: TENDER_STAGE_LABELS[s],
    value: summary.find((r) => r.stage === s)?.count ?? 0,
    color: FUNNEL_COLORS[s],
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold">Tender</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bid pipeline, resourcing and win/loss tracking.
          </p>
        </div>
        <NewTenderDialog />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Active tenders" value={activeCount.toLocaleString()} />
        <KpiCard label="Pipeline value" value={formatCurrency(pipelineValue)} />
        <KpiCard label="Win rate" value={winRate != null ? `${(winRate * 100).toFixed(0)}%` : "—"} />
        <KpiCard label="Total tenders" value={totalTenders.toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-1 rounded-lg border bg-card p-4 min-w-0 overflow-hidden">
          <div className="text-sm font-semibold mb-2">Pipeline funnel</div>
          {summaryQ.isLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : totalTenders === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">No tenders yet.</div>
          ) : (
            <FunnelChart stages={funnelData} formatValue={(v) => v.toLocaleString()} />
          )}
        </div>

        <div className="lg:col-span-2 rounded-lg border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title…" className="pl-7" />
            </div>
            <div className="w-40">
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger>
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
              <Select value={serviceLineId} onValueChange={setServiceLineId}>
                <SelectTrigger>
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
              <Select value={stage} onValueChange={(v) => setStage(v as TenderStage | "all")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  {TENDER_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {TENDER_STAGE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {tendersQ.isLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (tendersQ.data ?? []).length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">No tenders match these filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(tendersQ.data ?? []).map((t) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-secondary/40"
                      onClick={() => navigate({ to: "/tender/$tenderId", params: { tenderId: t.id } })}
                    >
                      <TableCell className="font-medium">
                        <Link
                          to="/tender/$tenderId"
                          params={{ tenderId: t.id }}
                          className="hover:underline"
                        >
                          {t.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">{t.client_name ?? t.prospect_client_name ?? "—"}</TableCell>
                      <TableCell className="text-xs">{t.department_name}</TableCell>
                      <TableCell>
                        <Badge className={TENDER_STAGE_STYLES[t.stage]} variant="secondary">
                          {TENDER_STAGE_LABELS[t.stage]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{t.submission_deadline ?? "—"}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {t.estimated_value != null ? formatCurrency(t.estimated_value, t.currency) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-semibold mb-2">Time to submit &amp; decide</div>
        {timeMetricsQ.isLoading ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="grid grid-cols-2 gap-3 md:col-span-1">
              <KpiCard
                label="Avg. days to submit"
                value={timeMetricsQ.data?.avg_days_to_submit != null ? `${timeMetricsQ.data.avg_days_to_submit}d` : "—"}
              />
              <KpiCard
                label="Avg. days to decide"
                value={timeMetricsQ.data?.avg_days_to_decision != null ? `${timeMetricsQ.data.avg_days_to_decision}d` : "—"}
              />
            </div>
            <div className="md:col-span-2">
              <div className="text-xs font-medium text-muted-foreground mb-1.5">
                Stalled — not yet submitted, oldest first
              </div>
              {(timeMetricsQ.data?.stalled ?? []).length === 0 ? (
                <div className="text-xs text-muted-foreground py-2">Nothing stalled right now.</div>
              ) : (
                <div className="space-y-1">
                  {(timeMetricsQ.data?.stalled ?? []).slice(0, 5).map((s) => (
                    <Link
                      key={s.id}
                      to="/tender/$tenderId"
                      params={{ tenderId: s.id }}
                      className="flex items-center justify-between text-xs rounded px-2 py-1.5 hover:bg-secondary/50"
                    >
                      <span className="truncate mr-2">{s.title}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <Badge className={TENDER_STAGE_STYLES[s.stage]} variant="secondary">
                          {TENDER_STAGE_LABELS[s.stage]}
                        </Badge>
                        <span className="text-muted-foreground tabular-nums">{s.days}d</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
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

function NewTenderDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [clientMode, setClientMode] = useState<"existing" | "prospect">("existing");
  const [clientId, setClientId] = useState("");
  const [prospectClientName, setProspectClientName] = useState("");
  const [serviceLineId, setServiceLineId] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [submissionDeadline, setSubmissionDeadline] = useState("");
  const [description, setDescription] = useState("");

  const departmentsQ = useDepartments();
  const clientsQ = useClients();
  const serviceLinesQ = useServiceLines();
  const save = useSaveTender();

  const reset = () => {
    setTitle("");
    setDepartmentId("");
    setClientMode("existing");
    setClientId("");
    setProspectClientName("");
    setServiceLineId("");
    setEstimatedValue("");
    setSubmissionDeadline("");
    setDescription("");
  };

  const submit = () => {
    if (!title.trim() || !departmentId) {
      toast.error("Title and department are required");
      return;
    }
    save.mutate(
      {
        title: title.trim(),
        department_id: departmentId,
        client_id: clientMode === "existing" ? clientId || undefined : undefined,
        prospect_client_name: clientMode === "prospect" ? prospectClientName.trim() || undefined : undefined,
        service_line_id: serviceLineId || undefined,
        estimated_value: estimatedValue ? Number(estimatedValue) : undefined,
        submission_deadline: submissionDeadline || undefined,
        description: description || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Tender created");
          setOpen(false);
          reset();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> New tender
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New tender</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {(departmentsQ.data ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>Client (optional)</Label>
                <button
                  type="button"
                  onClick={() => setClientMode(clientMode === "existing" ? "prospect" : "existing")}
                  className="text-[0.6875rem] text-primary hover:underline"
                >
                  {clientMode === "existing" ? "+ New company" : "Pick existing client"}
                </button>
              </div>
              {clientMode === "existing" ? (
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Not yet known" />
                  </SelectTrigger>
                  <SelectContent>
                    {(clientsQ.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={prospectClientName}
                  onChange={(e) => setProspectClientName(e.target.value)}
                  placeholder="Company name (not in system yet)"
                />
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Service line</Label>
              <Select value={serviceLineId} onValueChange={setServiceLineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {(serviceLinesQ.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Est. value</Label>
              <Input
                type="number"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
              />
            </div>
            <div>
              <Label>Deadline</Label>
              <Input
                type="date"
                value={submissionDeadline}
                onChange={(e) => setSubmissionDeadline(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create tender
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
