import { toast } from "sonner";
import { Loader2, Eye, Pencil } from "lucide-react";
import {
  useDepartmentCapabilities,
  useSetPermissionOverride,
  type PermissionAction,
} from "@/features/permissions/use-permissions";
import { cn } from "@/lib/utils";

function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

// One toggle per (user, action) — three states: role default (dim, unset), explicitly granted,
// explicitly denied. Clicking cycles grant -> deny -> back to role default.
function CapabilityToggle({
  effective,
  source,
  onCycle,
  disabled,
  icon: Icon,
  label,
}: {
  effective: boolean;
  source: "role" | "override";
  onCycle: () => void;
  disabled: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onCycle}
      title={
        source === "override"
          ? `${label}: explicitly ${effective ? "granted" : "denied"} — click to revert to role default`
          : `${label}: ${effective ? "granted" : "denied"} by role — click to override`
      }
      className={cn(
        "flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        effective
          ? "border-success/40 bg-success/10 text-success"
          : "border-destructive/30 bg-destructive/5 text-destructive",
        source === "override" && "ring-1 ring-offset-1 ring-primary/50",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
      {source === "override" && <span className="text-[9px] opacity-70">•</span>}
    </button>
  );
}

export function PermissionsPanel({ departmentId }: { departmentId: string | undefined }) {
  const capsQ = useDepartmentCapabilities(departmentId);
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
      { onError: (err) => toast.error(errMsg(err, "Couldn't update permission")) },
    );
  };

  if (!departmentId) {
    return <div className="text-xs text-muted-foreground py-6 text-center">Pick a department.</div>;
  }

  if (capsQ.isLoading) {
    return (
      <div className="py-8 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const staff = capsQ.data?.staff ?? [];

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Read/write shown per person for this department. A dot marks an explicit override; click a
        toggle to grant, deny, then revert to their role's default.
      </p>
      {staff.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center">
          No staff tied to this department yet.
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {staff.map((s) => (
            <div key={s.user_id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{s.full_name ?? s.email}</div>
                <div className="text-xs text-muted-foreground truncate">{s.email}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <CapabilityToggle
                  effective={s.capabilities.read.effective}
                  source={s.capabilities.read.source}
                  disabled={setOverride.isPending}
                  onCycle={() => cycle(s.user_id, "read", s.capabilities.read)}
                  icon={Eye}
                  label="Read"
                />
                <CapabilityToggle
                  effective={s.capabilities.write.effective}
                  source={s.capabilities.write.source}
                  disabled={setOverride.isPending}
                  onCycle={() => cycle(s.user_id, "write", s.capabilities.write)}
                  icon={Pencil}
                  label="Write"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
