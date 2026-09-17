import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronDown, Loader2, Plus, Repeat, Target } from "lucide-react";
import {
  useContracts,
  useDepartments,
  useEligibleDepartments,
} from "@/features/clients/use-clients-contracts";
import { useServiceLines } from "@/features/finance/use-finance-data";
import { ClientPicker } from "@/features/clients/client-picker";
import {
  ContractFormDialog,
  emptyContractDraft,
  type ContractDraft,
} from "@/features/clients/contract-form-dialog";
import {
  useCreateProject,
  useProjects,
  type ProjectEngagementType,
  type ProjectVisibility,
} from "@/features/projects/use-projects";
import { ProjectVisibilityPicker } from "@/features/projects/project-visibility-picker";
import { FormField, RequiredNote } from "@/components/form-field";
import { ActionHint } from "@/components/help-link";
import { LoadError } from "@/components/load-error";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useAuth, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const today = () => new Date().toISOString().slice(0, 10);
const NO_CONTRACT = "__no_contract__";
// Mirrors the backend @Roles() on POST /contracts.
const CONTRACT_WRITE_ROLES: AppRole[] = [
  "finance",
  "hr",
  "it",
  "marketing",
  "tender",
  "department_head",
  "account_manager",
];

type Errors = Partial<
  Record<"name" | "departmentId" | "serviceLineId" | "endDate" | "form", string>
>;

