import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, Pencil, Rocket, Send, Trash2 } from "lucide-react";
import { usePermissions } from "@/lib/permissions";
import {
  useClientRequest,
  useRouteClientRequest,
  useUpdateClientRequestStage,
  useDeleteClientRequest,
  CLIENT_REQUEST_STAGES,
  CLIENT_REQUEST_STAGE_LABELS,
  CLIENT_REQUEST_STAGE_STYLES,
  SOURCE_LABELS,
  type ClientRequestRow,
  type ClientRequestStage,
} from "@/features/client-requests/use-client-requests";
import { useDepartments, useProfilesLite } from "@/features/clients/use-clients-contracts";
import { formatCurrency } from "@/features/finance/finance";
import { AttachmentsPanel } from "@/features/documents/attachments-panel";
import { RelatedRecords, type RelatedRecordItem } from "@/components/related-records";
import { ActivityThread } from "@/features/activity/activity-thread";
import { EntityBreadcrumb, type BreadcrumbSegment } from "@/components/entity-breadcrumb";
import { confirmDialog } from "@/components/confirm-dialog";
import { LoadError } from "@/components/load-error";
import { ActionHint } from "@/components/help-link";
import { FormField, RequiredNote } from "@/components/form-field";
import { EditRequestDialog } from "@/features/client-requests/edit-request-dialog";
import { StartProjectDialog } from "@/features/client-requests/start-project-dialog";
import { useClientRequestsBoardPath } from "@/features/client-requests/board-path";
import { ShareDialog } from "@/features/permissions/share-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { askLossReason } from "@/features/pipeline/stage-reasons";

export const Route = createFileRoute("/_authenticated/requests/$requestId")({
  head: () => ({ meta: [{ title: "Client request — AIMS" }] }),
  component: ClientRequestDetail,
});

function buildRequestRelated(request: ClientRequestRow | undefined): RelatedRecordItem[] {
  if (!request) return [];
  const items: RelatedRecordItem[] = [];
  if (request.converted_from_lead_id) {
    items.push({
      label: "Source lead",
      title: request.converted_from_lead_name ?? "Lead",
      to: "/marketing/leads",
    });
  }
  if (request.converted_project_id) {
    items.push({
      label: "Project",
      title: request.converted_project_name ?? "Project",
      to: `/projects/${request.converted_project_id}`,
    });
  }
  if (request.converted_contract_id) {
    items.push({
      label: "Contract",
      title: request.converted_contract_number ?? "Contract",
      to: `/clients/contracts/${request.converted_contract_id}`,
    });
  }
  return items;
}

function buildRequestBreadcrumb(
  request: ClientRequestRow | undefined,
  boardPath: string,
): BreadcrumbSegment[] {
  if (!request) return [];
  const segments: BreadcrumbSegment[] = [];
  if (request.converted_from_lead_id) {
    segments.push({ label: "Leads", to: "/marketing/leads" });
    segments.push({ label: request.converted_from_lead_name ?? "Lead", to: "/marketing/leads" });
  }
  segments.push({ label: "Client requests", to: boardPath });
  segments.push({ label: request.title });
  return segments;
}

const isClosed = (stage: ClientRequestStage) => stage === "lost" || stage === "withdrawn";

