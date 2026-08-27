import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, Upload, Eye, Download } from "lucide-react";
import { RequireRole } from "@/components/require-role";
import { confirmDialog } from "@/components/confirm-dialog";
import { useAuth } from "@/lib/auth";
import {
  useTender,
  useUpdateTenderStage,
  useSaveTender,
  useDeleteTender,
  useConvertToContract,
  useConvertTenderToProject,
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
  type TenderRow,
} from "@/features/tender/use-tender";
import { useEligibleDepartments, useProfilesLite } from "@/features/clients/use-clients-contracts";
import { useClients, useServiceLines } from "@/features/finance/use-finance-data";
import { ClientPicker } from "@/features/clients/client-picker";
import { formatCurrency } from "@/features/finance/finance";
import { AttachmentsPanel } from "@/features/documents/attachments-panel";
import {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
  downloadDocument,
  formatFileSize,
  type DocumentRow,
} from "@/features/documents/use-documents";
import { apiFetch } from "@/lib/api-client";
import { RelatedRecords, type RelatedRecordItem } from "@/components/related-records";
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

export const Route = createFileRoute("/_authenticated/tender/$tenderId")({
  head: () => ({ meta: [{ title: "Tender — AIMS" }] }),
  component: () => (
    <RequireRole
      roles={["tender"]}
      message="The Tender workspace is restricted to the Tender team, CEO and System Administrator."
    >
      <TenderDetail />
    </RequireRole>
  ),
});

function buildTenderRelated(tender: ReturnType<typeof useTender>["data"]): RelatedRecordItem[] {
  if (!tender) return [];
  const items: RelatedRecordItem[] = [];
  if (tender.contract_id) {
    items.push({
      label: "Converted Contract",
      title: tender.contract_number ?? "Contract",
      to: `/clients/contracts/${tender.contract_id}`,
    });
  }
  if (tender.project_id) {
    items.push({
      label: "Delivery Project",
      title: tender.project_name ?? "Project",
      to: `/projects/${tender.project_id}`,
    });
  }
  return items;
}

function buildTenderBreadcrumb(tender: ReturnType<typeof useTender>["data"]): BreadcrumbSegment[] {
  if (!tender) return [];
  return [{ label: "Tender Records", to: "/tender" }, { label: tender.title }];
}

