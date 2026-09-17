import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useAuth, homeRouteFor, type AppRole } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function PermissionDenied({
  message,
}: {
  /** Kept for callers; the page no longer lists roles. */
  required?: AppRole[];
  message?: string;
}) {
  const { roles } = useAuth();
  return (
    <div className="max-w-xl mx-auto mt-10 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <ShieldAlert className="h-6 w-6 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">You don't have access to this page</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {message ?? "Ask the CEO if you need it for your work."}
      </p>
      <div className="mt-6">
        <Link
          to={homeRouteFor(roles)}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go to your home page
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

/** Guards a department area with the backend-resolved read access (roles + overrides). */
export function RequireDepartmentAccess({
  code,
  children,
  message,
}: {
  code: string;
  children: ReactNode;
  message?: string;
}) {
  const { canReadDepartment, loading } = useAuth();
  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (canReadDepartment(code)) return <>{children}</>;
  return <PermissionDenied message={message} />;
}
