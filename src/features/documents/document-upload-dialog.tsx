import { useId, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import {
  useUploadDocument,
  RESOURCE_TYPE_LABELS,
  DOCUMENT_ACCEPT,
  DOCUMENT_CATEGORY_SUGGESTIONS,
  MAX_DOCUMENT_BYTES,
  type DocumentResourceType,
} from "@/features/documents/use-documents";
import {
  AccessModePicker,
  accessContextFor,
  defaultAccessMode,
  draftAccessGrants,
  validateAccess,
  type AccessMode,
} from "@/features/documents/document-access-picker";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { useProjects, useTasks } from "@/features/projects/use-projects";
import { useFinanceReports } from "@/features/finance/use-finance-reports";
import { useTenders } from "@/features/tender/use-tender";
import { useClientRequests } from "@/features/client-requests/use-client-requests";
import { useDepartmentReports } from "@/features/reports/use-department-reports";
import { useAuth } from "@/lib/auth";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { FormField, RequiredNote } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DepartmentLite = { id: string; name: string; code: string };

const ATTACH_TO: DocumentResourceType[] = [
  "department",
  "project",
  "task",
  "client_request",
  "tender",
  "department_report",
  "finance_report",
];

const WHICH_LABELS: Partial<Record<DocumentResourceType, string>> = {
  department: "Which department?",
  project: "Which project?",
  task: "Which task?",
  client_request: "Which client request?",
  tender: "Which tender?",
  department_report: "Which report?",
  finance_report: "Which finance report?",
};

const NOUNS: Partial<Record<DocumentResourceType, [string, string]>> = {
  department: ["department", "departments"],
  project: ["project", "projects"],
  task: ["task", "tasks"],
  client_request: ["client request", "client requests"],
  tender: ["tender", "tenders"],
  department_report: ["report", "reports"],
  finance_report: ["finance report", "finance reports"],
};

type Errors = { target?: string; file?: string; access?: string };

/** Fixed resourceType/resourceId attach to one record; otherwise people choose, library first on department pages. */
export function DocumentUploadDialog({
  resourceType: fixedResourceType,
  resourceId: fixedResourceId,
  trigger,
  department,
  defaultAttachTo,
}: {
  resourceType?: DocumentResourceType;
  resourceId?: string;
  trigger?: ReactNode;
  /** The page's department: its library is offered first and preselected. */
  department?: DepartmentLite;
  /** Opens with this "Attach to" choice instead of the default. */
  defaultAttachTo?: DocumentResourceType;
}) {
  const uid = useId();
  const { profile, isAdminOrCeo, hasRole } = useAuth();
  const departmentsQ = useDepartments();
  const upload = useUploadDocument();
  const showPicker = !fixedResourceType;

  const initialAttachTo: DocumentResourceType =
    fixedResourceType ?? defaultAttachTo ?? (department ? "department" : "project");
  const initialResourceId =
    fixedResourceId ?? (initialAttachTo === "department" && department ? department.id : "");

  const [open, setOpen] = useState(false);
  const [attachTo, setAttachTo] = useState<DocumentResourceType>(initialAttachTo);
  const [resourceId, setResourceId] = useState(initialResourceId);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("other");
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  // null keeps the default for wherever the file is going.
  const [accessMode, setAccessMode] = useState<AccessMode | null>(null);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string>();

  const isLibrary = attachTo === "department";
  const libraryName = isLibrary
    ? (departmentsQ.data?.find((d) => d.id === resourceId)?.name ??
      (resourceId === department?.id ? department?.name : undefined))
    : undefined;
  const context = accessContextFor(attachTo, libraryName);
  const mode = accessMode ?? defaultAccessMode(context);

  const dirty =
    !!file ||
    title.trim() !== "" ||
    category !== "other" ||
    accessMode !== null ||
    (showPicker && (attachTo !== initialAttachTo || resourceId !== initialResourceId));
  const { guardClose } = useUnsavedChanges(open && dirty);

  const reset = () => {
    setAttachTo(initialAttachTo);
    setResourceId(initialResourceId);
    setTitle("");
    setCategory("other");
    setFile(null);
    setFileInputKey((k) => k + 1);
    setAccessMode(null);
    setDepartmentIds([]);
    setUserIds([]);
    setErrors({});
    setSubmitError(undefined);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const attachOptions = ATTACH_TO.filter((t) =>
    t === "finance_report"
      ? (isAdminOrCeo || hasRole("finance")) && (!department || department.code === "finance")
      : true,
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const next: Errors = {};
    if (showPicker && !resourceId) next.target = `Choose which ${NOUNS[attachTo]?.[0] ?? "one"}`;
    if (!file) next.file = "Choose a file to upload";
    else if (file.size > MAX_DOCUMENT_BYTES)
      next.file = "This file is bigger than 25 MB. Choose a smaller file.";
    next.access = validateAccess(mode, departmentIds, userIds);
    setErrors(next);
    setSubmitError(undefined);
    if (!file || next.target || next.file || next.access) return;

    const grants = draftAccessGrants(mode, departmentIds, userIds, profile.id);
    upload.mutate(
      {
        file,
        resourceType: attachTo,
        resourceId,
        title: title.trim() || undefined,
        category,
        access: grants.length > 0 ? grants : undefined,
      },
      {
        onSuccess: (doc) => {
          toast.success(
            isLibrary
              ? `Added "${doc.title}" to the ${libraryName ?? "department"} library`
              : `Attached "${doc.title}"`,
          );
          close();
        },
        onError: (err) =>
          setSubmitError(
            err instanceof Error ? err.message : "Couldn't upload the file. Try again.",
          ),
      },
    );
  };

  const recordNoun = RESOURCE_TYPE_LABELS[attachTo].toLowerCase();
  const dialogTitle = isLibrary
    ? libraryName
      ? `Add to the ${libraryName} library`
      : "Add to a department library"
    : fixedResourceType
      ? `Attach a file to this ${recordNoun}`
      : "Attach a file";
  const primaryLabel = isLibrary ? "Add to library" : "Attach file";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          reset();
          setOpen(true);
        } else {
          void guardClose(close);
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Upload className="h-4 w-4 mr-1" /> {primaryLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <RequiredNote />
          </DialogHeader>

          {showPicker && (
            <div className="grid grid-cols-1 gap-3">
              <FormField id={`${uid}-attach-to`} label="Attach to" required>
                <Select
                  value={attachTo}
                  onValueChange={(v) => {
                    const t = v as DocumentResourceType;
                    setAttachTo(t);
                    setResourceId(t === "department" && department ? department.id : "");
                    setErrors((prev) => ({ ...prev, target: undefined }));
                  }}
                >
                  <SelectTrigger id={`${uid}-attach-to`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {attachOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t === "department"
                          ? "Department library (not tied to a record)"
                          : RESOURCE_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                id={`${uid}-target`}
                label={WHICH_LABELS[attachTo] ?? "Which one?"}
                required
                error={errors.target}
              >
                <TargetSelect
                  id={`${uid}-target`}
                  type={attachTo}
                  departmentId={department?.id}
                  value={resourceId}
                  invalid={!!errors.target}
                  onChange={(id) => {
                    setResourceId(id);
                    setErrors((prev) => ({ ...prev, target: undefined }));
                  }}
                />
              </FormField>
            </div>
          )}

          <FormField
            id={`${uid}-file`}
            label="File"
            required
            error={errors.file}
            hint="PDF, Word, Excel, PowerPoint, images, text or zip — up to 25 MB"
          >
            <Input
              key={fileInputKey}
              id={`${uid}-file`}
              type="file"
              accept={DOCUMENT_ACCEPT}
              aria-invalid={!!errors.file}
              aria-describedby={errors.file ? `${uid}-file-error` : undefined}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setErrors((prev) => ({ ...prev, file: undefined }));
              }}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id={`${uid}-title`} label="Title" hint="Leave blank to use the file name">
              <Input id={`${uid}-title`} value={title} onChange={(e) => setTitle(e.target.value)} />
            </FormField>
            <FormField id={`${uid}-category`} label="Category">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id={`${uid}-category`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORY_SUGGESTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c[0].toUpperCase() + c.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Who can see this file</legend>
            <AccessModePicker
              mode={mode}
              onModeChange={(m) => {
                setAccessMode(m);
                setErrors((prev) => ({ ...prev, access: undefined }));
              }}
              departmentIds={departmentIds}
              onToggleDepartment={(id) => {
                setDepartmentIds((list) => toggle(list, id));
                setErrors((prev) => ({ ...prev, access: undefined }));
              }}
              userIds={userIds}
              onToggleUser={(id) => {
                setUserIds((list) => toggle(list, id));
                setErrors((prev) => ({ ...prev, access: undefined }));
              }}
              context={context}
              error={errors.access}
            />
          </fieldset>

          {submitError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            >
              {submitError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void guardClose(close)}>
              Cancel
            </Button>
            <Button type="submit" disabled={upload.isPending}>
              {upload.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              {primaryLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- "Which …?" options, loaded only for the chosen type ---------- */

type TargetProps = {
  id: string;
  departmentId?: string;
  value: string;
  invalid: boolean;
  onChange: (id: string) => void;
};

type QueryLike = { isLoading: boolean; isError: boolean; refetch: () => unknown };

function TargetSelect({ type, ...props }: TargetProps & { type: DocumentResourceType }) {
  switch (type) {
    case "department":
      return <DepartmentTargets {...props} />;
    case "project":
      return <ProjectTargets {...props} />;
    case "task":
      return <TaskTargets {...props} />;
    case "client_request":
      return <RequestTargets {...props} />;
    case "tender":
      return <TenderTargets {...props} />;
    case "department_report":
      return <DepartmentReportTargets {...props} />;
    case "finance_report":
      return <FinanceReportTargets {...props} />;
    default:
      return null;
  }
}

function OptionsSelect({
  id,
  value,
  onChange,
  invalid,
  options,
  query,
  type,
}: TargetProps & {
  options: { id: string; label: string }[];
  query: QueryLike;
  type: DocumentResourceType;
}) {
  const [noun, plural] = NOUNS[type] ?? ["item", "items"];
  if (query.isError) {
    return (
      <p className="text-xs text-destructive">
        Couldn't load {plural}.{" "}
        <button type="button" className="underline" onClick={() => query.refetch()}>
          Try again
        </button>
      </p>
    );
  }
  const empty = !query.isLoading && options.length === 0;
  return (
    <Select value={value} onValueChange={onChange} disabled={query.isLoading || empty}>
      <SelectTrigger id={id} aria-invalid={invalid}>
        <SelectValue
          placeholder={
            query.isLoading
              ? "Loading…"
              : empty
                ? `No ${plural} you can attach to yet`
                : `Choose a ${noun}`
          }
        />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const withRef = (ref: string | null, title: string) => (ref ? `${ref} · ${title}` : title);

function DepartmentTargets(props: TargetProps) {
  const { canWriteDepartment } = useAuth();
  const q = useDepartments();
  const options = (q.data ?? [])
    .filter((d) => canWriteDepartment(d.code))
    .map((d) => ({ id: d.id, label: d.name }));
  return <OptionsSelect {...props} type="department" query={q} options={options} />;
}

function ProjectTargets(props: TargetProps) {
  const q = useProjects({ departmentId: props.departmentId });
  const options = (q.data ?? []).map((p) => ({ id: p.id, label: p.name }));
  return <OptionsSelect {...props} type="project" query={q} options={options} />;
}

function TaskTargets(props: TargetProps) {
  const q = useTasks({ departmentId: props.departmentId });
  const options = (q.data ?? []).map((t) => ({
    id: t.id,
    label: t.project_name ? `${t.title} — ${t.project_name}` : t.title,
  }));
  return <OptionsSelect {...props} type="task" query={q} options={options} />;
}

function RequestTargets(props: TargetProps) {
  const q = useClientRequests({ departmentId: props.departmentId });
  const options = (q.data ?? []).map((r) => ({
    id: r.id,
    label: withRef(r.reference_number, r.title),
  }));
  return <OptionsSelect {...props} type="client_request" query={q} options={options} />;
}

function TenderTargets(props: TargetProps) {
  const q = useTenders({ departmentId: props.departmentId });
  const options = (q.data ?? []).map((t) => ({
    id: t.id,
    label: withRef(t.reference_number, t.title),
  }));
  return <OptionsSelect {...props} type="tender" query={q} options={options} />;
}

function DepartmentReportTargets(props: TargetProps) {
  const q = useDepartmentReports(props.departmentId);
  const options = (q.data ?? []).map((r) => ({ id: r.id, label: r.title }));
  return <OptionsSelect {...props} type="department_report" query={q} options={options} />;
}

function FinanceReportTargets(props: TargetProps) {
  const q = useFinanceReports();
  const options = (q.data ?? []).map((r) => ({ id: r.id, label: r.title }));
  return <OptionsSelect {...props} type="finance_report" query={q} options={options} />;
}
