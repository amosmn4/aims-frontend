import { useId, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";
import {
  RESOURCE_TYPE_LABELS,
  DOCUMENT_CATEGORY_SUGGESTIONS,
  fileProblem,
  formatFileSize,
  type DocumentResourceType,
} from "@/features/documents/use-documents";
import { useDocumentUploads } from "@/features/documents/use-document-uploads";
import { DocumentDropZone, UploadProgressList } from "@/features/documents/document-drop-zone";
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
  const uploads = useDocumentUploads();
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
  const [labels, setLabels] = useState("");
  const [files, setFiles] = useState<File[]>([]);
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
    files.length > 0 ||
    title.trim() !== "" ||
    labels.trim() !== "" ||
    category !== "other" ||
    accessMode !== null ||
    (showPicker && (attachTo !== initialAttachTo || resourceId !== initialResourceId));
  const { guardClose } = useUnsavedChanges(open && dirty);

  const reset = () => {
    setAttachTo(initialAttachTo);
    setResourceId(initialResourceId);
    setTitle("");
    setCategory("other");
    setLabels("");
    setFiles([]);
    setAccessMode(null);
    setDepartmentIds([]);
    setUserIds([]);
    setErrors({});
    setSubmitError(undefined);
    uploads.clear();
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

  const addFiles = (chosen: File[]) => {
    const blocked = chosen.map(fileProblem).filter((p): p is string => !!p);
    const keep = chosen.filter((f) => !fileProblem(f));
    setFiles((prev) => [
      ...prev,
      ...keep.filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size)),
    ]);
    setErrors((prev) => ({ ...prev, file: blocked[0] }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const next: Errors = {};
    if (showPicker && !resourceId) next.target = `Choose which ${NOUNS[attachTo]?.[0] ?? "one"}`;
    if (files.length === 0) next.file = "Choose at least one file to upload";
    next.access = validateAccess(mode, departmentIds, userIds);
    setErrors(next);
    setSubmitError(undefined);
    if (files.length === 0 || next.target || next.access) return;

    const grants = draftAccessGrants(mode, departmentIds, userIds, profile.id);
    const tags = labels
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const result = await uploads.upload(
      files,
      {
        resourceType: attachTo,
        resourceId,
        title: title.trim() || undefined,
        category,
        tags,
        access: grants.length > 0 ? grants : undefined,
      },
      { silent: true },
    );

    if (result.failed > 0) {
      setSubmitError(
        result.uploaded > 0
          ? "Some files couldn't be added — see the list above."
          : "That didn't work — see the list above.",
      );
      setFiles([]);
      return;
    }
    toast.success(
      isLibrary
        ? `Added ${result.uploaded === 1 ? `"${files[0].name}"` : `${result.uploaded} files`} to the ${libraryName ?? "department"} library`
        : result.uploaded === 1
          ? `Attached "${files[0].name}"`
          : `Attached ${result.uploaded} files`,
    );
    close();
  };

  const recordNoun = RESOURCE_TYPE_LABELS[attachTo].toLowerCase();
  const dialogTitle = isLibrary
    ? libraryName
      ? `Add to the ${libraryName} library`
      : "Add to a department library"
    : fixedResourceType
      ? `Attach files to this ${recordNoun}`
      : "Attach files";
  const primaryLabel = isLibrary ? "Add to library" : "Attach file";
  const submitLabel = isLibrary
    ? "Add to library"
    : files.length > 1
      ? `Attach ${files.length} files`
      : "Attach file";

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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
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

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">
              Files
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            </legend>
            <DocumentDropZone
              onFiles={addFiles}
              disabled={uploads.uploading}
              label="Drag files here, or choose them"
            />
            {files.length > 0 && (
              <ul className="divide-y rounded-lg border bg-card">
                {files.map((f) => (
                  <li
                    key={`${f.name}-${f.size}`}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{f.name}</span>{" "}
                      <span className="text-muted-foreground">{formatFileSize(f.size)}</span>
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      aria-label={`Remove ${f.name}`}
                      onClick={() => setFiles((prev) => prev.filter((p) => p !== f))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {errors.file && (
              <p role="alert" className="text-xs text-destructive">
                {errors.file}
              </p>
            )}
            <UploadProgressList items={uploads.items} />
          </fieldset>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              id={`${uid}-title`}
              label="Title"
              hint={
                files.length > 1
                  ? "Each file keeps its own name when you add several at once"
                  : "Leave blank to use the file name"
              }
            >
              <Input
                id={`${uid}-title`}
                value={title}
                disabled={files.length > 1}
                onChange={(e) => setTitle(e.target.value)}
              />
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

          <FormField
            id={`${uid}-labels`}
            label="Labels"
            hint="Optional words people can filter by later, separated by commas"
          >
            <Input
              id={`${uid}-labels`}
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
              placeholder="e.g. 2026, signed"
            />
          </FormField>

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
            <Button type="submit" disabled={uploads.uploading}>
              {uploads.uploading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              {submitLabel}
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