function ClientRequestDetail() {
  const { requestId } = Route.useParams();
  const navigate = useNavigate();
  const perms = usePermissions();
  const boardPath = useClientRequestsBoardPath();
  const requestQ = useClientRequest(requestId);
  const updateStage = useUpdateClientRequestStage();
  const deleteRequest = useDeleteClientRequest();
  const departmentsQ = useDepartments();
  const [editing, setEditing] = useState(false);
  const [starting, setStarting] = useState(false);

  if (requestQ.isLoading) {
    return (
      <div className="py-12 flex justify-center" role="status" aria-label="Loading client request">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  const status = (requestQ.error as { status?: number } | null)?.status;
  if (requestQ.isError && status !== 404 && status !== 403) {
    return (
      <LoadError
        what="this client request"
        error={requestQ.error}
        onRetry={() => requestQ.refetch()}
      />
    );
  }
  const request = requestQ.data;
  if (!request) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-8 text-center">
        <p className="text-sm font-medium">
          This client request doesn't exist or you don't have access to it.
        </p>
        <Button size="sm" variant="outline" asChild>
          <Link to={boardPath}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Client requests
          </Link>
        </Button>
      </div>
    );
  }

  const isIntake = perms.canManageIntake;
  const departmentCode =
    request.department_code ?? departmentsQ.data?.find((d) => d.id === request.department_id)?.code;
  const withDept = { department_code: departmentCode ?? null };
  const canManage = perms.canEditRequest(withDept);
  const canOnboard = perms.canOnboardRequest(withDept);
  const canMove = canManage && !!request.department_id;
  const started = !!request.converted_project_id || !!request.converted_contract_id;
  const closed = isClosed(request.stage);

  const offerStart = async () => {
    if (!canOnboard || started) return;
    const ok = await confirmDialog({
      title: "Start the project now?",
      description: `“${request.title}” is Won. Start its project now, or do it later from this page.`,
      confirmLabel: "Start project from request",
      cancelLabel: "Later",
    });
    if (ok) setStarting(true);
  };

  const changeStage = async (stage: ClientRequestStage) => {
    if (stage === request.stage) return;
    const reason = isClosed(stage)
      ? await askLossReason("request", CLIENT_REQUEST_STAGE_LABELS[stage])
      : undefined;
    if (reason === null) return;
    updateStage.mutate(
      { id: request.id, stage, lost_reason: reason },
      {
        onSuccess: () => {
          toast.success(`Moved to ${CLIENT_REQUEST_STAGE_LABELS[stage]}`);
          if (stage === "won") void offerStart();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "The move didn't save"),
      },
    );
  };

  const handleDelete = async () => {
    const ok = await confirmDialog({
      title: `Delete "${request.title}"?`,
      description: "This removes the request and its activity. This can't be undone.",
      confirmLabel: "Delete client request",
      destructive: true,
    });
    if (!ok) return;
    deleteRequest.mutate(request.id, {
      onSuccess: () => {
        toast.success("Client request deleted");
        navigate({ to: boardPath });
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <EntityBreadcrumb segments={buildRequestBreadcrumb(request, boardPath)} />
        <div className="flex gap-1 shrink-0 flex-wrap">
          {canManage && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit request
            </Button>
          )}
          {canManage && (
            <ShareDialog resource="client-requests" resourceId={request.id} recordLabel="request" />
          )}
          {perms.canManageIntake && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              disabled={deleteRequest.isPending}
              onClick={handleDelete}
            >
              {deleteRequest.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1" />
              )}
              Delete request
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">{request.title}</h1>
            <div className="text-xs text-muted-foreground mt-0.5">
              {request.department_name ?? "Not routed yet"}
              {(request.client_name ?? request.prospect_client_name) &&
                ` · ${request.client_name ?? request.prospect_client_name}${!request.client_name ? " (prospect)" : ""}`}
              {request.service_line_name && ` · ${request.service_line_name}`}
              {` · via ${SOURCE_LABELS[request.source]}`}
            </div>
            {(request.contact_name || request.contact_email || request.contact_phone) && (
              <div className="text-xs text-muted-foreground mt-1">
                {[request.contact_name, request.contact_email, request.contact_phone]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
            {request.description && (
              <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{request.description}</p>
            )}
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            {canMove ? (
              <div className="space-y-1">
                <Label htmlFor="request-stage" className="text-xs text-muted-foreground">
                  Move to…
                </Label>
                <Select
                  value={request.stage}
                  onValueChange={(v) => changeStage(v as ClientRequestStage)}
                  disabled={updateStage.isPending}
                >
                  <SelectTrigger id="request-stage" className="h-8 w-[180px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_REQUEST_STAGES.filter(
                      (s) => s !== "new" || request.stage === "new",
                    ).map((s) => (
                      <SelectItem key={s} value={s}>
                        {CLIENT_REQUEST_STAGE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <Badge className={CLIENT_REQUEST_STAGE_STYLES[request.stage]} variant="secondary">
                  {CLIENT_REQUEST_STAGE_LABELS[request.stage]}
                </Badge>
                <ActionHint className="max-w-xs sm:text-right">
                  {!canManage
                    ? "Only Operations and the owning department can move requests."
                    : "Route this request to a department before moving it."}
                </ActionHint>
              </>
            )}
            {request.estimated_value != null && (
              <div className="text-sm font-semibold tabular-nums">
                {formatCurrency(request.estimated_value, request.currency)}
              </div>
            )}
            {request.assigned_to_name && (
              <div className="text-xs text-muted-foreground">
                Assigned to {request.assigned_to_name}
              </div>
            )}
          </div>
        </div>

        {!request.department_id && isIntake && (
          <div className="mt-3 pt-3 border-t">
            <RouteDialog requestId={request.id} />
          </div>
        )}

        {closed && request.lost_reason && (
          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Why it didn't go ahead:</span>{" "}
            {request.lost_reason}
          </div>
        )}

        {started ? (
          <div className="mt-3 pt-3 border-t text-xs text-success space-y-1">
            {request.converted_project_id && (
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Project started:{" "}
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: request.converted_project_id }}
                  className="underline hover:opacity-80"
                >
                  {request.converted_project_name ?? "open project"}
                </Link>
              </div>
            )}
            {request.converted_contract_id && (
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Contract:{" "}
                <Link
                  to="/clients/contracts/$id"
                  params={{ id: request.converted_contract_id }}
                  className="underline hover:opacity-80"
                >
                  {request.converted_contract_number ?? "open contract"}
                </Link>
              </div>
            )}
          </div>
        ) : (
          !closed &&
          request.department_id && (
            <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {canOnboard ? (
                request.stage === "won" ? (
                  <Button size="sm" onClick={() => setStarting(true)}>
                    <Rocket className="h-4 w-4 mr-1" /> Start project from request
                  </Button>
                ) : (
                  <>
                    <Button size="sm" variant="outline" disabled>
                      <Rocket className="h-4 w-4 mr-1" /> Start project from request
                    </Button>
                    <ActionHint topic="start project from request">
                      You can start the project once the request is Won.
                    </ActionHint>
                  </>
                )
              ) : (
                <ActionHint topic="start project from request">
                  Only the {request.department_name ?? "owning department's"} team can start the
                  project from this request.
                </ActionHint>
              )}
            </div>
          )
        )}
      </div>

      <RelatedRecords
        items={buildRequestRelated(request)}
        engagementTo={`/engagements/request/${request.id}`}
      />

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
        <TabsContent value="activity">
          <ActivityTab requestId={request.id} canManage={canManage} />
        </TabsContent>
        <TabsContent value="documents">
          <AttachmentsPanel
            resourceType="client_request"
            resourceId={request.id}
            canManage={canManage}
          />
        </TabsContent>
      </Tabs>

      {editing && <EditRequestDialog request={request} onClose={() => setEditing(false)} />}
      <StartProjectDialog
        request={request}
        open={starting}
        onOpenChange={(o) => !o && setStarting(false)}
      />
    </div>
  );
}

function RouteDialog({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const [departmentId, setDepartmentId] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [error, setError] = useState("");
  const departmentsQ = useDepartments();
  const profilesQ = useProfilesLite();
  const route = useRouteClientRequest();

  const close = () => {
    setOpen(false);
    setDepartmentId("");
    setAssignedToId("");
    setError("");
  };

  const submit = () => {
    if (!departmentId) {
      setError("Choose the department that will handle this request.");
      return;
    }
    route.mutate(
      { id: requestId, department_id: departmentId, assigned_to_id: assignedToId || undefined },
      {
        onSuccess: () => {
          const name = departmentsQ.data?.find((d) => d.id === departmentId)?.name;
          toast.success(name ? `Routed to ${name}` : "Client request routed");
          close();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Routing didn't save"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Send className="h-4 w-4 mr-1" /> Route to department
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Route to department</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <RequiredNote />
            <FormField id="route-department" label="Department" required error={error}>
              <Select
                value={departmentId}
                onValueChange={(v) => {
                  setDepartmentId(v);
                  setError("");
                }}
              >
                <SelectTrigger id="route-department" aria-invalid={!!error}>
                  <SelectValue placeholder="Choose a department…" />
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
            </FormField>
            <FormField id="route-assignee" label="Assign to" hint="Optional.">
              <Select
                value={assignedToId || "__none__"}
                onValueChange={(v) => setAssignedToId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger id="route-assignee">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {(profilesQ.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name ?? p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={route.isPending}>
              {route.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Route to department
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ActivityTab({ requestId, canManage }: { requestId: string; canManage: boolean }) {
  return (
    <ActivityThread
      record={{ kind: "client_request", id: requestId }}
      canLog={canManage}
      readOnlyReason="Only the people working on this request can add activity."
    />
  );
}
