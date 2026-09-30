import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import { RequireDepartmentAccess } from "@/components/require-role";
import { confirmDialog } from "@/components/confirm-dialog";
import { LoadError } from "@/components/load-error";
import { ActionHint } from "@/components/help-link";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { FormField, RequiredNote } from "@/components/form-field";
import { formatDate } from "@/lib/format-date";
import { promptDialog } from "@/components/prompt-dialog";
import { EditTenderDialog } from "@/features/tender/edit-tender-dialog";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/permissions";
import {
  useTender,
  useUpdateTenderStage,
  useDeleteTender,
  useConvertToContract,
  useTenderResources,
  useSaveTenderResource,
  useDeleteTenderResource,
  useTenderTimeEntries,
  useLogTime,
  useDeleteTimeEntry,
  useTenderCostSummary,
  useTenderBonds,
  useSaveTenderBond,
  useDeleteTenderBond,
  useTenderPricingItems,
  useSaveTenderPricingItem,
  useDeleteTenderPricingItem,
  useTenderFinancialsSummary,
  useTenderRequirements,
  useSaveTenderRequirement,
  useDeleteTenderRequirement,
  useApplyRequirementTemplate,
  useApplyLibraryDocument,
  useSaveRequirementsAsTemplate,
  useRequirementTemplates,
  TENDER_STAGES,
  TENDER_STAGE_LABELS,
  TENDER_STAGE_STYLES,
  TENDER_BOND_TYPE_LABELS,
  TENDER_BOND_STATUS_LABELS,
  TENDER_BOND_STATUS_STYLES,
  TENDER_REQUIREMENT_STATUS_LABELS,
  TENDER_REQUIREMENT_STATUS_STYLES,
  type TenderStage,
  type TenderBondType,
  type TenderBondStatus,
  type TenderRequirementStatus,
  type TenderRequirementRow,
} from "@/features/tender/use-tender";
import { useProfilesLite } from "@/features/clients/use-clients-contracts";
import { ForwardTenderDialog } from "@/features/tender/forward-tender-dialog";
import { ClientPicker } from "@/features/clients/client-picker";
import { formatCurrency } from "@/features/finance/finance";
import { AttachmentsPanel } from "@/features/documents/attachments-panel";
import { DocumentUploadDialog } from "@/features/documents/document-upload-dialog";
import {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
  downloadDocument,
  formatFileSize,
  type DocumentRow,
} from "@/features/documents/use-documents";
import { apiFetch } from "@/lib/api-client";
import { ShareDialog } from "@/features/permissions/share-dialog";
import { RelatedRecords, type RelatedRecordItem } from "@/components/related-records";
import { ActivityThread } from "@/features/activity/activity-thread";
import { EntityBreadcrumb, type BreadcrumbSegment } from "@/components/entity-breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { askLossReason, askWinReason } from "@/features/pipeline/stage-reasons";

const TENDER_TABS = [
  "resources",
  "financials",
  "requirements",
  "time",
  "documents",
  "activity",
] as const;

export const Route = createFileRoute("/_authenticated/tender/$tenderId")({
  validateSearch: z.object({ tab: z.enum(TENDER_TABS).optional().catch(undefined) }),
  head: () => ({ meta: [{ title: "Tender — AIMS" }] }),
  component: () => (
    <RequireDepartmentAccess
      code="tender"
      message="The Tender workspace is for the Tender team, people granted Tender access and the CEO."
    >
      <TenderDetail />
    </RequireDepartmentAccess>
  ),
});

function buildTenderRelated(tender: ReturnType<typeof useTender>["data"]): RelatedRecordItem[] {
  if (!tender) return [];
  const items: RelatedRecordItem[] = [];
  if (tender.contract_id) {
    items.push({
      label: "Contract",
      title: tender.contract_number ?? "Contract",
      to: `/clients/contracts/${tender.contract_id}`,
    });
  }
  if (tender.project_id) {
    items.push({
      label: "Delivery project",
      title: tender.project_name ?? "Project",
      to: `/projects/${tender.project_id}`,
    });
  }
  return items;
}

function buildTenderBreadcrumb(tender: ReturnType<typeof useTender>["data"]): BreadcrumbSegment[] {
  if (!tender) return [];
  return [{ label: "Tenders", to: "/tender" }, { label: tender.title }];
}

