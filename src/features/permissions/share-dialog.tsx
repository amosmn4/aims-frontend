import { useState } from "react";
import { toast } from "sonner";
import { Share2, Loader2, Trash2, Eye, Pencil } from "lucide-react";
import {
  useAccessGrants,
  useCreateAccessGrant,
  useDeleteAccessGrant,
  type AccessGrantResource,
} from "@/features/permissions/use-access-grants";
import { useDepartments, useProfilesLite } from "@/features/clients/use-clients-contracts";
import { Button } from "@/components/ui/button";
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

function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function ShareDialog({
  resource,
  resourceId,
  recordLabel,
}: {
  resource: AccessGrantResource;
  resourceId: string;
  recordLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<"user" | "department">("user");
  const [targetId, setTargetId] = useState("");
  const [level, setLevel] = useState<"read" | "write">("read");

  const profilesQ = useProfilesLite();
  const departmentsQ = useDepartments();
  const grantsQ = useAccessGrants(resource, open ? resourceId : undefined);
  const createGrant = useCreateAccessGrant(resource, resourceId);
  const deleteGrant = useDeleteAccessGrant(resource, resourceId);

  const share = () => {
    if (!targetId) {
      toast.error(`Pick a ${target}`);
      return;
    }
    createGrant.mutate(
      { [target === "user" ? "userId" : "departmentId"]: targetId, level },
      {
        onSuccess: () => {
          toast.success(`${recordLabel} shared`);
          setTargetId("");
        },
        onError: (err) => toast.error(errMsg(err, "Couldn't share")),
      },
    );
  };

  const revoke = (grantId: string) => {
    deleteGrant.mutate(grantId, { onError: (err) => toast.error(errMsg(err, "Couldn't revoke")) });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Share2 className="h-3.5 w-3.5 mr-1" /> Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share {recordLabel}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Select
              value={target}
              onValueChange={(v) => {
                setTarget(v as typeof target);
                setTargetId("");
              }}
            >
              <SelectTrigger className="w-32 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Person</SelectItem>
                <SelectItem value="department">Department</SelectItem>
              </SelectContent>
            </Select>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger className="flex-1 h-9">
                <SelectValue
                  placeholder={target === "user" ? "Choose a person" : "Choose a department"}
                />
              </SelectTrigger>
              <SelectContent>
                {target === "user"
                  ? (profilesQ.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name ?? p.email}
                      </SelectItem>
                    ))
                  : (departmentsQ.data ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Access</Label>
            <Select value={level} onValueChange={(v) => setLevel(v as typeof level)}>
              <SelectTrigger className="h-9 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">Read only</SelectItem>
                <SelectItem value="write">Read & write</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button size="sm" onClick={share} disabled={createGrant.isPending} className="w-full">
            {createGrant.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4 mr-1.5" />
            )}
            Share
          </Button>

          {(grantsQ.data ?? []).length > 0 && (
            <div className="border-t pt-3 space-y-1.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Already shared with
              </div>
              {(grantsQ.data ?? []).map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {g.level === "write" ? (
                      <Pencil className="h-3 w-3 text-muted-foreground shrink-0" />
                    ) : (
                      <Eye className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate">
                      {g.user ? (g.user.full_name ?? g.user.email) : (g.department?.name ?? "—")}
                    </span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={deleteGrant.isPending}
                    onClick={() => revoke(g.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
