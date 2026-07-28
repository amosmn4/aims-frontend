import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth";
import {
  useClientRequest,
  useRouteClientRequest,
  useUpdateClientRequestStage,
  useConvertToProject,
  useConvertClientRequestToContract,
  useClientRequestActivities,
  useLogActivity,
  useDeleteActivity,
  CLIENT_REQUEST_STAGES,
  CLIENT_REQUEST_STAGE_LABELS,
  CLIENT_REQUEST_STAGE_STYLES,
  SOURCE_LABELS,
  ACTIVITY_TYPE_LABELS,
  type ClientRequestStage,
  type ClientRequestActivityType,
} from "@/features/client-requests/use-client-requests";
import { useDepartments, useProfilesLite } from "@/features/clients/use-clients-contracts";
import { useClients } from "@/features/finance/use-finance-data";
import { formatCurrency } from "@/features/finance/finance";
import { AttachmentsPanel } from "@/features/documents/attachments-panel";
import { RelatedRecords, type RelatedRecordItem } from "@/components/related-records";
import { EntityBreadcrumb, type BreadcrumbSegment } from "@/components/entity-breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export const Route = createFileRoute("/_authenticated/requests/$requestId")({
  head: () => ({ meta: [{ title: "Client Request — AIMS" }] }),
  component: ClientRequestDetail,
});

function buildRequestRelated(request: ReturnType<typeof useClientRequest>["data"]): RelatedRecordItem[] {
  if (!request) return [];
  const items: RelatedRecordItem[] = [];
  if (request.converted_from_lead_id) {
    items.push({ label: "Source Lead", title: request.converted_from_lead_name ?? "Lead", to: "/marketing/leads" });
  }
  if (request.converted_project_id) {
    items.push({
      label: "Converted Project",
      title: request.converted_project_name ?? "Project",
      to: `/projects/${request.converted_project_id}`,
    });
  }
  if (request.converted_contract_id) {
    items.push({
      label: "Converted Contract",
      title: request.converted_contract_number ?? "Contract",
      to: `/clients/contracts/${request.converted_contract_id}`,
    });
  }
  return items;
}

function buildRequestBreadcrumb(request: ReturnType<typeof useClientRequest>["data"]): BreadcrumbSegment[] {
  if (!request) return [];
  const segments: BreadcrumbSegment[] = [];
  if (request.converted_from_lead_id) {
    segments.push({ label: "Leads", to: "/marketing/leads" });
    segments.push({ label: request.converted_from_lead_name ?? "Lead", to: "/marketing/leads" });
  }
  segments.push({ label: "Client Requests", to: "/requests" });
  segments.push({ label: request.title });
  return segments;
}