function TenderDetail() {
  const { tenderId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const perms = usePermissions();
  const tenderQ = useTender(tenderId);
  const updateStage = useUpdateTenderStage();
  const deleteTender = useDeleteTender();
  const [editing, setEditing] = useState(false);
  const [forwarding, setForwarding] = useState(false);

  if (tenderQ.isLoading) {
    return (
      <div className="py-12 flex justify-center" role="status" aria-label="Loading tender">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  const loadStatus = (tenderQ.error as { status?: number } | null)?.status;
  if (tenderQ.isError && loadStatus !== 404 && loadStatus !== 403) {
    return <LoadError what="this tender" error={tenderQ.error} onRetry={() => tenderQ.refetch()} />;
  }
  const tender = tenderQ.data;
  if (!tender) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-8 text-center">
        <p className="text-sm font-medium">
          This tender doesn't exist or you don't have access to it.
        </p>
        <Button size="sm" variant="outline" asChild>
          <Link to="/tender">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Tenders
          </Link>
        </Button>
      </div>
    );
  }

  const canManage = perms.canManageTenders;

  const changeStage = async (stage: TenderStage) => {
    if (stage === tender.stage && stage !== "won") return;
    if (stage === "lost" || stage === "withdrawn" || stage === "cancelled") {
      const reason = await askLossReason("tender", TENDER_STAGE_LABELS[stage]);
      if (reason === null) return;
      updateStage.mutate(
        { id: tender.id, stage, lost_reason: reason },
        { onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed") },
      );
      return;
    }
    if (stage === "won") {
      const today = new Date().toISOString().slice(0, 10);
      const input = await promptDialog({
        title: "Tender awarded",
        label: "Date awarded",
        required: true,
        inputType: "date",
        defaultValue: tender.won_at?.slice(0, 10) ?? today,
        confirmLabel: "Save award date",
      });
      if (input === null) return;
      const winReason = tender.stage === "won" ? (tender.won_reason ?? "") : await askWinReason();
      if (winReason === null) return;
      const newlyAwarded = tender.stage !== "won";
      updateStage.mutate(
        { id: tender.id, stage, won_at: input || today, won_reason: winReason || undefined },
        {
          onSuccess: () => {
            if (!newlyAwarded) return;
            toast.success("Marked as awarded");
            // Awarded work goes to a delivering department next.
            if (canManage && !tender.project_id) setForwarding(true);
          },
          onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed"),
        },
      );
      return;
    }
    updateStage.mutate(
      { id: tender.id, stage },
      { onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed") },
    );
  };

  const handleDelete = async () => {
    const ok = await confirmDialog({
      title: `Delete "${tender.title}"?`,
      description:
        "This removes the tender and everything tracked against it. This can't be undone.",
      confirmLabel: "Delete tender",
      destructive: true,
    });
    if (!ok) return;
    deleteTender.mutate(tender.id, {
      onSuccess: () => {
        toast.success("Tender deleted");
        navigate({ to: "/tender" });
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <EntityBreadcrumb segments={buildTenderBreadcrumb(tender)} />
        <div className="flex gap-1 shrink-0 flex-wrap">
          {canManage && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit tender
            </Button>
          )}
          {canManage && (
            <ShareDialog resource="tenders" resourceId={tender.id} recordLabel="tender" />
          )}
          {canManage && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              disabled={deleteTender.isPending}
              onClick={handleDelete}
            >
              {deleteTender.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1" />
              )}
              Delete tender
            </Button>
          )}
        </div>
      </div>

      {!canManage && <ViewOnlyBanner area="this tender" />}

      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">{tender.title}</h1>
            <div className="text-xs text-muted-foreground mt-0.5">
              {tender.department_name}
              {(tender.client_name ?? tender.prospect_client_name) &&
                ` · ${tender.client_name ?? tender.prospect_client_name}${!tender.client_name ? " (prospect)" : ""}`}
              {tender.service_line_name && ` · ${tender.service_line_name}`}
            </div>
            {tender.description && (
              <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{tender.description}</p>
            )}
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            {canManage ? (
              <div className="space-y-1">
                <Label htmlFor="tender-stage" className="text-xs text-muted-foreground">
                  Move to…
                </Label>
                <Select
                  value={tender.stage}
                  onValueChange={(v) => changeStage(v as TenderStage)}
                  disabled={updateStage.isPending}
                >
                  <SelectTrigger id="tender-stage" className="h-8 w-[180px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TENDER_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {TENDER_STAGE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <Badge className={TENDER_STAGE_STYLES[tender.stage]} variant="secondary">
                {TENDER_STAGE_LABELS[tender.stage]}
              </Badge>
            )}
            {tender.estimated_value != null && (
              <div className="text-sm font-semibold tabular-nums">
                {formatCurrency(tender.estimated_value, tender.currency)}
              </div>
            )}
            {tender.submission_deadline && (
              <div className="text-xs text-muted-foreground">
                Deadline {formatDate(tender.submission_deadline)}
              </div>
            )}
            {["lost", "withdrawn", "cancelled"].includes(tender.stage) && tender.lost_reason && (
              <div className="max-w-md text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Why it didn't go ahead:</span>{" "}
                {tender.lost_reason}
              </div>
            )}
            {tender.stage === "won" && tender.won_reason && (
              <div className="max-w-md text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Why we won:</span> {tender.won_reason}
              </div>
            )}
            {tender.stage === "won" && tender.won_at && (
              <div className="text-xs text-muted-foreground">
                Awarded {formatDate(tender.won_at)}
                {canManage && (
                  <button
                    type="button"
                    onClick={() => changeStage("won")}
                    className="ml-1.5 text-primary hover:underline"
                  >
                    Edit award date
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {tender.stage === "won" && (canManage || tender.project_id) && (
          <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-3">
            {tender.project_id ? (
              <Link
                to="/projects/$projectId"
                params={{ projectId: tender.project_id }}
                className="flex items-center gap-1 text-xs text-success underline hover:opacity-80"
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Forwarded: delivery
                project {tender.project_name ?? ""}
              </Link>
            ) : (
              <Button size="sm" onClick={() => setForwarding(true)}>
                <Send className="h-4 w-4 mr-1" /> Forward to department
              </Button>
            )}
            {tender.contract_id ? (
              <Link
                to="/clients/contracts/$id"
                params={{ id: tender.contract_id }}
                className="flex items-center gap-1 text-xs text-success underline hover:opacity-80"
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Contract{" "}
                {tender.contract_number ?? ""}
              </Link>
            ) : (
              canManage && (
                <ConvertToContractDialog
                  tenderId={tender.id}
                  defaultClientId={tender.client_id}
                  defaultValue={tender.estimated_value}
                />
              )
            )}
          </div>
        )}
        {["identified", "applying", "submitted"].includes(tender.stage) && canManage && (
          <ActionHint className="mt-3 pt-3 border-t" topic="forward tender to department">
            Once the tender is Awarded, you'll forward it to the department that delivers the work.
          </ActionHint>
        )}
      </div>

      <ForwardTenderDialog tender={tender} open={forwarding} onOpenChange={setForwarding} />

      <RelatedRecords
        items={buildTenderRelated(tender)}
        engagementTo={`/engagements/tender/${tender.id}`}
      />

      <Tabs defaultValue={tab ?? "resources"}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="time">Time tracking</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="resources">
          <ResourcesTab tenderId={tender.id} canManage={canManage} />
        </TabsContent>
        <TabsContent value="financials">
          <FinancialsTab
            tenderId={tender.id}
            canManage={canManage}
            estimatedValue={tender.estimated_value}
          />
        </TabsContent>
        <TabsContent value="requirements">
          <RequirementsTab tenderId={tender.id} canManage={canManage} />
        </TabsContent>
        <TabsContent value="time">
          <TimeTrackingTab tenderId={tender.id} canManage={canManage} />
        </TabsContent>
        <TabsContent value="documents">
          <AttachmentsPanel resourceType="tender" resourceId={tender.id} canManage={canManage} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityThread record={{ kind: "tender", id: tender.id }} canLog={canManage} />
        </TabsContent>
      </Tabs>

      {editing && <EditTenderDialog tender={tender} onClose={() => setEditing(false)} />}
    </div>
  );
}

function ResourcesTab({ tenderId, canManage }: { tenderId: string; canManage: boolean }) {
  const resourcesQ = useTenderResources(tenderId);
  const deleteResource = useDeleteTenderResource(tenderId);
  const removeResource = async (id: string, name: string) => {
    const ok = await confirmDialog({
      title: `Remove ${name} from this tender?`,
      description: "Their allocated hours and rate are removed from the budget.",
      confirmLabel: "Remove resource",
      destructive: true,
    });
    if (!ok) return;
    deleteResource.mutate(id, {
      onSuccess: () => toast.success("Resource removed"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to remove"),
    });
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Assigned resources</h2>
        {canManage && <AddResourceDialog tenderId={tenderId} />}
      </div>
      {resourcesQ.isError ? (
        <LoadError what="resources" error={resourcesQ.error} onRetry={() => resourcesQ.refetch()} />
      ) : resourcesQ.isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (resourcesQ.data ?? []).length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">
          No resources assigned yet.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Allocated hours</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              {canManage && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(resourcesQ.data ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-sm">{r.user_name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.role_note ?? "—"}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {r.allocated_hours ?? "—"}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {r.hourly_rate != null ? formatCurrency(r.hourly_rate) : "—"}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${r.user_name} from this tender`}
                      disabled={deleteResource.isPending}
                      onClick={() => removeResource(r.id, r.user_name)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function AddResourceDialog({ tenderId }: { tenderId: string }) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [roleNote, setRoleNote] = useState("");
  const [allocatedHours, setAllocatedHours] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [error, setError] = useState("");

  const profilesQ = useProfilesLite();
  const save = useSaveTenderResource(tenderId);

  const close = () => {
    setOpen(false);
    setUserId("");
    setRoleNote("");
    setAllocatedHours("");
    setHourlyRate("");
    setError("");
  };

  const submit = () => {
    if (!userId) {
      setError("Choose the person to assign.");
      return;
    }
    save.mutate(
      {
        user_id: userId,
        role_note: roleNote || undefined,
        allocated_hours: allocatedHours ? Number(allocatedHours) : undefined,
        hourly_rate: hourlyRate ? Number(hourlyRate) : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Resource assigned");
          close();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to assign"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" /> Assign resource
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
            <DialogTitle>Assign a resource</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <RequiredNote />
            <FormField id="resource-person" label="Person" required error={error}>
              <Select
                value={userId}
                onValueChange={(v) => {
                  setUserId(v);
                  setError("");
                }}
              >
                <SelectTrigger id="resource-person" aria-invalid={!!error}>
                  <SelectValue placeholder="Choose a person…" />
                </SelectTrigger>
                <SelectContent>
                  {(profilesQ.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name ?? p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="resource-role" label="Role on this tender">
              <Input
                id="resource-role"
                value={roleNote}
                onChange={(e) => setRoleNote(e.target.value)}
              />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField id="resource-hours" label="Allocated hours">
                <Input
                  id="resource-hours"
                  type="number"
                  min={0}
                  value={allocatedHours}
                  onChange={(e) => setAllocatedHours(e.target.value)}
                />
              </FormField>
              <FormField id="resource-rate" label="Hourly rate">
                <Input
                  id="resource-rate"
                  type="number"
                  min={0}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                />
              </FormField>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign resource
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TimeTrackingTab({ tenderId, canManage }: { tenderId: string; canManage: boolean }) {
  const entriesQ = useTenderTimeEntries(tenderId);
  const costQ = useTenderCostSummary(tenderId);
  const deleteEntry = useDeleteTimeEntry(tenderId);
  const { user } = useAuth();
  const removeEntry = async (id: string, label: string) => {
    const ok = await confirmDialog({
      title: "Delete this time entry?",
      description: `${label} will be removed and the tender's actual cost updated.`,
      confirmLabel: "Delete time entry",
      destructive: true,
    });
    if (!ok) return;
    deleteEntry.mutate(id, {
      onSuccess: () => toast.success("Time entry deleted"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete"),
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <CostCard
          label="Budgeted cost"
          value={costQ.data ? formatCurrency(costQ.data.budgeted_cost) : "—"}
        />
        <CostCard
          label="Actual cost"
          value={costQ.data ? formatCurrency(costQ.data.actual_cost) : "—"}
        />
        <CostCard
          label="Hours logged"
          value={costQ.data ? costQ.data.actual_hours.toLocaleString() : "—"}
        />
        <CostCard
          label="Unrated hours"
          value={costQ.data ? costQ.data.unrated_hours.toLocaleString() : "—"}
        />
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Time entries</h2>
          <LogTimeDialog tenderId={tenderId} />
        </div>
        {entriesQ.isError ? (
          <LoadError
            what="time entries"
            error={entriesQ.error}
            onRetry={() => entriesQ.refetch()}
          />
        ) : entriesQ.isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (entriesQ.data ?? []).length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center">No time logged yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Person</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(entriesQ.data ?? []).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs">{formatDate(e.entry_date)}</TableCell>
                  <TableCell className="text-xs">{e.user_name}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{e.hours}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.notes ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {(canManage || e.user_id === user?.id) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Delete time entry for ${e.user_name} on ${formatDate(e.entry_date)}`}
                        disabled={deleteEntry.isPending}
                        onClick={() =>
                          removeEntry(
                            e.id,
                            `${e.hours} hours by ${e.user_name} on ${formatDate(e.entry_date)}`,
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function CostCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function LogTimeDialog({ tenderId }: { tenderId: string }) {
  const today = () => new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [entryDate, setEntryDate] = useState(today);
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ entryDate?: string; hours?: string }>({});

  const logTime = useLogTime(tenderId);

  const close = () => {
    setOpen(false);
    setEntryDate(today());
    setHours("");
    setNotes("");
    setErrors({});
  };

  const submit = () => {
    const h = Number(hours);
    const next: typeof errors = {};
    if (!entryDate) next.entryDate = "Choose the day you worked.";
    if (!h || h <= 0) next.hours = "Enter the hours worked, e.g. 1.5.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    logTime.mutate(
      { entry_date: entryDate, hours: h, notes: notes || undefined },
      {
        onSuccess: () => {
          toast.success("Time logged");
          close();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to log time"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Log time
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
            <DialogTitle>Log time on this tender</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <RequiredNote />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField id="time-date" label="Date" required error={errors.entryDate}>
                <Input
                  id="time-date"
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  aria-invalid={!!errors.entryDate}
                />
              </FormField>
              <FormField id="time-hours" label="Hours" required error={errors.hours}>
                <Input
                  id="time-hours"
                  type="number"
                  step="0.25"
                  min={0}
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  aria-invalid={!!errors.hours}
                />
              </FormField>
            </div>
            <FormField id="time-notes" label="Notes">
              <Textarea
                id="time-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={logTime.isPending}>
              {logTime.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Log time
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConvertToContractDialog({
  tenderId,
  defaultClientId,
  defaultValue,
}: {
  tenderId: string;
  defaultClientId: string | null;
  defaultValue: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [contractNumber, setContractNumber] = useState("");
  const [billingFrequency, setBillingFrequency] = useState<
    "one_off" | "monthly" | "quarterly" | "annual"
  >("one_off");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [errors, setErrors] = useState<{
    contractNumber?: string;
    clientId?: string;
    startDate?: string;
  }>({});

  const convert = useConvertToContract();

  const close = () => {
    setOpen(false);
    setContractNumber("");
    setErrors({});
  };

  const submit = () => {
    const next: typeof errors = {};
    if (!contractNumber.trim()) next.contractNumber = "Enter the contract number.";
    if (!defaultClientId && !clientId)
      next.clientId = "A contract needs a client. Pick or create one.";
    if (!startDate) next.startDate = "Choose the start date.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    convert.mutate(
      {
        tenderId,
        contractNumber: contractNumber.trim(),
        billingFrequency,
        startDate,
        clientId: clientId || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Contract created");
          close();
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "The contract wasn't created"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Convert to contract
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
            <DialogTitle>Convert to contract</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <RequiredNote />
            <FormField
              id="contract-number"
              label="Contract number"
              required
              error={errors.contractNumber}
            >
              <Input
                id="contract-number"
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
                aria-invalid={!!errors.contractNumber}
              />
            </FormField>
            {!defaultClientId && (
              <FormField id="contract-client" label="Client" required error={errors.clientId}>
                <ClientPicker value={clientId} onChange={setClientId} />
              </FormField>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField id="contract-billing" label="Billing frequency" required>
                <Select
                  value={billingFrequency}
                  onValueChange={(v) => setBillingFrequency(v as typeof billingFrequency)}
                >
                  <SelectTrigger id="contract-billing">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_off">One-off</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="contract-start" label="Start date" required error={errors.startDate}>
                <Input
                  id="contract-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  aria-invalid={!!errors.startDate}
                />
              </FormField>
            </div>
            {defaultValue != null && (
              <p className="text-xs text-muted-foreground">
                Contract value is taken from the tender's estimate ({formatCurrency(defaultValue)}).
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={convert.isPending}>
              {convert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Convert to contract
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Financials tab ================= */

function FinancialsTab({
  tenderId,
  canManage,
  estimatedValue,
}: {
  tenderId: string;
  canManage: boolean;
  estimatedValue: number | null;
}) {
  const summaryQ = useTenderFinancialsSummary(tenderId);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <CostCard
          label="Cost to pursue"
          value={summaryQ.data ? formatCurrency(summaryQ.data.total_cost_to_pursue) : "—"}
        />
        <CostCard
          label="Bid price"
          value={summaryQ.data ? formatCurrency(summaryQ.data.bid_price) : "—"}
        />
        <CostCard
          label="Bonds"
          value={summaryQ.data ? formatCurrency(summaryQ.data.bonds_total) : "—"}
        />
        <CostCard
          label="Estimated value"
          value={estimatedValue != null ? formatCurrency(estimatedValue) : "—"}
        />
      </div>

      <BondsSection tenderId={tenderId} canManage={canManage} />
      <PricingItemsSection tenderId={tenderId} canManage={canManage} />
      <FinancialBreakdownSection tenderId={tenderId} canManage={canManage} />
    </div>
  );
}

const FINANCIAL_BREAKDOWN_TAG = "financial_breakdown";

function FinancialBreakdownSection({
  tenderId,
  canManage,
}: {
  tenderId: string;
  canManage: boolean;
}) {
  const documentsQ = useDocuments({
    resourceType: "tender",
    resourceId: tenderId,
    tag: FINANCIAL_BREAKDOWN_TAG,
  });
  const deleteDocument = useDeleteDocument();
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);
  const removeDocument = async (doc: DocumentRow) => {
    const ok = await confirmDialog({
      title: `Delete "${doc.title}"?`,
      description: "The file and all its versions are removed. This can't be undone.",
      confirmLabel: "Delete document",
      destructive: true,
    });
    if (!ok) return;
    deleteDocument.mutate(doc.id, {
      onSuccess: () => toast.success("Document deleted"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete"),
    });
  };
  const docs = documentsQ.data ?? [];

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Financial breakdown</h2>
          <div className="text-xs text-muted-foreground">
            Attach the pricing spreadsheet or document prepared for this bid.
          </div>
        </div>
        {canManage && <FinancialBreakdownUploadDialog tenderId={tenderId} />}
      </div>
      {documentsQ.isError ? (
        <LoadError
          what="financial breakdown files"
          error={documentsQ.error}
          onRetry={() => documentsQ.refetch()}
        />
      ) : documentsQ.isLoading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : docs.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">
          No financial breakdown uploaded yet.
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{doc.title}</div>
                <div className="text-xs text-muted-foreground">
                  {doc.latest_version ? formatFileSize(doc.latest_version.size_bytes) : "—"}
                  {" · "}
                  {formatDate(doc.created_at)}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Preview ${doc.title}`}
                  title="Preview"
                  onClick={() => setPreviewDoc(doc)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Download ${doc.title}`}
                  title="Download"
                  onClick={() =>
                    downloadDocument(doc).catch((err) =>
                      toast.error(err instanceof Error ? err.message : "Could not open file"),
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                </Button>
                {canManage && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${doc.title}`}
                    title="Delete"
                    disabled={deleteDocument.isPending}
                    onClick={() => removeDocument(doc)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <FinancialBreakdownPreviewDialog doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  );
}

function FinancialBreakdownUploadDialog({ tenderId }: { tenderId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const upload = useUploadDocument();

  const close = () => {
    setOpen(false);
    setTitle("");
    setFile(null);
    setError("");
  };

  const submit = () => {
    if (!file) {
      setError("Choose the file to upload.");
      return;
    }
    upload.mutate(
      {
        file,
        resourceType: "tender",
        resourceId: tenderId,
        title: title.trim() || undefined,
        category: "financial_breakdown",
        tags: [FINANCIAL_BREAKDOWN_TAG],
      },
      {
        onSuccess: () => {
          toast.success("Financial breakdown uploaded");
          close();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Upload failed"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="h-4 w-4 mr-1" /> Upload breakdown
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
            <DialogTitle>Upload financial breakdown</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <RequiredNote />
            <FormField
              id="breakdown-file"
              label="File"
              required
              error={error}
              hint="Excel, CSV, PDF or an image."
            >
              <Input
                id="breakdown-file"
                type="file"
                accept=".xlsx,.xls,.csv,.pdf,image/*"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setError("");
                }}
                aria-invalid={!!error}
              />
            </FormField>
            <FormField id="breakdown-title" label="Title" hint="Leave blank to use the file name.">
              <Input
                id="breakdown-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={upload.isPending}>
              {upload.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Upload breakdown
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type PreviewKind = "excel" | "pdf" | "image" | "unsupported";

function FinancialBreakdownPreviewDialog({
  doc,
  onClose,
}: {
  doc: DocumentRow | null;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [kind, setKind] = useState<PreviewKind | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!doc) {
      setRows(null);
      setBlobUrl(null);
      setKind(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await apiFetch(`/documents/${doc.id}/download`);
        if (!res.ok) throw new Error(`Could not open file (${res.status})`);
        const blob = await res.blob();
        if (cancelled) return;
        const fileName = doc.latest_version?.file_name ?? doc.title;
        const mime = doc.latest_version?.mime_type ?? blob.type;
        const isExcel =
          /\.(xlsx|xls|csv)$/i.test(fileName) || /spreadsheet|ms-excel|csv/i.test(mime ?? "");
        const isPdf = /\.pdf$/i.test(fileName) || mime === "application/pdf";
        const isImage = /^image\//.test(mime ?? "") || /\.(png|jpe?g|gif|webp)$/i.test(fileName);

        if (isExcel) {
          const buf = await blob.arrayBuffer();
          const wb = XLSX.read(buf, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
          if (cancelled) return;
          setRows(json.slice(0, 200));
          setKind("excel");
        } else if (isPdf || isImage) {
          setBlobUrl(URL.createObjectURL(blob));
          setKind(isPdf ? "pdf" : "image");
        } else {
          setKind("unsupported");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not preview this file");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const columns = rows && rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{doc?.title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-sm text-destructive py-8 text-center">{error}</div>
          ) : kind === "excel" ? (
            rows && rows.length > 0 ? (
              <div className="overflow-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/40 sticky top-0">
                    <tr>
                      {columns.map((c) => (
                        <th key={c} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t">
                        {columns.map((c) => (
                          <td key={c} className="px-2 py-1 whitespace-nowrap">
                            {String(r[c] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground py-8 text-center">
                This spreadsheet has no rows.
              </div>
            )
          ) : kind === "pdf" && blobUrl ? (
            <iframe
              src={blobUrl}
              className="h-[65vh] w-full rounded-md border"
              title="Financial breakdown preview"
            />
          ) : kind === "image" && blobUrl ? (
            <img src={blobUrl} alt={doc?.title} className="mx-auto max-w-full rounded-md border" />
          ) : (
            <div className="text-xs text-muted-foreground py-8 text-center">
              Preview isn't available for this file type — use Download instead.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close preview
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BondsSection({ tenderId, canManage }: { tenderId: string; canManage: boolean }) {
  const bondsQ = useTenderBonds(tenderId);
  const deleteBond = useDeleteTenderBond(tenderId);
  const removeBond = async (id: string, label: string) => {
    const ok = await confirmDialog({
      title: `Delete this ${label.toLowerCase()}?`,
      description: "It is removed from the tender's financials. This can't be undone.",
      confirmLabel: "Delete bond",
      destructive: true,
    });
    if (!ok) return;
    deleteBond.mutate(id, {
      onSuccess: () => toast.success("Bond deleted"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete"),
    });
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Bonds & security deposits</h2>
        {canManage && <BondDialog tenderId={tenderId} />}
      </div>
      {bondsQ.isError ? (
        <LoadError what="bonds" error={bondsQ.error} onRetry={() => bondsQ.refetch()} />
      ) : bondsQ.isLoading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (bondsQ.data ?? []).length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">No bonds recorded yet.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expiry</TableHead>
              {canManage && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(bondsQ.data ?? []).map((b) => (
              <TableRow key={b.id}>
                <TableCell className="text-sm">{TENDER_BOND_TYPE_LABELS[b.bond_type]}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{b.provider ?? "—"}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {formatCurrency(b.amount)}
                </TableCell>
                <TableCell>
                  <Badge className={TENDER_BOND_STATUS_STYLES[b.status]} variant="secondary">
                    {TENDER_BOND_STATUS_LABELS[b.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{formatDate(b.expiry_date)}</TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete ${TENDER_BOND_TYPE_LABELS[b.bond_type]} of ${formatCurrency(b.amount)}`}
                      disabled={deleteBond.isPending}
                      onClick={() => removeBond(b.id, TENDER_BOND_TYPE_LABELS[b.bond_type])}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function BondDialog({ tenderId }: { tenderId: string }) {
  const [open, setOpen] = useState(false);
  const [bondType, setBondType] = useState<TenderBondType>("bid_bond");
  const [amount, setAmount] = useState("");
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState<TenderBondStatus>("pending");
  const [expiryDate, setExpiryDate] = useState("");
  const [error, setError] = useState("");
  const save = useSaveTenderBond(tenderId);

  const close = () => {
    setOpen(false);
    setBondType("bid_bond");
    setAmount("");
    setProvider("");
    setStatus("pending");
    setExpiryDate("");
    setError("");
  };

  const submit = () => {
    if (!amount || Number(amount) <= 0) {
      setError("Enter the bond amount.");
      return;
    }
    save.mutate(
      {
        bond_type: bondType,
        amount: Number(amount),
        provider: provider || undefined,
        status,
        expiry_date: expiryDate || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Bond added");
          close();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" /> Add bond
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
            <DialogTitle>Add bond or security deposit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <RequiredNote />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField id="bond-type" label="Type" required>
                <Select value={bondType} onValueChange={(v) => setBondType(v as TenderBondType)}>
                  <SelectTrigger id="bond-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TENDER_BOND_TYPE_LABELS).map(([v, label]) => (
                      <SelectItem key={v} value={v}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="bond-amount" label="Amount" required error={error}>
                <Input
                  id="bond-amount"
                  type="number"
                  min={0}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError("");
                  }}
                  aria-invalid={!!error}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField id="bond-provider" label="Provider (bank)">
                <Input
                  id="bond-provider"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                />
              </FormField>
              <FormField id="bond-status" label="Status" required>
                <Select value={status} onValueChange={(v) => setStatus(v as TenderBondStatus)}>
                  <SelectTrigger id="bond-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TENDER_BOND_STATUS_LABELS).map(([v, label]) => (
                      <SelectItem key={v} value={v}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <FormField id="bond-expiry" label="Expiry date">
              <Input
                id="bond-expiry"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add bond
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PricingItemsSection({ tenderId, canManage }: { tenderId: string; canManage: boolean }) {
  const itemsQ = useTenderPricingItems(tenderId);
  const deleteItem = useDeleteTenderPricingItem(tenderId);
  const removeItem = async (id: string, description: string) => {
    const ok = await confirmDialog({
      title: `Delete "${description}"?`,
      description: "The line is removed and the bid price total updated.",
      confirmLabel: "Delete line item",
      destructive: true,
    });
    if (!ok) return;
    deleteItem.mutate(id, {
      onSuccess: () => toast.success("Line item deleted"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete"),
    });
  };
  const total = (itemsQ.data ?? []).reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Bid pricing breakdown</h2>
        {canManage && <PricingItemDialog tenderId={tenderId} />}
      </div>
      {itemsQ.isError ? (
        <LoadError what="pricing items" error={itemsQ.error} onRetry={() => itemsQ.refetch()} />
      ) : itemsQ.isLoading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (itemsQ.data ?? []).length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">No pricing items yet.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit price</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              {canManage && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(itemsQ.data ?? []).map((i) => (
              <TableRow key={i.id}>
                <TableCell className="text-sm">{i.description}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{i.quantity}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {formatCurrency(i.unit_price)}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {formatCurrency(i.quantity * i.unit_price)}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete ${i.description}`}
                      disabled={deleteItem.isPending}
                      onClick={() => removeItem(i.id, i.description)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="text-xs font-semibold" colSpan={3}>
                Bid price total
              </TableCell>
              <TableCell className="text-right text-xs font-semibold tabular-nums">
                {formatCurrency(total)}
              </TableCell>
              {canManage && <TableCell />}
            </TableRow>
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function PricingItemDialog({ tenderId }: { tenderId: string }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [errors, setErrors] = useState<{ description?: string; unitPrice?: string }>({});
  const save = useSaveTenderPricingItem(tenderId);

  const close = () => {
    setOpen(false);
    setDescription("");
    setQuantity("1");
    setUnitPrice("");
    setErrors({});
  };

  const submit = () => {
    const next: typeof errors = {};
    if (!description.trim()) next.description = "Describe the line item.";
    if (!unitPrice || Number(unitPrice) < 0) next.unitPrice = "Enter the unit price.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    save.mutate(
      {
        description: description.trim(),
        quantity: Number(quantity) || 1,
        unit_price: Number(unitPrice),
      },
      {
        onSuccess: () => {
          toast.success("Line item added");
          close();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" /> Add line item
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
            <DialogTitle>Add pricing line item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <RequiredNote />
            <FormField
              id="pricing-description"
              label="Description"
              required
              error={errors.description}
            >
              <Input
                id="pricing-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                aria-invalid={!!errors.description}
              />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField id="pricing-quantity" label="Quantity">
                <Input
                  id="pricing-quantity"
                  type="number"
                  min={0}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </FormField>
              <FormField
                id="pricing-unit-price"
                label="Unit price"
                required
                error={errors.unitPrice}
              >
                <Input
                  id="pricing-unit-price"
                  type="number"
                  min={0}
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  aria-invalid={!!errors.unitPrice}
                />
              </FormField>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add line item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Requirements tab ================= */

function RequirementsTab({ tenderId, canManage }: { tenderId: string; canManage: boolean }) {
  const reqsQ = useTenderRequirements(tenderId);
  const deleteReq = useDeleteTenderRequirement(tenderId);
  const saveReq = useSaveTenderRequirement(tenderId);
  const documentsQ = useDocuments({ resourceType: "tender", resourceId: tenderId });
  const [linkDialogFor, setLinkDialogFor] = useState<TenderRequirementRow | null>(null);
  const removeReq = async (r: TenderRequirementRow) => {
    const ok = await confirmDialog({
      title: `Delete "${r.title}"?`,
      description: "It is removed from this tender's checklist. Linked documents are kept.",
      confirmLabel: "Delete requirement",
      destructive: true,
    });
    if (!ok) return;
    deleteReq.mutate(r.id, {
      onSuccess: () => toast.success("Requirement deleted"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete"),
    });
  };

  const grouped = (reqsQ.data ?? []).reduce<Record<string, TenderRequirementRow[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold">Requirements checklist</h2>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <ApplyLibraryDocumentsDialog tenderId={tenderId} />
            <ApplyTemplateDialog tenderId={tenderId} requirementCount={(reqsQ.data ?? []).length} />
            <SaveAsTemplateDialog tenderId={tenderId} disabled={(reqsQ.data ?? []).length === 0} />
            <AddRequirementDialog tenderId={tenderId} />
          </div>
        )}
      </div>

      {reqsQ.isError ? (
        <LoadError what="requirements" error={reqsQ.error} onRetry={() => reqsQ.refetch()} />
      ) : reqsQ.isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (reqsQ.data ?? []).length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">
          No requirements yet — add one manually or apply a template.
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 capitalize">
              {category}
            </div>
            <div className="divide-y rounded-md border">
              {items.map((r) => {
                const linkedDoc = (documentsQ.data ?? []).find((d) => d.id === r.document_id);
                return (
                  <div key={r.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{r.title}</div>
                      {r.notes && <div className="text-xs text-muted-foreground">{r.notes}</div>}
                      {linkedDoc && (
                        <div className="flex items-center gap-1 text-xs text-primary">
                          <Paperclip className="h-3 w-3" aria-hidden="true" /> {linkedDoc.title}
                        </div>
                      )}
                    </div>
                    {canManage ? (
                      <Select
                        value={r.status}
                        onValueChange={(v) =>
                          saveReq.mutate(
                            { id: r.id, status: v as TenderRequirementStatus },
                            {
                              onError: (err) =>
                                toast.error(err instanceof Error ? err.message : "Update failed"),
                            },
                          )
                        }
                      >
                        <SelectTrigger
                          className="h-7 w-[130px] text-xs"
                          aria-label={`Status of ${r.title}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(TENDER_REQUIREMENT_STATUS_LABELS).map(([v, label]) => (
                            <SelectItem key={v} value={v}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge
                        className={TENDER_REQUIREMENT_STATUS_STYLES[r.status]}
                        variant="secondary"
                      >
                        {TENDER_REQUIREMENT_STATUS_LABELS[r.status]}
                      </Badge>
                    )}
                    {canManage && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setLinkDialogFor(r)}
                          aria-label={`Link a document to ${r.title}`}
                          title="Link document"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete ${r.title}`}
                          disabled={deleteReq.isPending}
                          onClick={() => removeReq(r)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      <LinkDocumentDialog
        tenderId={tenderId}
        requirement={linkDialogFor}
        onClose={() => setLinkDialogFor(null)}
      />
    </div>
  );
}

function AddRequirementDialog({ tenderId }: { tenderId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [error, setError] = useState("");
  const save = useSaveTenderRequirement(tenderId);

  const close = () => {
    setOpen(false);
    setTitle("");
    setCategory("general");
    setError("");
  };

  const submit = () => {
    if (!title.trim()) {
      setError("Name the requirement.");
      return;
    }
    save.mutate(
      { title: title.trim(), category: category.trim() || "general" },
      {
        onSuccess: () => {
          toast.success("Requirement added");
          close();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add requirement
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
            <DialogTitle>Add requirement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <RequiredNote />
            <FormField id="requirement-title" label="Requirement" required error={error}>
              <Input
                id="requirement-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setError("");
                }}
                placeholder="e.g. Tax compliance certificate"
                aria-invalid={!!error}
              />
            </FormField>
            <FormField id="requirement-category" label="Category">
              <Input
                id="requirement-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Legal"
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add requirement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ApplyTemplateDialog({
  tenderId,
  requirementCount,
}: {
  tenderId: string;
  requirementCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const templatesQ = useRequirementTemplates();
  const apply = useApplyRequirementTemplate(tenderId);

  const submit = () => {
    if (!templateId) return;
    apply.mutate(templateId, {
      onSuccess: () => {
        toast.success("Template applied");
        setOpen(false);
        setTemplateId("");
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to apply"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Apply template
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply a requirement template</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {(templatesQ.data ?? []).length === 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {requirementCount > 0
                  ? "No templates yet. Save this tender's requirements as the first one."
                  : "No templates yet. Add requirements to this tender, then save them as a template."}
              </p>
              {requirementCount > 0 && (
                <SaveAsTemplateDialog tenderId={tenderId} disabled={false} />
              )}
            </div>
          ) : (
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger aria-label="Template">
                <SelectValue placeholder="Choose a template…" />
              </SelectTrigger>
              <SelectContent>
                {(templatesQ.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.item_count} items)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={apply.isPending || !templateId}>
            {apply.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Apply template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApplyLibraryDocumentsDialog({ tenderId }: { tenderId: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const libraryQ = useDocuments({ resourceType: "tender_document_library" });
  const apply = useApplyLibraryDocument(tenderId);
  const library = libraryQ.data ?? [];

  const toggle = (id: string, checked: boolean) => {
    setSelected((cur) => (checked ? [...cur, id] : cur.filter((x) => x !== id)));
  };

  const submit = async () => {
    if (selected.length === 0) return;
    try {
      for (const id of selected) {
        await apply.mutateAsync(id);
      }
      toast.success(`${selected.length} document${selected.length === 1 ? "" : "s"} attached`);
      setOpen(false);
      setSelected([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to attach documents");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSelected([]);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Apply from document library
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply mandatory documents</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Tick which of the company&apos;s standard documents apply to this tender — each ticked
            document is attached here and marked obtained, no re-uploading needed.
          </p>
          {libraryQ.isError ? (
            <LoadError
              what="the document library"
              error={libraryQ.error}
              onRetry={() => libraryQ.refetch()}
            />
          ) : libraryQ.isLoading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : library.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              The mandatory documents library is empty. Add documents to it from{" "}
              <Link to="/tender/documents" className="text-primary underline">
                Tender documents
              </Link>{" "}
              first.
            </p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {library.map((doc) => (
                <label key={doc.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selected.includes(doc.id)}
                    onCheckedChange={(checked) => toggle(doc.id, checked === true)}
                  />
                  {doc.title}
                </label>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(false);
              setSelected([]);
            }}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={apply.isPending || selected.length === 0}>
            {apply.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Attach documents {selected.length > 0 ? `(${selected.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaveAsTemplateDialog({ tenderId, disabled }: { tenderId: string; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const save = useSaveRequirementsAsTemplate(tenderId);

  const close = () => {
    setOpen(false);
    setName("");
    setDescription("");
    setError("");
  };

  const submit = () => {
    if (!name.trim()) {
      setError("Name the template.");
      return;
    }
    save.mutate(
      { name: name.trim(), description: description || undefined },
      {
        onSuccess: () => {
          toast.success("Saved as template");
          close();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          Save as template
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
            <DialogTitle>Save requirements as a template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <RequiredNote />
            <FormField id="template-name" label="Template name" required error={error}>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                placeholder="e.g. Government tender standard requirements"
                aria-invalid={!!error}
              />
            </FormField>
            <FormField id="template-description" label="Description">
              <Textarea
                id="template-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LinkDocumentDialog({
  tenderId,
  requirement,
  onClose,
}: {
  tenderId: string;
  requirement: TenderRequirementRow | null;
  onClose: () => void;
}) {
  const documentsQ = useDocuments({ resourceType: "tender", resourceId: tenderId });
  const save = useSaveTenderRequirement(tenderId);

  const link = (documentId: string | null) => {
    if (!requirement) return;
    save.mutate(
      { id: requirement.id, document_id: documentId },
      {
        onSuccess: () => {
          toast.success(documentId ? "Document linked" : "Document unlinked");
          onClose();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to link"),
      },
    );
  };

  return (
    <Dialog open={!!requirement} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link a document to “{requirement?.title}”</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {documentsQ.isError ? (
            <LoadError
              what="this tender's documents"
              error={documentsQ.error}
              onRetry={() => documentsQ.refetch()}
            />
          ) : (documentsQ.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No documents attached to this tender yet.
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {(documentsQ.data ?? []).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => link(d.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/50"
                >
                  {d.title}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <DocumentUploadDialog
              resourceType="tender"
              resourceId={tenderId}
              trigger={
                <Button size="sm" variant="outline">
                  <Upload className="h-4 w-4 mr-1" /> Attach file
                </Button>
              }
            />
            {requirement?.document_id && (
              <Button size="sm" variant="ghost" onClick={() => link(null)}>
                Unlink current document
              </Button>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
