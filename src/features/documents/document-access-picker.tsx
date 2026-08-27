import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  useDocumentAccess,
  useSetDocumentAccess,
  type DocumentAccessType,
  type DocumentRow,
} from "@/features/documents/use-documents";
import { useDepartments, useProfilesLite } from "@/features/clients/use-clients-contracts";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

// "only_me" is UI-only — it isn't a real DocumentAccessType. It submits as a single `user` grant
// naming the uploader/owner themselves (DocumentsService.canView already treats createdBy===self
// as always-visible, so that one grant is sufficient to exclude everyone else — see backend
// comment above canView()). No schema/API change needed for it.
export type AccessMode = DocumentAccessType | "only_me";

const ACCESS_MODE_LABELS: Record<AccessMode, string> = {
  everyone: "Everyone",
  only_me: "Only me",
  department: "Specific departments",
  user: "Specific people",
};

const ACCESS_MODES: AccessMode[] = ["everyone", "only_me", "department", "user"];

export type AccessGrantDraft = {
  accessType: DocumentAccessType;
  departmentId?: string;
  userId?: string;
};

/** Turns the picker's UI-level mode/selections into the grant list the API actually expects. */
export function draftAccessGrants(
  mode: AccessMode,
  departmentIds: string[],
  userIds: string[],
  currentUserId: string,
): AccessGrantDraft[] {
  if (mode === "everyone") return [{ accessType: "everyone" }];
  if (mode === "only_me") return [{ accessType: "user", userId: currentUserId }];
  if (mode === "department") {
    return departmentIds.map((departmentId) => ({ accessType: "department", departmentId }));
  }
  return userIds.map((userId) => ({ accessType: "user", userId }));
}

/** The mode/checklist UI shared between the standalone "Sharing" dialog and the upload form. */
export function AccessModePicker({
  mode,
  onModeChange,
  departmentIds,
  onToggleDepartment,
  userIds,
  onToggleUser,
}: {
  mode: AccessMode;
  onModeChange: (mode: AccessMode) => void;
  departmentIds: string[];
  onToggleDepartment: (id: string) => void;
  userIds: string[];
  onToggleUser: (id: string) => void;
}) {
  const departmentsQ = useDepartments();
  const profilesQ = useProfilesLite();

  return (
    <div className="space-y-4">
      <RadioGroup value={mode} onValueChange={(v) => onModeChange(v as AccessMode)}>
        {ACCESS_MODES.map((t) => (
          <div key={t} className="flex items-center gap-2">
            <RadioGroupItem value={t} id={`access-${t}`} />
            <Label htmlFor={`access-${t}`} className="font-normal cursor-pointer">
              {ACCESS_MODE_LABELS[t]}
            </Label>
          </div>
        ))}
      </RadioGroup>

      {mode === "department" && (
        <ScrollArea className="max-h-48 rounded border p-2">
          <div className="space-y-2">
            {(departmentsQ.data ?? []).map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  id={`dept-${d.id}`}
                  checked={departmentIds.includes(d.id)}
                  onCheckedChange={() => onToggleDepartment(d.id)}
                />
                <Label htmlFor={`dept-${d.id}`} className="font-normal cursor-pointer">
                  {d.name}
                </Label>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {mode === "user" && (
        <ScrollArea className="max-h-48 rounded border p-2">
          <div className="space-y-2">
            {(profilesQ.data ?? []).map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  id={`user-${p.id}`}
                  checked={userIds.includes(p.id)}
                  onCheckedChange={() => onToggleUser(p.id)}
                />
                <Label htmlFor={`user-${p.id}`} className="font-normal cursor-pointer">
                  {p.full_name ?? p.email}
                </Label>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

export function DocumentAccessDialog({
  doc,
  onClose,
}: {
  doc: DocumentRow | null;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const accessQ = useDocumentAccess(doc?.id);
  const setAccess = useSetDocumentAccess();

  const [mode, setMode] = useState<AccessMode>("everyone");
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (!accessQ.data) return;
    if (accessQ.data.length === 0) {
      setMode("everyone");
      setDepartmentIds([]);
      setUserIds([]);
      return;
    }
    const grantedUserIds = accessQ.data
      .filter((g) => g.access_type === "user")
      .map((g) => g.user_id!);
    // A single self-only user grant is what "Only me" looks like on the wire — recognize it as
    // that mode on reopen rather than showing it as a one-person "Specific people" selection.
    if (
      accessQ.data.length === 1 &&
      grantedUserIds.length === 1 &&
      grantedUserIds[0] === profile?.id
    ) {
      setMode("only_me");
      setDepartmentIds([]);
      setUserIds([]);
      return;
    }
    const first = accessQ.data[0];
    setMode(first.access_type);
    setDepartmentIds(
      accessQ.data.filter((g) => g.access_type === "department").map((g) => g.department_id!),
    );
    setUserIds(grantedUserIds);
  }, [accessQ.data, profile?.id]);

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const save = () => {
    if (!doc || !profile) return;
    const grants = draftAccessGrants(mode, departmentIds, userIds, profile.id);

    setAccess.mutate(
      { documentId: doc.id, grants },
      {
        onSuccess: () => {
          toast.success("Sharing updated");
          onClose();
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to update sharing"),
      },
    );
  };

  return (
    <Dialog open={!!doc} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sharing — {doc?.title}</DialogTitle>
        </DialogHeader>

        {accessQ.isLoading ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <AccessModePicker
            mode={mode}
            onModeChange={setMode}
            departmentIds={departmentIds}
            onToggleDepartment={(id) => toggle(departmentIds, setDepartmentIds, id)}
            userIds={userIds}
            onToggleUser={(id) => toggle(userIds, setUserIds, id)}
          />
        )}

        <DialogFooter>
          <Button onClick={save} disabled={setAccess.isPending}>
            {setAccess.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save sharing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