function ClientRequestDetail() {
  const { requestId } = Route.useParams();
  const { hasRole, isAdminOrCeo } = useAuth();
  const requestQ = useClientRequest(requestId);
  const updateStage = useUpdateClientRequestStage();
  const departmentsQ = useDepartments();

  if (requestQ.isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  const request = requestQ.data;
  if (!request) return <div className="text-sm text-muted-foreground">Request not found.</div>;

  const isIntake = isAdminOrCeo || hasRole("operations");
  const departmentCode = departmentsQ.data?.find((d) => d.id === request.department_id)?.code;
  const canManage =
    isAdminOrCeo || (request.department_id ? !!departmentCode && hasRole(departmentCode as AppRole) : isIntake);

  const changeStage = (stage: ClientRequestStage) => {
    if (stage === "lost" || stage === "withdrawn") {
      const reason = window.prompt(`Reason the request was marked ${stage} (optional):`) ?? undefined;
      updateStage.mutate(
        { id: request.id, stage, lost_reason: reason },
        { onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed") },
      );
      return;
    }
    updateStage.mutate(
      { id: request.id, stage },
      { onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed") },
    );
  };

  return (
    <div className="space-y-4">
      <EntityBreadcrumb segments={buildRequestBreadcrumb(request)} />

      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold">{request.title}</h1>
            <div className="text-xs text-muted-foreground mt-0.5">
              {request.department_name ?? "Unrouted"}
              {(request.client_name ?? request.prospect_client_name) &&
                ` · ${request.client_name ?? request.prospect_client_name}${!request.client_name ? " (prospect)" : ""}`}
              {request.service_line_name && ` · ${request.service_line_name}`}
              {` · via ${SOURCE_LABELS[request.source]}`}
            </div>
            {(request.contact_name || request.contact_email || request.contact_phone) && (
              <div className="text-xs text-muted-foreground mt-1">
                {[request.contact_name, request.contact_email, request.contact_phone].filter(Boolean).join(" · ")}
              </div>
            )}
            {request.description && (
              <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{request.description}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {canManage && request.department_id ? (
              <Select value={request.stage} onValueChange={(v) => changeStage(v as ClientRequestStage)}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_REQUEST_STAGES.filter((s) => s !== "new").map((s) => (
                    <SelectItem key={s} value={s}>
                      {CLIENT_REQUEST_STAGE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge className={CLIENT_REQUEST_STAGE_STYLES[request.stage]} variant="secondary">
                {CLIENT_REQUEST_STAGE_LABELS[request.stage]}
              </Badge>
            )}
            {request.estimated_value != null && (
              <div className="text-sm font-semibold tabular-nums">
                {formatCurrency(request.estimated_value, request.currency)}
              </div>
            )}
            {request.assigned_to_name && (
              <div className="text-xs text-muted-foreground">Assigned to {request.assigned_to_name}</div>
            )}
          </div>
        </div>

        {!request.department_id && isIntake && (
          <div className="mt-3 pt-3 border-t">
            <RouteDialog requestId={request.id} />
          </div>
        )}

        {request.stage === "lost" || request.stage === "withdrawn" ? (
          request.lost_reason && (
            <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
              Reason: {request.lost_reason}
            </div>
          )
        ) : null}

        {request.stage === "won" && (
          <div className="mt-3 pt-3 border-t text-xs text-success space-y-0.5">
            {request.converted_project_id && (
              <div>
                Converted to project{" "}
                <Link to="/projects/$projectId" params={{ projectId: request.converted_project_id }} className="underline hover:opacity-80">
                  {request.converted_project_name}
                </Link>
              </div>
            )}
            {request.converted_contract_id && (
              <div>
                Converted to contract{" "}
                <Link
                  to="/clients/contracts/$id"
                  params={{ id: request.converted_contract_id }}
                  className="underline hover:opacity-80"
                >
                  {request.converted_contract_number ?? request.converted_contract_id}
                </Link>
              </div>
            )}
          </div>
        )}

        {request.department_id &&
          request.stage !== "won" &&
          request.stage !== "lost" &&
          request.stage !== "withdrawn" &&
          canManage &&
          !request.converted_project_id &&
          !request.converted_contract_id && (
            <div className="mt-3 pt-3 border-t flex gap-2 flex-wrap">
              <ConvertToProjectDialog requestId={request.id} defaultClientId={request.client_id} />
              <ConvertToContractDialog
                requestId={request.id}
                defaultClientId={request.client_id}
                defaultValue={request.estimated_value}
              />
            </div>
          )}
      </div>

      <RelatedRecords items={buildRequestRelated(request)} engagementTo={`/engagements/request/${request.id}`} />

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
        <TabsContent value="activity">
          <ActivityTab requestId={request.id} canManage={canManage} />
        </TabsContent>
        <TabsContent value="documents">
          <AttachmentsPanel resourceType="client_request" resourceId={request.id} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RouteDialog({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const [departmentId, setDepartmentId] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const departmentsQ = useDepartments();
  const profilesQ = useProfilesLite();
  const route = useRouteClientRequest();

  const submit = () => {
    if (!departmentId) {
      toast.error("Choose a department to route to");
      return;
    }
    route.mutate(
      { id: requestId, department_id: departmentId, assigned_to_id: assignedToId || undefined },
      {
        onSuccess: () => {
          toast.success("Request routed");
          setOpen(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to route"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Route to department</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Route request to a department</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Department</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {(departmentsQ.data ?? [])
                  .filter((d) => d.code !== "operations")
                  .map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Assign to (optional)</Label>
            <Select value={assignedToId} onValueChange={setAssignedToId}>
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                {(profilesQ.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name ?? p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={route.isPending}>
            {route.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Route
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConvertToProjectDialog({
  requestId,
  defaultClientId,
}: {
  requestId: string;
  defaultClientId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const clientsQ = useClients();
  const convert = useConvertToProject();

  const submit = () => {
    if (!defaultClientId && !clientId) {
      toast.error("Choose a client — a project needs a real client on file");
      return;
    }
    convert.mutate(
      { requestId, name: name.trim() || undefined, clientId: clientId || undefined, startDate },
      {
        onSuccess: () => {
          toast.success("Converted to project");
          setOpen(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Conversion failed"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Convert to project</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert to project</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Project name (optional)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Defaults to request title" />
          </div>
          {!defaultClientId && (
            <div>
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
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
          <div>
            <Label>Start date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={convert.isPending}>
            {convert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Convert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConvertToContractDialog({
  requestId,
  defaultClientId,
  defaultValue,
}: {
  requestId: string;
  defaultClientId: string | null;
  defaultValue: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [contractNumber, setContractNumber] = useState("");
  const [billingFrequency, setBillingFrequency] = useState<"one_off" | "monthly" | "quarterly" | "annual">(
    "monthly",
  );
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const clientsQ = useClients();
  const convert = useConvertClientRequestToContract();

  const submit = () => {
    if (!contractNumber.trim()) {
      toast.error("Contract number is required");
      return;
    }
    if (!defaultClientId && !clientId) {
      toast.error("Choose a client — a recurring contract needs a real client on file");
      return;
    }
    convert.mutate(
      {
        requestId,
        contractNumber: contractNumber.trim(),
        billingFrequency,
        startDate,
        clientId: clientId || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Converted to recurring contract");
          setOpen(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Conversion failed"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Convert to recurring contract
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert to recurring contract</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Contract number</Label>
            <Input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} />
          </div>
          {!defaultClientId && (
            <div>
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
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
              <Label>Billing frequency</Label>
              <Select value={billingFrequency} onValueChange={(v) => setBillingFrequency(v as typeof billingFrequency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_off">One-off</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>
          {defaultValue != null && (
            <p className="text-xs text-muted-foreground">
              Contract value defaults to the request's estimated value ({formatCurrency(defaultValue)}).
            </p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={convert.isPending}>
            {convert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Convert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActivityTab({ requestId, canManage }: { requestId: string; canManage: boolean }) {
  const activitiesQ = useClientRequestActivities(requestId);
  const deleteActivity = useDeleteActivity(requestId);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Engagement timeline</div>
        {canManage && <LogActivityDialog requestId={requestId} />}
      </div>
      {activitiesQ.isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (activitiesQ.data ?? []).length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">
          No activity logged yet — record calls, emails and meetings here.
        </div>
      ) : (
        <div className="divide-y rounded-md border">
          {(activitiesQ.data ?? []).map((a) => (
            <div key={a.id} className="flex items-start gap-3 px-3 py-2">
              <Badge variant="secondary" className="mt-0.5">
                {ACTIVITY_TYPE_LABELS[a.type]}
              </Badge>
              <div className="flex-1 min-w-0">
                <div className="text-sm">{a.summary}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {new Date(a.occurred_at).toLocaleString()}
                  {a.created_by_name && ` · ${a.created_by_name}`}
                </div>
              </div>
              {canManage && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted-foreground"
                  onClick={() =>
                    deleteActivity.mutate(a.id, {
                      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete"),
                    })
                  }
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LogActivityDialog({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ClientRequestActivityType>("note");
  const [summary, setSummary] = useState("");
  const logActivity = useLogActivity(requestId);

  const submit = () => {
    if (!summary.trim()) {
      toast.error("Summary is required");
      return;
    }
    logActivity.mutate(
      { type, summary: summary.trim() },
      {
        onSuccess: () => {
          toast.success("Activity logged");
          setOpen(false);
          setSummary("");
          setType("note");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to log"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Log activity
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log engagement activity</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ClientRequestActivityType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACTIVITY_TYPE_LABELS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Summary</Label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={logActivity.isPending}>
            {logActivity.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Log
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
