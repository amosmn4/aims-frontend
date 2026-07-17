import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  useDocumentAccess,
  useSetDocumentAccess,
  ACCESS_TYPE_LABELS,
  type DocumentAccessType,
  type DocumentRow,
} from "@/features/documents/use-documents";
import { useDepartments, useProfilesLite } from "@/features/clients/use-clients-contracts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

const ACCESS_TYPES: DocumentAccessType[] = ["everyone", "department", "user"];

export function DocumentAccessDialog({
  doc,
  onClose,
}: {
  doc: DocumentRow | null;
  onClose: () => void;
}) {
  const accessQ = useDocumentAccess(doc?.id);
  const setAccess = useSetDocumentAccess();
  const departmentsQ = useDepartments();
  const profilesQ = useProfilesLite();

  const [mode, setMode] = useState<DocumentAccessType>("everyone");
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
    const first = accessQ.data[0];
    setMode(first.access_type);
    setDepartmentIds(accessQ.data.filter((g) => g.access_type === "department").map((g) => g.department_id!));
    setUserIds(accessQ.data.filter((g) => g.access_type === "user").map((g) => g.user_id!));
  }, [accessQ.data]);

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const save = () => {
    if (!doc) return;
    const grants =
      mode === "everyone"
        ? [{ accessType: "everyone" as const }]
        : mode === "department"
          ? departmentIds.map((departmentId) => ({ accessType: "department" as const, departmentId }))
          : userIds.map((userId) => ({ accessType: "user" as const, userId }));

    setAccess.mutate(
      { documentId: doc.id, grants },
      {
        onSuccess: () => {
          toast.success("Sharing updated");
          onClose();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update sharing"),
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
          <div className="space-y-4">
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as DocumentAccessType)}>
              {ACCESS_TYPES.map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <RadioGroupItem value={t} id={`access-${t}`} />
                  <Label htmlFor={`access-${t}`} className="font-normal cursor-pointer">
                    {ACCESS_TYPE_LABELS[t]}
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
                        onCheckedChange={() => toggle(departmentIds, setDepartmentIds, d.id)}
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
                        onCheckedChange={() => toggle(userIds, setUserIds, p.id)}
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