/** One short form, then straight into the new project — the only step needed to start work. */
export function NewProjectDialog({
  fixedDepartmentId,
  defaultServiceLineCode,
  trigger,
}: {
  fixedDepartmentId?: string;
  defaultServiceLineCode?: string;
  trigger?: ReactNode;
} = {}) {
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const { guardClose } = useUnsavedChanges(dirty);
  const close = () => {
    setDirty(false);
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : guardClose(close))}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4 mr-1" /> New project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {open && (
          <NewProjectForm
            fixedDepartmentId={fixedDepartmentId}
            defaultServiceLineCode={defaultServiceLineCode}
            onDirtyChange={setDirty}
            onCancel={() => guardClose(close)}
            onDone={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewProjectForm({
  fixedDepartmentId,
  defaultServiceLineCode,
  onDirtyChange,
  onCancel,
  onDone,
}: {
  fixedDepartmentId?: string;
  defaultServiceLineCode?: string;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const navigate = useNavigate();
  const { isAdminOrCeo, hasRole } = useAuth();
  const departmentsQ = useDepartments();
  const eligibleQ = useEligibleDepartments();
  const serviceLinesQ = useServiceLines();
  const createProject = useCreateProject();

  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState(
    fixedDepartmentId ?? (eligibleQ.data.length === 1 ? eligibleQ.data[0].id : ""),
  );
  const lines = (serviceLinesQ.data ?? [])
    .filter((l) => l.department_id === departmentId && l.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);
  const defaultLine = (serviceLinesQ.data ?? []).find((l) => l.code === defaultServiceLineCode);
  const [serviceLineId, setServiceLineId] = useState(defaultLine?.id ?? "");
  const [lineTouched, setLineTouched] = useState(false);
  const [suggested, setSuggested] = useState(false);
  const [engagementType, setEngagementType] = useState<ProjectEngagementType>(
    defaultLine?.is_recurring ? "ongoing" : "one_off",
  );
  const [typeTouched, setTypeTouched] = useState(false);
  const [clientId, setClientId] = useState("");
  const [contractId, setContractId] = useState("");
  const [contractDraft, setContractDraft] = useState<ContractDraft | null>(null);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<ProjectVisibility>("department");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Errors>({});

  const canCreateContract = isAdminOrCeo || hasRole(CONTRACT_WRITE_ROLES);
  const contractsQ = useContracts({ clientId, enabled: !!clientId });

  // The department's most-used service line is a sensible default.
  const deptProjectsQ = useProjects({ departmentId, enabled: !!departmentId });
  const mostUsedLine = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of deptProjectsQ.data ?? []) {
      if (p.service_line_id)
        counts.set(p.service_line_id, (counts.get(p.service_line_id) ?? 0) + 1);
    }
    let best: string | undefined;
    for (const [id, n] of counts) if (!best || n > (counts.get(best) ?? 0)) best = id;
    return (serviceLinesQ.data ?? []).find(
      (l) => l.id === best && l.department_id === departmentId && l.is_active,
    );
  }, [deptProjectsQ.data, serviceLinesQ.data, departmentId]);

  const dirty =
    !!name.trim() ||
    !!clientId ||
    !!contractId ||
    !!description.trim() ||
    !!endDate ||
    startDate !== today() ||
    visibility !== "department" ||
    memberIds.length > 0 ||
    lineTouched ||
    typeTouched;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  // Defaults can arrive after the dialog opens; apply them once without overriding a choice.
  useEffect(() => {
    if (!departmentId && !fixedDepartmentId && eligibleQ.data.length === 1) {
      setDepartmentId(eligibleQ.data[0].id);
    }
  }, [departmentId, fixedDepartmentId, eligibleQ.data]);
  useEffect(() => {
    if (serviceLineId || lineTouched) return;
    const preset =
      defaultLine && (!departmentId || defaultLine.department_id === departmentId)
        ? defaultLine
        : undefined;
    const line = preset ?? mostUsedLine;
    if (!line) return;
    setServiceLineId(line.id);
    setSuggested(!preset);
    if (!typeTouched) setEngagementType(line.is_recurring ? "ongoing" : "one_off");
  }, [serviceLineId, lineTouched, defaultLine, mostUsedLine, typeTouched, departmentId]);

  const departmentName =
    (departmentsQ.data ?? []).find((d) => d.id === departmentId)?.name ?? "the department";

  const clearError = (key: keyof Errors) =>
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));

  const pickLine = (id: string) => {
    setServiceLineId(id);
    setLineTouched(true);
    setSuggested(false);
    clearError("serviceLineId");
    const line = lines.find((l) => l.id === id);
    if (line && !typeTouched) setEngagementType(line.is_recurring ? "ongoing" : "one_off");
  };

  const submit = () => {
    const found: Errors = {};
    if (!name.trim()) found.name = "Give the project a name";
    if (!departmentId) found.departmentId = "Choose a department";
    if (lines.length > 0 && !lines.some((l) => l.id === serviceLineId))
      found.serviceLineId = "Choose a service line";
    if (engagementType === "one_off" && endDate && endDate < startDate)
      found.endDate = "The end date can't be before the start date";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    createProject.mutate(
      {
        name: name.trim(),
        departmentId,
        serviceLineId: serviceLineId || undefined,
        engagementType,
        clientId: clientId || undefined,
        contractId: (clientId && contractId) || undefined,
        status: "active",
        startDate: startDate || undefined,
        endDate: engagementType === "one_off" ? endDate || undefined : undefined,
        description: description.trim() || undefined,
        visibility,
        memberIds: visibility === "restricted" ? memberIds : undefined,
      },
      {
        onSuccess: (project) => {
          toast.success(`${project.name} created`);
          onDone();
          navigate({ to: "/projects/$projectId", params: { projectId: project.id } });
        },
        onError: (err) =>
          setErrors({
            form: err instanceof Error ? err.message : "Couldn't create the project. Try again.",
          }),
      },
    );
  };

  const clientContracts = contractsQ.data ?? [];

  return (
    <>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Just the basics — you can add tasks and documents inside the project.
          </DialogDescription>
          <RequiredNote />
        </DialogHeader>

        <div className="space-y-4 py-4">
          <FormField id="np-name" label="Project name" required error={errors.name}>
            <Input
              id="np-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearError("name");
              }}
              placeholder="e.g. Safaricom graduate recruitment 2026"
              aria-invalid={!!errors.name}
              autoFocus
            />
          </FormField>

          {!fixedDepartmentId && (
            <FormField
              id="np-department"
              label="Department"
              required
              error={errors.departmentId}
              hint={
                !eligibleQ.isLoading && eligibleQ.data.length === 0 && !eligibleQ.isError
                  ? "You aren't in a department that runs projects. Ask your department head."
                  : undefined
              }
            >
              {eligibleQ.isError ? (
                <LoadError
                  what="departments"
                  error={eligibleQ.error}
                  onRetry={() => eligibleQ.refetch()}
                  className="p-3"
                />
              ) : (
                <Select
                  value={departmentId}
                  onValueChange={(v) => {
                    setDepartmentId(v);
                    setServiceLineId("");
                    setLineTouched(false);
                    setSuggested(false);
                    clearError("departmentId");
                  }}
                >
                  <SelectTrigger id="np-department" aria-invalid={!!errors.departmentId}>
                    <SelectValue
                      placeholder={
                        eligibleQ.isLoading ? "Loading departments…" : "Select department"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleQ.data.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          )}

          {serviceLinesQ.isError ? (
            <LoadError
              what="service lines"
              error={serviceLinesQ.error}
              onRetry={() => serviceLinesQ.refetch()}
              className="p-3"
            />
          ) : (
            lines.length > 0 && (
              <FormField
                id="np-line"
                label="Service line"
                required
                error={errors.serviceLineId}
                hint={suggested ? `The one used most in ${departmentName}` : undefined}
              >
                <div
                  id="np-line"
                  className="flex flex-wrap gap-2"
                  role="radiogroup"
                  aria-label="Service line"
                >
                  {lines.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      role="radio"
                      aria-checked={serviceLineId === l.id}
                      onClick={() => pickLine(l.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm transition-colors",
                        serviceLineId === l.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-background hover:border-primary/60",
                        errors.serviceLineId && "border-destructive",
                      )}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              </FormField>
            )
          )}

          <FormField id="np-type" label="Type of work" required>
            <div
              id="np-type"
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
              role="radiogroup"
              aria-label="Type of work"
            >
              {(
                [
                  ["one_off", "One-off", "Has an end date", Target],
                  ["ongoing", "Recurring", "Continues for the client", Repeat],
                ] as const
              ).map(([value, label, hint, Icon]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={engagementType === value}
                  onClick={() => {
                    setEngagementType(value);
                    setTypeTouched(true);
                  }}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border p-3 text-left transition-colors",
                    engagementType === value
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:border-primary/60",
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 text-primary" />
                  <span>
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </FormField>

          <div className="space-y-2">
            <FormField id="np-client" label="Client">
              <ClientPicker
                id="np-client"
                value={clientId}
                onChange={(v) => {
                  setClientId(v);
                  setContractId("");
                }}
                allowNone
                departmentId={departmentId || undefined}
                placeholder="Select or create a client"
              />
            </FormField>

            {clientId && (
              <FormField id="np-contract" label="Contract">
                {contractsQ.isError ? (
                  <LoadError
                    what="contracts"
                    error={contractsQ.error}
                    onRetry={() => contractsQ.refetch()}
                    className="p-3"
                  />
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Select
                      value={contractId || NO_CONTRACT}
                      onValueChange={(v) => setContractId(v === NO_CONTRACT ? "" : v)}
                      disabled={contractsQ.isLoading}
                    >
                      <SelectTrigger id="np-contract" className="min-w-0 flex-1">
                        <SelectValue
                          placeholder={contractsQ.isLoading ? "Loading contracts…" : undefined}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_CONTRACT}>
                          {clientContracts.length === 0 && !contractsQ.isLoading
                            ? "This client has no contracts yet"
                            : "No contract"}
                        </SelectItem>
                        {clientContracts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.contract_number ? `${c.contract_number} — ${c.title}` : c.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {canCreateContract && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const line = lines.find((l) => l.id === serviceLineId);
                          setContractDraft({
                            ...emptyContractDraft(),
                            title: name.trim(),
                            client_id: clientId,
                            department_id: departmentId,
                            service_line_id: line?.id ?? "",
                            billing_frequency: engagementType === "ongoing" ? "monthly" : "one_off",
                            start_date: startDate || today(),
                            end_date: engagementType === "one_off" ? endDate : "",
                            status: "active",
                          });
                        }}
                      >
                        <Plus className="mr-1 h-4 w-4" /> New contract
                      </Button>
                    )}
                  </div>
                )}
              </FormField>
            )}
            <ActionHint topic="project contract">
              A contract is optional — add it now or later.
            </ActionHint>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="np-start" label="Start date">
              <Input
                id="np-start"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  clearError("endDate");
                }}
              />
            </FormField>
            {engagementType === "one_off" && (
              <FormField id="np-end" label="End date" error={errors.endDate}>
                <Input
                  id="np-end"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  aria-invalid={!!errors.endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    clearError("endDate");
                  }}
                />
              </FormField>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            aria-expanded={showMore}
          >
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", showMore && "rotate-180")}
            />
            More options (description, who can see it)
          </button>
          {showMore && (
            <div className="space-y-4 rounded-lg border bg-muted/30 p-3">
              <FormField id="np-desc" label="Description">
                <Textarea
                  id="np-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </FormField>
              <ProjectVisibilityPicker
                departmentName={departmentName}
                visibility={visibility}
                onVisibilityChange={setVisibility}
                memberIds={memberIds}
                onMemberIdsChange={setMemberIds}
              />
            </div>
          )}

          {errors.form && (
            <p role="alert" className="text-sm text-destructive">
              {errors.form}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={createProject.isPending}>
            {createProject.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create project
          </Button>
        </DialogFooter>
      </form>

      {contractDraft && (
        <ContractFormDialog
          draft={contractDraft}
          linkProject={false}
          onClose={() => setContractDraft(null)}
          onSaved={(id) => setContractId(id)}
        />
      )}
    </>
  );
}
