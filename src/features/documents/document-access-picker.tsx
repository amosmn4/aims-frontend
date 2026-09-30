import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import {
  useDocumentAccess,
  useSetDocumentAccess,
  RESOURCE_TYPE_LABELS,
  type DocumentAccessGrantRow,
  type DocumentAccessType,
  type DocumentRow,
  type LibraryResourceType,
} from "@/features/documents/use-documents";
import { useDepartments, useProfilesLite } from "@/features/clients/use-clients-contracts";
import { useAuth } from "@/lib/auth";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

// "record" sends no grants (same people as the record); "only_me" sends one grant naming the uploader.
export type AccessMode = DocumentAccessType | "only_me" | "record";

export type AccessGrantDraft = {
  accessType: DocumentAccessType;
  departmentId?: string;
  userId?: string;
};

/** Where the file lives, so the default option can name who already sees it. */
export type AccessContext =
  | { kind: "record"; recordLabel: string }
  | { kind: "library"; departmentName: string }
  | { kind: "open" };

export function accessContextFor(
  resourceType: LibraryResourceType,
  departmentName?: string,
): AccessContext {
  if (resourceType === "department")
    return { kind: "library", departmentName: departmentName ?? "the chosen department" };
  if (resourceType === "tender_document_library" || resourceType === "contract")
    return { kind: "open" };
  return { kind: "record", recordLabel: RESOURCE_TYPE_LABELS[resourceType].toLowerCase() };
}

export function defaultAccessMode(context: AccessContext): AccessMode {
  return context.kind === "open" ? "everyone" : "record";
}

function modesFor(context: AccessContext): AccessMode[] {
  return context.kind === "open"
    ? ["everyone", "department", "user", "only_me"]
    : ["record", "department", "user", "only_me", "everyone"];
}

/** Turns the picker's UI-level mode/selections into the grant list the API actually expects. */
export function draftAccessGrants(
  mode: AccessMode,
  departmentIds: string[],
  userIds: string[],
  currentUserId: string,
): AccessGrantDraft[] {
  if (mode === "record") return [];
  if (mode === "everyone") return [{ accessType: "everyone" }];
  if (mode === "only_me") return [{ accessType: "user", userId: currentUserId }];
  if (mode === "department") {
    return departmentIds.map((departmentId) => ({ accessType: "department", departmentId }));
  }
  return userIds.map((userId) => ({ accessType: "user", userId }));
}

/** An empty department or people choice would silently mean "everyone", so it's blocked. */
export function validateAccess(mode: AccessMode, departmentIds: string[], userIds: string[]) {
  if (mode === "department" && departmentIds.length === 0) return "Tick at least one department";
  if (mode === "user" && userIds.length === 0) return "Pick at least one person";
  return undefined;
}

function decodeGrants(
  grants: DocumentAccessGrantRow[],
  selfId: string | undefined,
  defaultMode: AccessMode,
): { mode: AccessMode; departmentIds: string[]; userIds: string[] } {
  const none = { departmentIds: [], userIds: [] };
  if (grants.length === 0) return { mode: defaultMode, ...none };
  if (grants.some((g) => g.access_type === "everyone")) return { mode: "everyone", ...none };
  const userIds = grants.filter((g) => g.access_type === "user").map((g) => g.user_id!);
  const departmentIds = grants
    .filter((g) => g.access_type === "department")
    .map((g) => g.department_id!);
  if (grants.length === 1 && userIds.length === 1 && userIds[0] === selfId) {
    return { mode: "only_me", ...none };
  }
  return { mode: departmentIds.length > 0 ? "department" : "user", departmentIds, userIds };
}

function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function optionText(
  mode: AccessMode,
  context: AccessContext,
  departmentNames: string[],
  isAdminOrCeo: boolean,
) {
  switch (mode) {
    case "record":
      if (context.kind === "library") {
        const name = context.departmentName;
        return { label: name[0].toUpperCase() + name.slice(1), hint: `Everyone in ${name}` };
      }
      return context.kind === "record"
        ? {
            label: `Same as the ${context.recordLabel}`,
            hint: `Only people who can already see this ${context.recordLabel}`,
          }
        : { label: "Everyone", hint: "Everyone in the company" };
    case "everyone":
      return { label: "Everyone", hint: "Everyone in the company" };
    case "department":
      return {
        label: "Departments",
        hint:
          departmentNames.length > 0
            ? `Everyone in ${joinNames(departmentNames)}`
            : "Everyone in the departments you tick",
      };
    case "user":
      return { label: "Specific people", hint: "Only the people you pick" };
    case "only_me":
      return { label: "Only me", hint: isAdminOrCeo ? "Only you" : "Only you and the CEO" };
  }
}

