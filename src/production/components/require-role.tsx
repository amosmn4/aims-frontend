import type { ReactNode } from "react";
import { useModuleAccess } from "@/lib/modules";

export function RequireRole({
  children,
}: {
  roles: string[];
  children: ReactNode;
  message?: string | undefined;
}) {
  return useModuleAccess("water") ? (
    <>{children}</>
  ) : (
    <p role="alert">Ask the CEO to grant you access to Water Project.</p>
  );
}
