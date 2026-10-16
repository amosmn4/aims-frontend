import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { LoadError } from "@/components/load-error";
import { DEPARTMENT_NAMES } from "@/lib/department-nav";
import type { DepartmentCode } from "@/lib/auth";

type DepartmentLite = { id: string; name: string; code: string };

/** Loads a department by code, with loading, failed and missing states. */
export function WithDepartment({
  code,
  children,
}: {
  code: DepartmentCode;
  children: (dept: DepartmentLite) => ReactNode;
}) {
  const departmentsQ = useDepartments();
  const name = DEPARTMENT_NAMES[code];

  if (departmentsQ.isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (departmentsQ.isError) {
    return (
      <LoadError
        what={`${name} details`}
        error={departmentsQ.error}
        onRetry={() => departmentsQ.refetch()}
      />
    );
  }
  const dept = departmentsQ.data?.find((d) => d.code === code);
  if (!dept) {
    return (
      <div className="rounded-lg border bg-card py-12 px-6 text-center">
        <p className="text-sm font-medium">The {name} department isn't set up yet</p>
        <p className="mt-1 text-xs text-muted-foreground">Ask the CEO to add it.</p>
      </div>
    );
  }
  return <>{children(dept)}</>;
}