/** The "Who can see this file" choice shared by the upload form and the sharing dialog. */
export function AccessModePicker({
  mode,
  onModeChange,
  departmentIds,
  onToggleDepartment,
  userIds,
  onToggleUser,
  context = { kind: "open" },
  error,
}: {
  mode: AccessMode;
  onModeChange: (mode: AccessMode) => void;
  departmentIds: string[];
  onToggleDepartment: (id: string) => void;
  userIds: string[];
  onToggleUser: (id: string) => void;
  context?: AccessContext;
  error?: string;
}) {
  const uid = useId();
  const { isAdminOrCeo } = useAuth();
  const departmentsQ = useDepartments();
  const profilesQ = useProfilesLite();
  const [personQuery, setPersonQuery] = useState("");

  const departments = departmentsQ.data ?? [];
  const selectedDepartmentNames = departments
    .filter((d) => departmentIds.includes(d.id))
    .map((d) => d.name);
  const people = (profilesQ.data ?? []).filter((p) => {
    const needle = personQuery.trim().toLowerCase();
    if (!needle) return true;
    return `${p.full_name ?? ""} ${p.email}`.toLowerCase().includes(needle);
  });

  return (
    <div className="space-y-3">
      <RadioGroup
        value={mode}
        onValueChange={(v) => onModeChange(v as AccessMode)}
        aria-label="Who can see this file"
        className="gap-2.5"
      >
        {modesFor(context).map((m) => {
          const text = optionText(m, context, selectedDepartmentNames, isAdminOrCeo);
          return (
            <div key={m} className="flex items-start gap-2">
              <RadioGroupItem
                value={m}
                id={`${uid}-${m}`}
                className="mt-0.5"
                aria-describedby={`${uid}-${m}-hint`}
              />
              <div className="min-w-0">
                <Label htmlFor={`${uid}-${m}`} className="cursor-pointer">
                  {text.label}
                </Label>
                <p id={`${uid}-${m}-hint`} className="text-xs text-muted-foreground">
                  {text.hint}
                </p>
              </div>
            </div>
          );
        })}
      </RadioGroup>

      {mode === "everyone" && context.kind === "library" && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          Everyone in the company will be able to open this.
        </p>
      )}

      {mode === "department" && (
        <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-2">
          {departmentsQ.isError && (
            <p className="text-xs text-destructive">
              Couldn't load departments. Close and try again.
            </p>
          )}
          {departments.map((d) => (
            <div key={d.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                id={`${uid}-dept-${d.id}`}
                checked={departmentIds.includes(d.id)}
                onCheckedChange={() => onToggleDepartment(d.id)}
              />
              <Label htmlFor={`${uid}-dept-${d.id}`} className="font-normal cursor-pointer">
                {d.name}
              </Label>
            </div>
          ))}
        </div>
      )}

      {mode === "user" && (
        <div className="space-y-2">
          <div className="relative">
            <Search
              className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={personQuery}
              onChange={(e) => setPersonQuery(e.target.value)}
              placeholder="Find a person by name or email"
              aria-label="Find a person by name or email"
              className="pl-7"
            />
          </div>
          <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-2">
            {profilesQ.isLoading && (
              <p className="text-xs text-muted-foreground">Loading people…</p>
            )}
            {profilesQ.isError && (
              <p className="text-xs text-destructive">Couldn't load people. Close and try again.</p>
            )}
            {!profilesQ.isLoading && people.length === 0 && (
              <p className="text-xs text-muted-foreground">No one matches "{personQuery}".</p>
            )}
            {people.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  id={`${uid}-user-${p.id}`}
                  checked={userIds.includes(p.id)}
                  onCheckedChange={() => onToggleUser(p.id)}
                />
                <Label htmlFor={`${uid}-user-${p.id}`} className="font-normal cursor-pointer">
                  {p.full_name ?? p.email}
                </Label>
              </div>
            ))}
          </div>
          {userIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {userIds.length} {userIds.length === 1 ? "person" : "people"} picked. They get a
              notification.
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

const toggleIn = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

export function DocumentAccessDialog({
  doc,
  onClose,
}: {
  doc: DocumentRow | null;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const departmentsQ = useDepartments();
  const accessQ = useDocumentAccess(doc?.id);
  const setAccess = useSetDocumentAccess();

  const context: AccessContext = doc
    ? accessContextFor(
        doc.resource_type,
        departmentsQ.data?.find((d) => d.id === doc.resource_id)?.name,
      )
    : { kind: "open" };
  const defaultMode = defaultAccessMode(context);

  const [mode, setMode] = useState<AccessMode>("everyone");
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!accessQ.data) return;
    const decoded = decodeGrants(accessQ.data, profile?.id, defaultMode);
    setMode(decoded.mode);
    setDepartmentIds(decoded.departmentIds);
    setUserIds(decoded.userIds);
    setError(undefined);
  }, [accessQ.data, profile?.id, doc?.id, defaultMode]);

  const save = () => {
    if (!doc || !profile) return;
    const invalid = validateAccess(mode, departmentIds, userIds);
    if (invalid) {
      setError(invalid);
      return;
    }
    setAccess.mutate(
      { documentId: doc.id, grants: draftAccessGrants(mode, departmentIds, userIds, profile.id) },
      {
        onSuccess: () => {
          toast.success(`Updated who can see "${doc.title}"`);
          onClose();
        },
        onError: (err) =>
          setError(err instanceof Error ? err.message : "Couldn't save. Try again."),
      },
    );
  };

  return (
    <Dialog open={!!doc} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Who can see this file</DialogTitle>
          <DialogDescription className="truncate">{doc?.title}</DialogDescription>
        </DialogHeader>

        {accessQ.isLoading ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : accessQ.isError ? (
          <LoadError
            what="who can see this file"
            error={accessQ.error}
            onRetry={() => accessQ.refetch()}
          />
        ) : (
          <AccessModePicker
            mode={mode}
            onModeChange={(m) => {
              setMode(m);
              setError(undefined);
            }}
            departmentIds={departmentIds}
            onToggleDepartment={(id) => {
              setDepartmentIds((list) => toggleIn(list, id));
              setError(undefined);
            }}
            userIds={userIds}
            onToggleUser={(id) => {
              setUserIds((list) => toggleIn(list, id));
              setError(undefined);
            }}
            context={context}
            error={error}
          />
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={setAccess.isPending || !accessQ.data}>
            {setAccess.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save who can see it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
