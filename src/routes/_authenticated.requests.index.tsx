import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  useClientRequests,
  useClientRequestPipelineSummary,
  useClientRequestTimeInStage,
  useSaveClientRequest,
  CLIENT_REQUEST_STAGES,
  CLIENT_REQUEST_STAGE_LABELS,
  CLIENT_REQUEST_STAGE_STYLES,
  SOURCE_LABELS,
  type ClientRequestStage,
  type ClientRequestSource,
} from "@/features/client-requests/use-client-requests";
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

export const Route = createFileRoute("/_authenticated/requests/")({
  head: () => ({ meta: [{ title: "Client Requests — AIMS" }] }),
  component: ClientRequestsWorkspace,
});

const FUNNEL_STAGES: ClientRequestStage[] = ["new", "assigned", "engaging", "proposal", "won", "lost", "withdrawn"];
const FUNNEL_COLORS: Record<string, string> = {
  new: "#8C8C8C",
  assigned: "#085599",
  engaging: "#F5821F",
  proposal: "#6B5490",
  won: "#2E9E4F",
  lost: "#D64545",
  withdrawn: "#94a3b8",
};

function ClientRequestsWorkspace() {
  const navigate = useNavigate();
  const { hasRole, isAdminOrCeo } = useAuth();
  const canCreate = isAdminOrCeo || hasRole("marketing_ops");

  const [departmentId, setDepartmentId] = useState("all");
  const [serviceLineId, setServiceLineId] = useState("all");
  const [stage, setStage] = useState<ClientRequestStage | "all">("all");
  const [q, setQ] = useState("");

  const filters = {
    departmentId: departmentId === "all" ? undefined : departmentId,
    serviceLineId: serviceLineId === "all" ? undefined : serviceLineId,
    stage: stage === "all" ? undefined : stage,
    q: q.trim() || undefined,
  };

  const requestsQ = useClientRequests(filters);
  const summaryQ = useClientRequestPipelineSummary({
    departmentId: filters.departmentId,
    serviceLineId: filters.serviceLineId,
  });
  const departmentsQ = useDepartments();
  const serviceLinesQ = useServiceLines();
  const timeInStageQ = useClientRequestTimeInStage({
    departmentId: filters.departmentId,
    serviceLineId: filters.serviceLineId,
  });

  const summary = summaryQ.data ?? [];
  const totalRequests = summary.reduce((sum, s) => sum + s.count, 0);
  const inPipeline = summary
    .filter((s) => s.stage === "new" || s.stage === "assigned" || s.stage === "engaging" || s.stage === "proposal")
    .reduce((sum, s) => sum + s.count, 0);
  const convertedCount = summary.find((s) => s.stage === "won")?.count ?? 0;
  const lostCount = summary.find((s) => s.stage === "lost")?.count ?? 0;
  const withdrawnCount = summary.find((s) => s.stage === "withdrawn")?.count ?? 0;
  const resolvedCount = convertedCount + lostCount + withdrawnCount;
  const conversionRate = resolvedCount > 0 ? convertedCount / resolvedCount : null;

  const funnelData = FUNNEL_STAGES.map((s) => ({
    stage: CLIENT_REQUEST_STAGE_LABELS[s],
    value: summary.find((r) => r.stage === s)?.count ?? 0,
    color: FUNNEL_COLORS[s],
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold">Client Requests</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Intake → routing → engagement → conversion into a project or recurring client.
          </p>
        </div>
        {canCreate && <NewRequestDialog />}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="In pipeline" value={inPipeline.toLocaleString()} />
        <KpiCard label="Converted" value={convertedCount.toLocaleString()} />
        <KpiCard
          label="Conversion rate"
          value={conversionRate != null ? `${(conversionRate * 100).toFixed(0)}%` : "—"}
        />
        <KpiCard label="Total requests" value={totalRequests.toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-1 rounded-lg border bg-card p-4 min-w-0 overflow-hidden">
          <div className="text-sm font-semibold mb-2">Pipeline funnel</div>
          {summaryQ.isLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : totalRequests === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">No requests yet.</div>
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
              <Select value={stage} onValueChange={(v) => setStage(v as ClientRequestStage | "all")}>
                <SelectTrigger>
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
          </div>

          {requestsQ.isLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (requestsQ.data ?? []).length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">No requests match these filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(requestsQ.data ?? []).map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-secondary/40"
                      onClick={() => navigate({ to: "/requests/$requestId", params: { requestId: r.id } })}
                    >
                      <TableCell className="font-medium">
                        <Link to="/requests/$requestId" params={{ requestId: r.id }} className="hover:underline">
                          {r.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">{r.client_name ?? r.prospect_client_name ?? "—"}</TableCell>
                      <TableCell className="text-xs">{SOURCE_LABELS[r.source]}</TableCell>
                      <TableCell className="text-xs">{r.department_name ?? "Unrouted"}</TableCell>
                      <TableCell>
                        <Badge className={CLIENT_REQUEST_STAGE_STYLES[r.stage]} variant="secondary">
                          {CLIENT_REQUEST_STAGE_LABELS[r.stage]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {r.estimated_value != null ? formatCurrency(r.estimated_value, r.currency) : "—"}
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
        <div className="text-sm font-semibold mb-2">Time in stage</div>
        {timeInStageQ.isLoading ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {(timeInStageQ.data ?? []).map((entry) => (
              <div key={entry.stage} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{CLIENT_REQUEST_STAGE_LABELS[entry.stage]}</span>
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

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function NewRequestDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [source, setSource] = useState<ClientRequestSource>("operations");
  const [clientMode, setClientMode] = useState<"existing" | "prospect">("existing");
  const [clientId, setClientId] = useState("");
  const [prospectClientName, setProspectClientName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [serviceLineId, setServiceLineId] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [description, setDescription] = useState("");

  const clientsQ = useClients();
  const serviceLinesQ = useServiceLines();
  const save = useSaveClientRequest();

  const reset = () => {
    setTitle("");
    setSource("operations");
    setClientMode("existing");
    setClientId("");
    setProspectClientName("");
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    setServiceLineId("");
    setEstimatedValue("");
    setDescription("");
  };

  const submit = () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    save.mutate(
      {
        title: title.trim(),
        source,
        client_id: clientMode === "existing" ? clientId || undefined : undefined,
        prospect_client_name: clientMode === "prospect" ? prospectClientName.trim() || undefined : undefined,
        contact_name: contactName || undefined,
        contact_email: contactEmail || undefined,
        contact_phone: contactPhone || undefined,
        service_line_id: serviceLineId || undefined,
        estimated_value: estimatedValue ? Number(estimatedValue) : undefined,
        description: description || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Request logged");
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
          <Plus className="h-4 w-4 mr-1" /> New request
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a client request</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is being requested?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Source</Label>
              <Select value={source} onValueChange={(v) => setSource(v as ClientRequestSource)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SOURCE_LABELS).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Contact name</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div>
              <Label>Contact email</Label>
              <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
            <div>
              <Label>Contact phone</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Est. value (optional)</Label>
            <Input type="number" value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Log request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
