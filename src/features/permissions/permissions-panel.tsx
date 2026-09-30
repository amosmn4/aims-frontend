import { toast } from "sonner";
import { Check, Eye, Loader2, Pencil, X } from "lucide-react";
import {
  useDepartmentCapabilities,
  useRoleCapabilities,
  useSetPermissionOverride,
  type PermissionAction,
} from "@/features/permissions/use-permissions";
import { describeAccess } from "@/features/permissions/access-summary";
import { LoadError } from "@/components/load-error";
import { cn } from "@/lib/utils";

function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

// Three states per person and action: role default, allowed just for them, blocked just for them.
function CapabilityToggle({
  effective,
  source,
  onCycle,
  disabled,
  icon: Icon,
  label,
  personName,
}: {
  effective: boolean;
  source: "role" | "override";
  onCycle: () => void;
  disabled: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  personName: string;
}) {
  const hint =
    source === "override"
      ? `${label} access for ${personName}: ${effective ? "allowed" : "blocked"} just for them. Click to go back to what their role allows.`
      : `${label} access for ${personName}: ${effective ? "allowed" : "not allowed"} by their role. Click to change it just for them.`;
  const Mark = effective ? Check : X;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onCycle}
      title={hint}
      aria-label={hint}
      className={cn(
        "flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        effective
          ? "border-success/40 bg-success/10 text-success"
          : "border-destructive/30 bg-destructive/5 text-destructive",
        source === "override" && "ring-1 ring-primary/50 ring-offset-1",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
      <Mark className="h-3 w-3" aria-hidden="true" />
      {effective ? "Allowed" : "Blocked"}
      {source === "override" && <span className="font-normal opacity-80">(just them)</span>}
    </button>
  );
}

export function PermissionsPanel({ departmentId }: { departmentId: string | undefined }) {
  const capsQ = useDepartmentCapabilities(departmentId);
  const matrixQ = useRoleCapabilities();
  const setOverride = useSetPermissionOverride();

  const cycle = (
    userId: string,
    action: PermissionAction,
    current: { effective: boolean; source: string },
  ) => {
    if (!departmentId) return;
    // role default -> grant -> deny -> role default (clear)
    const next: "grant" | "deny" | "clear" =
      current.source === "role" ? (current.effective ? "deny" : "grant") : "clear";
    setOverride.mutate(
      { userId, departmentId, action, effect: next },
      {
        onSuccess: () => toast.success("Access updated"),
        onError: (err) => toast.error(errMsg(err, "Couldn't update access")),
      },
    );
  };

  if (!departmentId) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        Choose a department to see who can do what in it.
      </p>
    );
  }

  if (capsQ.isError) {
    return (
      <LoadError
        what="access for this department"
        error={capsQ.error}
        onRetry={() => capsQ.refetch()}
      />
    );
  }

  if (capsQ.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const department = capsQ.data?.department;
  const staff = (capsQ.data?.staff ?? []).filter((s) => !s.roles.includes("system_admin"));

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Each person starts with what their role allows. Click View or Edit to change it just for
        them; click again to go back to their role.
      </p>
      {staff.length === 0 || !department ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Nobody belongs to this department yet. Set each person's department on the Staff page.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {staff.map((s) => {
            const name = s.full_name ?? s.email;
            return (
              <li
                key={s.user_id}
                className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1 basis-64">
                  <div className="truncate text-sm font-medium">
                    {name}
                    {s.full_name && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {s.email}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {describeAccess(s, department, matrixQ.data)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <CapabilityToggle
                    effective={s.capabilities.read.effective}
                    source={s.capabilities.read.source}
                    disabled={setOverride.isPending}
                    onCycle={() => cycle(s.user_id, "read", s.capabilities.read)}
                    icon={Eye}
                    label="View"
                    personName={name}
                  />
                  <CapabilityToggle
                    effective={s.capabilities.write.effective}
                    source={s.capabilities.write.source}
                    disabled={setOverride.isPending}
                    onCycle={() => cycle(s.user_id, "write", s.capabilities.write)}
                    icon={Pencil}
                    label="Edit"
                    personName={name}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
