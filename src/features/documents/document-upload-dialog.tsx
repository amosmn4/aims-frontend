import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import {
  useUploadDocument,
  RESOURCE_TYPE_LABELS,
  DOCUMENT_CATEGORY_SUGGESTIONS,
  type DocumentResourceType,
} from "@/features/documents/use-documents";
import {
  AccessModePicker,
  draftAccessGrants,
  type AccessMode,
} from "@/features/documents/document-access-picker";
import { useProjects, useTasks } from "@/features/projects/use-projects";
import { useFinanceReports } from "@/features/finance/use-finance-reports";
import { useTenders } from "@/features/tender/use-tender";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const ATTACHABLE_TYPES: DocumentResourceType[] = ["project", "task", "finance_report", "tender"];

/**
 * When resourceType/resourceId are supplied (embedded in an AttachmentsPanel), those fields
 * are fixed and hidden. Opened standalone from the central library, the user picks which
 * Project/Task/Finance report to attach to instead.
 */
export function DocumentUploadDialog({
  resourceType: fixedResourceType,
  resourceId: fixedResourceId,
  trigger,
}: {
  resourceType?: DocumentResourceType;
  resourceId?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [resourceType, setResourceType] = useState<DocumentResourceType>(
    fixedResourceType ?? "project",
  );
  const [resourceId, setResourceId] = useState(fixedResourceId ?? "");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("other");
  const [file, setFile] = useState<File | null>(null);
  const [accessMode, setAccessMode] = useState<AccessMode>("everyone");
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);

  const { profile } = useAuth();
  const upload = useUploadDocument();
  const projectsQ = useProjects();
  const tasksQ = useTasks();
  const reportsQ = useFinanceReports();
  const tendersQ = useTenders();

  const showPicker = !fixedResourceType;

  const resourceOptions =
    resourceType === "project"
      ? (projectsQ.data ?? []).map((p) => ({ id: p.id, label: p.name }))
      : resourceType === "task"
        ? (tasksQ.data ?? []).map((t) => ({ id: t.id, label: t.title }))
        : resourceType === "tender"
          ? (tendersQ.data ?? []).map((t) => ({ id: t.id, label: t.title }))
          : (reportsQ.data ?? []).map((r) => ({ id: r.id, label: r.title }));

  const reset = () => {
    setTitle("");
    setCategory("other");
    setFile(null);
    setAccessMode("everyone");
    setDepartmentIds([]);
    setUserIds([]);
    if (showPicker) setResourceId("");
  };

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const submit = () => {
    if (!file) {
      toast.error("Choose a file to upload");
      return;
    }
    if (!resourceId) {
      toast.error("Choose what to attach this document to");
      return;
    }
    if (!profile) return;
    upload.mutate(
      {
        file,
        resourceType,
        resourceId,
        title: title.trim() || undefined,
        category,
        access: draftAccessGrants(accessMode, departmentIds, userIds, profile.id),
      },
      {
        onSuccess: () => {
          toast.success("Document uploaded");
          setOpen(false);
          reset();
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
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Upload className="h-4 w-4 mr-1" /> Attach file
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attach a document</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {showPicker && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Attach to</Label>
                <Select
                  value={resourceType}
                  onValueChange={(v) => {
                    setResourceType(v as DocumentResourceType);
                    setResourceId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ATTACHABLE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {RESOURCE_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>&nbsp;</Label>
                <Select value={resourceId} onValueChange={setResourceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {resourceOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div>
            <Label>Title (optional)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Defaults to the file name"
            />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
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
          </div>
          <div>
            <Label>File</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <Label>Who can see this</Label>
            <div className="mt-1.5">
              <AccessModePicker
                mode={accessMode}
                onModeChange={setAccessMode}
                departmentIds={departmentIds}
                onToggleDepartment={(id) => toggle(departmentIds, setDepartmentIds, id)}
                userIds={userIds}
                onToggleUser={(id) => toggle(userIds, setUserIds, id)}
              />
            </div>
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