function TenderDetail() {
  const { tenderId } = Route.useParams();
  const navigate = useNavigate();
  const { hasRole, isAdminOrCeo } = useAuth();
  const tenderQ = useTender(tenderId);
  const updateStage = useUpdateTenderStage();
  const deleteTender = useDeleteTender();
  const [editing, setEditing] = useState(false);

  if (tenderQ.isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  const tender = tenderQ.data;
  if (!tender) return <div className="text-sm text-muted-foreground">Tender not found.</div>;

  const canManage = isAdminOrCeo || hasRole(["finance", "hr", "it", "marketing", "tender"]);

  const changeStage = (stage: TenderStage) => {
    if (stage === "lost" || stage === "cancelled") {
      const reason =
        window.prompt(
          stage === "lost"
            ? "Reason the tender was lost (optional):"
            : "Reason the tender was cancelled (optional):",
        ) ?? undefined;
      updateStage.mutate(
        { id: tender.id, stage, lost_reason: reason },
        { onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed") },
      );
      return;
    }
    if (stage === "won") {
      const today = new Date().toISOString().slice(0, 10);
      const input = window.prompt("Date awarded (YYYY-MM-DD):", today);
      if (input === null) return; // cancelled
      updateStage.mutate(
        { id: tender.id, stage, won_at: input.trim() || today },
        { onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed") },
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
      confirmLabel: "Delete",
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
      <div className="flex items-start justify-between gap-2">
        <EntityBreadcrumb segments={buildTenderBreadcrumb(tender)} />
        <div className="flex gap-1 shrink-0">
          {canManage && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
            </Button>
          )}
          {isAdminOrCeo && (
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
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
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
          <div className="flex flex-col items-end gap-2">
            {canManage ? (
              <Select value={tender.stage} onValueChange={(v) => changeStage(v as TenderStage)}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
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
                Deadline {tender.submission_deadline}
              </div>
            )}
            {tender.stage === "won" && tender.won_at && (
              <div className="text-xs text-muted-foreground">
                Awarded {tender.won_at.slice(0, 10)}
                {canManage && (
                  <button
                    type="button"
                    onClick={() => changeStage("won")}
                    className="ml-1.5 text-primary hover:underline"
                    title="Change the awarded date"
                  >
                    Edit
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {tender.stage === "won" && canManage && (
          <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-3">
            {tender.project_id ? (
              <Link
                to="/projects/$projectId"
                params={{ projectId: tender.project_id }}
                className="text-xs text-success underline hover:opacity-80"
              >
                Forwarded to delivery project {tender.project_name ?? ""} →
              </Link>
            ) : (
              <ConvertToProjectDialog
                tenderId={tender.id}
                defaultClientId={tender.client_id}
                prospectClientName={tender.prospect_client_name}
              />
            )}
            {tender.contract_id ? (
              <Link
                to="/clients/contracts/$id"
                params={{ id: tender.contract_id }}
                className="text-xs text-success underline hover:opacity-80"
              >
                Converted to contract {tender.contract_number ?? tender.contract_id} →
              </Link>
            ) : (
              <ConvertToContractDialog
                tenderId={tender.id}
                defaultClientId={tender.client_id}
                defaultValue={tender.estimated_value}
              />
            )}
          </div>
        )}
      </div>

      <RelatedRecords
        items={buildTenderRelated(tender)}
        engagementTo={`/engagements/tender/${tender.id}`}
      />

      <Tabs defaultValue="resources">
        <TabsList>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="time">Time tracking</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
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
      </Tabs>

      {editing && <EditTenderDialog tender={tender} onClose={() => setEditing(false)} />}
    </div>
  );
}

function EditTenderDialog({ tender, onClose }: { tender: TenderRow; onClose: () => void }) {
  const [title, setTitle] = useState(tender.title);
  const [departmentId, setDepartmentId] = useState(tender.department_id);
  const [clientMode, setClientMode] = useState<"existing" | "prospect">(
    tender.client_id ? "existing" : "prospect",
  );
  const [clientId, setClientId] = useState(tender.client_id ?? "");
  const [prospectClientName, setProspectClientName] = useState(tender.prospect_client_name ?? "");
  const [serviceLineId, setServiceLineId] = useState(tender.service_line_id ?? "");
  const [estimatedValue, setEstimatedValue] = useState(
    tender.estimated_value != null ? String(tender.estimated_value) : "",
  );
  const [submissionDeadline, setSubmissionDeadline] = useState(tender.submission_deadline ?? "");
  const [description, setDescription] = useState(tender.description ?? "");

  const departmentsQ = useEligibleDepartments();
  const clientsQ = useClients();
  const serviceLinesQ = useServiceLines();
  const save = useSaveTender();

  const submit = () => {
    if (!title.trim() || !departmentId) {
      toast.error("Title and department are required");
      return;
    }
    save.mutate(
      {
        id: tender.id,
        title: title.trim(),
        department_id: departmentId,
        client_id: clientMode === "existing" ? clientId || undefined : undefined,
        prospect_client_name:
          clientMode === "prospect" ? prospectClientName.trim() || undefined : undefined,
        service_line_id: serviceLineId || undefined,
        estimated_value: estimatedValue ? Number(estimatedValue) : undefined,
        submission_deadline: submissionDeadline || undefined,
        description: description || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Tender updated");
          onClose();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit tender</DialogTitle>
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
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResourcesTab({ tenderId, canManage }: { tenderId: string; canManage: boolean }) {
  const resourcesQ = useTenderResources(tenderId);
  const deleteResource = useDeleteTenderResource(tenderId);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Assigned resources</div>
        {canManage && <AddResourceDialog tenderId={tenderId} />}
      </div>
      {resourcesQ.isLoading ? (
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
                      onClick={() =>
                        deleteResource.mutate(r.id, {
                          onError: (err) =>
                            toast.error(err instanceof Error ? err.message : "Failed to remove"),
                        })
                      }
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

  const profilesQ = useProfilesLite();
  const save = useSaveTenderResource(tenderId);

  const submit = () => {
    if (!userId) {
      toast.error("Choose a person to assign");
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
          setOpen(false);
          setUserId("");
          setRoleNote("");
          setAllocatedHours("");
          setHourlyRate("");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to assign"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" /> Assign resource
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign a resource</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Person</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
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
          <div>
            <Label>Role note (optional)</Label>
            <Input value={roleNote} onChange={(e) => setRoleNote(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Allocated hours</Label>
              <Input
                type="number"
                value={allocatedHours}
                onChange={(e) => setAllocatedHours(e.target.value)}
              />
            </div>
            <div>
              <Label>Hourly rate</Label>
              <Input
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TimeTrackingTab({ tenderId, canManage }: { tenderId: string; canManage: boolean }) {
  const entriesQ = useTenderTimeEntries(tenderId);
  const costQ = useTenderCostSummary(tenderId);
  const deleteEntry = useDeleteTimeEntry(tenderId);
  const { user } = useAuth();

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
          <div className="text-sm font-semibold">Time entries</div>
          <LogTimeDialog tenderId={tenderId} />
        </div>
        {entriesQ.isLoading ? (
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
                  <TableCell className="text-xs">{e.entry_date}</TableCell>
                  <TableCell className="text-xs">{e.user_name}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{e.hours}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.notes ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {(canManage || e.user_id === user?.id) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          deleteEntry.mutate(e.id, {
                            onError: (err) =>
                              toast.error(err instanceof Error ? err.message : "Failed to delete"),
                          })
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
  const [open, setOpen] = useState(false);
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");

  const logTime = useLogTime(tenderId);

  const submit = () => {
    const h = Number(hours);
    if (!h || h <= 0) {
      toast.error("Enter the hours worked");
      return;
    }
    logTime.mutate(
      { entry_date: entryDate, hours: h, notes: notes || undefined },
      {
        onSuccess: () => {
          toast.success("Time logged");
          setOpen(false);
          setHours("");
          setNotes("");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to log time"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Log time
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log time</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </div>
            <div>
              <Label>Hours</Label>
              <Input
                type="number"
                step="0.25"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={logTime.isPending}>
            {logTime.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Log time
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConvertToProjectDialog({
  tenderId,
  defaultClientId,
  prospectClientName,
}: {
  tenderId: string;
  defaultClientId: string | null;
  prospectClientName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const convert = useConvertTenderToProject();

  const submit = () => {
    if (!defaultClientId && !clientId) {
      toast.error("Choose a client — a delivery project needs a real client on file");
      return;
    }
    convert.mutate(
      { tenderId, name: name.trim() || undefined, clientId: clientId || undefined },
      {
        onSuccess: () => {
          toast.success("Forwarded to a delivery project");
          setOpen(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Conversion failed"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Forward to department (project)</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Forward to department as a delivery project</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Project name (optional)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Defaults to tender title"
            />
          </div>
          {!defaultClientId && (
            <div>
              <Label>Client</Label>
              <ClientPicker value={clientId} onChange={setClientId} />
              {prospectClientName && !clientId && (
                <p className="text-xs text-muted-foreground mt-1">
                  This tender was tracked against prospect "{prospectClientName}" — create or select
                  their real client record to proceed.
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={convert.isPending}>
            {convert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Forward
          </Button>
        </DialogFooter>
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

  const convert = useConvertToContract();

  const submit = () => {
    if (!contractNumber.trim()) {
      toast.error("Contract number is required");
      return;
    }
    if (!defaultClientId && !clientId) {
      toast.error("Choose a client — a contract needs a real client on file");
      return;
    }
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
          toast.success("Converted to contract");
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
          Convert to contract
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert to contract</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Contract number</Label>
            <Input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} />
          </div>
          {!defaultClientId && (
            <div>
              <Label>Client</Label>
              <ClientPicker value={clientId} onChange={setClientId} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Billing frequency</Label>
              <Select
                value={billingFrequency}
                onValueChange={(v) => setBillingFrequency(v as typeof billingFrequency)}
              >
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
              Contract value defaults to the tender's estimated value (
              {formatCurrency(defaultValue)}).
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
  const docs = documentsQ.data ?? [];

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Financial breakdown upload</div>
          <div className="text-xs text-muted-foreground">
            Attach the pricing spreadsheet or document prepared for this bid.
          </div>
        </div>
        {canManage && <FinancialBreakdownUploadDialog tenderId={tenderId} />}
      </div>
      {documentsQ.isLoading ? (
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
                  {new Date(doc.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  title="Preview"
                  onClick={() => setPreviewDoc(doc)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
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
                    title="Delete"
                    onClick={() =>
                      deleteDocument.mutate(doc.id, {
                        onError: (err) =>
                          toast.error(err instanceof Error ? err.message : "Failed to delete"),
                      })
                    }
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
  const upload = useUploadDocument();

  const submit = () => {
    if (!file) {
      toast.error("Choose a file to upload");
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
          setOpen(false);
          setTitle("");
          setFile(null);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Upload failed"),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setTitle("");
          setFile(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="h-4 w-4 mr-1" /> Upload breakdown
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload financial breakdown</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title (optional)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Defaults to the file name"
            />
          </div>
          <div>
            <Label>File</Label>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv,.pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={upload.isPending}>
            {upload.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Upload
          </Button>
        </DialogFooter>
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
      </DialogContent>
    </Dialog>
  );
}

function BondsSection({ tenderId, canManage }: { tenderId: string; canManage: boolean }) {
  const bondsQ = useTenderBonds(tenderId);
  const deleteBond = useDeleteTenderBond(tenderId);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Bonds & security deposits</div>
        {canManage && <BondDialog tenderId={tenderId} />}
      </div>
      {bondsQ.isLoading ? (
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
                <TableCell className="text-xs">{b.expiry_date ?? "—"}</TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        deleteBond.mutate(b.id, {
                          onError: (err) =>
                            toast.error(err instanceof Error ? err.message : "Failed to delete"),
                        })
                      }
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
  const save = useSaveTenderBond(tenderId);

  const submit = () => {
    if (!amount) {
      toast.error("Amount is required");
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
          setOpen(false);
          setAmount("");
          setProvider("");
          setExpiryDate("");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" /> Add bond
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add bond / security deposit</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={bondType} onValueChange={(v) => setBondType(v as TenderBondType)}>
                <SelectTrigger>
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
            </div>
            <div>
              <Label>Amount</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Provider (bank)</Label>
              <Input value={provider} onChange={(e) => setProvider(e.target.value)} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TenderBondStatus)}>
                <SelectTrigger>
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
            </div>
          </div>
          <div>
            <Label>Expiry date</Label>
            <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PricingItemsSection({ tenderId, canManage }: { tenderId: string; canManage: boolean }) {
  const itemsQ = useTenderPricingItems(tenderId);
  const deleteItem = useDeleteTenderPricingItem(tenderId);
  const total = (itemsQ.data ?? []).reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Bid pricing breakdown</div>
        {canManage && <PricingItemDialog tenderId={tenderId} />}
      </div>
      {itemsQ.isLoading ? (
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
                      onClick={() =>
                        deleteItem.mutate(i.id, {
                          onError: (err) =>
                            toast.error(err instanceof Error ? err.message : "Failed to delete"),
                        })
                      }
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
  const save = useSaveTenderPricingItem(tenderId);

  const submit = () => {
    if (!description.trim() || !unitPrice) {
      toast.error("Description and unit price are required");
      return;
    }
    save.mutate(
      {
        description: description.trim(),
        quantity: Number(quantity) || 1,
        unit_price: Number(unitPrice),
      },
      {
        onSuccess: () => {
          toast.success("Pricing item added");
          setOpen(false);
          setDescription("");
          setQuantity("1");
          setUnitPrice("");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" /> Add line item
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add pricing line item</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantity</Label>
              <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div>
              <Label>Unit price</Label>
              <Input
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add
          </Button>
        </DialogFooter>
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

  const grouped = (reqsQ.data ?? []).reduce<Record<string, TenderRequirementRow[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-semibold">Requirements checklist</div>
        {canManage && (
          <div className="flex gap-2">
            <ApplyLibraryDocumentsDialog tenderId={tenderId} />
            <ApplyTemplateDialog tenderId={tenderId} />
            <SaveAsTemplateDialog tenderId={tenderId} disabled={(reqsQ.data ?? []).length === 0} />
            <AddRequirementDialog tenderId={tenderId} />
          </div>
        )}
      </div>

      {reqsQ.isLoading ? (
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
                        <div className="text-xs text-primary">📎 {linkedDoc.title}</div>
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
                        <SelectTrigger className="h-7 w-[130px] text-xs">
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
                          title="Link document"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            deleteReq.mutate(r.id, {
                              onError: (err) =>
                                toast.error(
                                  err instanceof Error ? err.message : "Failed to delete",
                                ),
                            })
                          }
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
  const save = useSaveTenderRequirement(tenderId);

  const submit = () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    save.mutate(
      { title: title.trim(), category: category.trim() || "general" },
      {
        onSuccess: () => {
          toast.success("Requirement added");
          setOpen(false);
          setTitle("");
          setCategory("general");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add requirement
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add requirement</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Tax compliance certificate"
            />
          </div>
          <div>
            <Label>Category</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Legal"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApplyTemplateDialog({ tenderId }: { tenderId: string }) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const templatesQ = useRequirementTemplates();
  const apply = useApplyRequirementTemplate(tenderId);

  const submit = () => {
    if (!templateId) {
      toast.error("Choose a template");
      return;
    }
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
            <p className="text-xs text-muted-foreground">
              No templates yet — save a tender's requirements as a template first.
            </p>
          ) : (
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template…" />
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
          <Button onClick={submit} disabled={apply.isPending || !templateId}>
            {apply.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Apply
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
    if (selected.length === 0) {
      toast.error("Tick at least one document");
      return;
    }
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
          {libraryQ.isLoading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : library.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              The mandatory documents library is empty — add documents to it from the Tender
              Documents page first.
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
          <Button onClick={submit} disabled={apply.isPending || selected.length === 0}>
            {apply.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Attach {selected.length > 0 ? `(${selected.length})` : ""}
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
  const save = useSaveRequirementsAsTemplate(tenderId);

  const submit = () => {
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }
    save.mutate(
      { name: name.trim(), description: description || undefined },
      {
        onSuccess: () => {
          toast.success("Saved as template");
          setOpen(false);
          setName("");
          setDescription("");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          Save as template
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save requirements as a template</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Template name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Government tender standard requirements"
            />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save template
          </Button>
        </DialogFooter>
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
          <DialogTitle>Link a document — {requirement?.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {(documentsQ.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No documents attached to this tender yet — attach one from the Documents tab first.
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {(documentsQ.data ?? []).map((d) => (
                <button
                  key={d.id}
                  onClick={() => link(d.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/50"
                >
                  {d.title}
                </button>
              ))}
            </div>
          )}
          {requirement?.document_id && (
            <Button size="sm" variant="ghost" onClick={() => link(null)}>
              Unlink current document
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
