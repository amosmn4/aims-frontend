import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useAuth, homeRouteFor, type AppRole, ROLE_LABELS } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function PermissionDenied({
  required,
  message,
}: {
  required?: AppRole[];
  message?: string;
}) {
  const { roles } = useAuth();
  return (
    <div className="max-w-xl mx-auto mt-10 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <ShieldAlert className="h-6 w-6 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Access restricted</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {message ??
          "You do not have permission to view this area. If you believe this is an error, contact your System Administrator."}
      </p>
      {required && required.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Required role{required.length > 1 ? "s" : ""}:{" "}
          <span className="font-medium text-foreground">
            {required.map((r) => ROLE_LABELS[r] ?? r).join(" · ")}
          </span>
        </p>
      )}
      <div className="mt-6">
        <Link
          to={homeRouteFor(roles)}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}

export function RequireRole({
  roles,
  children,
  message,
}: {
  roles: AppRole[];
  children: ReactNode;
  message?: string;
}) {
  const { hasRole, isAdminOrCeo, loading } = useAuth();
  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (isAdminOrCeo || hasRole(roles)) return <>{children}</>;
  return <PermissionDenied required={roles} message={message} />;
}
