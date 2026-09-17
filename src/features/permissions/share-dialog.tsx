import { useState } from "react";
import { toast } from "sonner";
import { Eye, Loader2, Pencil, Share2, Trash2 } from "lucide-react";
import {
  useAccessGrants,
  useCreateAccessGrant,
  useDeleteAccessGrant,
  type AccessGrantResource,
  type AccessGrantRow,
} from "@/features/permissions/use-access-grants";
import { useDepartments, useProfilesLite } from "@/features/clients/use-clients-contracts";
import { confirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

const LEVEL_LABEL = { read: "View only", write: "View and edit" } as const;

const grantName = (g: AccessGrantRow) =>
  g.user ? (g.user.full_name ?? g.user.email) : (g.department?.name ?? "—");

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
  const [targetError, setTargetError] = useState("");

  const profilesQ = useProfilesLite();
  const departmentsQ = useDepartments();
  const grantsQ = useAccessGrants(resource, open ? resourceId : undefined);
  const createGrant = useCreateAccessGrant(resource, resourceId);
  const deleteGrant = useDeleteAccessGrant(resource, resourceId);
  const grants = grantsQ.data ?? [];

  const share = () => {
    if (!targetId) {
      setTargetError(target === "user" ? "Choose a person" : "Choose a department");
      return;
    }
    createGrant.mutate(
      { [target === "user" ? "userId" : "departmentId"]: targetId, level },
      {
        onSuccess: () => {
          toast.success(`Access given to this ${recordLabel}`);
          setTargetId("");
        },
        onError: (err) => toast.error(errMsg(err, "Couldn't give access")),
      },
    );
  };

  const revoke = async (g: AccessGrantRow) => {
    const ok = await confirmDialog({
      title: `Remove access for ${grantName(g)}?`,
      description: `They'll no longer be able to open this ${recordLabel} unless their role allows it.`,
      confirmLabel: "Remove access",
      destructive: true,
    });
    if (!ok) return;
    deleteGrant.mutate(g.id, {
      onSuccess: () => toast.success("Access removed"),
      onError: (err) => toast.error(errMsg(err, "Couldn't remove access")),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setTargetId("");
          setTargetError("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Share2 className="mr-1 h-3.5 w-3.5" /> Share {recordLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share this {recordLabel}</DialogTitle>
          <DialogDescription>
            Give a person or a whole department View or Edit access to it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[9rem_1fr]">
            <FormField id="share-target-type" label="Share with">
              <Select
                value={target}
                onValueChange={(v) => {
                  setTarget(v as typeof target);
                  setTargetId("");
                  setTargetError("");
                }}
              >
                <SelectTrigger id="share-target-type" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">A person</SelectItem>
                  <SelectItem value="department">A department</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              id="share-target"
              label={target === "user" ? "Person" : "Department"}
              required
              error={targetError}
            >
              <Select
                value={targetId}
                onValueChange={(v) => {
                  setTargetId(v);
                  setTargetError("");
                }}
              >
                <SelectTrigger id="share-target" className="h-9" aria-invalid={!!targetError}>
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
            </FormField>
          </div>

          <FormField id="share-level" label="Access">
            <Select value={level} onValueChange={(v) => setLevel(v as typeof level)}>
              <SelectTrigger id="share-level" className="h-9 sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">{LEVEL_LABEL.read}</SelectItem>
                <SelectItem value="write">{LEVEL_LABEL.write}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <Button size="sm" onClick={share} disabled={createGrant.isPending} className="w-full">
            {createGrant.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="mr-1.5 h-4 w-4" />
            )}
            Give access
          </Button>

          {grantsQ.isError ? (
            <LoadError
              what="who this is shared with"
              error={grantsQ.error}
              onRetry={() => grantsQ.refetch()}
            />
          ) : (
            grants.length > 0 && (
              <div className="space-y-1.5 border-t pt-3">
                <h3 className="text-xs font-semibold text-muted-foreground">Already shared with</h3>
                <ul className="space-y-1.5">
                  {grants.map((g) => (
                    <li key={g.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {g.level === "write" ? (
                          <Pencil
                            className="h-3 w-3 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                        ) : (
                          <Eye
                            className="h-3 w-3 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                        )}
                        <span className="truncate">{grantName(g)}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {LEVEL_LABEL[g.level]}
                        </span>
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        disabled={deleteGrant.isPending}
                        onClick={() => revoke(g)}
                        aria-label={`Remove access for ${grantName(g)}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
        </div>

        <DialogFooter>
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
