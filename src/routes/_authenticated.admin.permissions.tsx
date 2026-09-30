import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/app-shell";
import { RequireRole } from "@/components/require-role";
import { FormField } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { PermissionsPanel } from "@/features/permissions/permissions-panel";
import { RoleCapabilityMatrix } from "@/features/permissions/role-capability-matrix";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/permissions")({
  head: () => ({
    meta: [{ title: "Roles & Permissions — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminPermissionsPage,
});

type Department = { id: string; name: string; code: string };

function AdminPermissionsPage() {
  const { isAdminOrCeo } = useAuth();
  const [departmentId, setDepartmentId] = useState<string>("");

  const departmentsQ = useQuery({
    queryKey: ["departments", "admin"],
    queryFn: () => apiJson<Department[]>("/departments"),
    enabled: isAdminOrCeo,
  });

  return (
    <RequireRole roles={[]} message="Only the CEO can change roles and permissions.">
      <div className="max-w-5xl space-y-4">
        <PageHeader
          title="Roles & Permissions"
          description="Decide what each role can do, then give or take away View / Edit access for one person."
        />

        <RoleCapabilityMatrix />

        <section className="rounded-lg border bg-card" aria-labelledby="person-access-heading">
          <div className="border-b px-4 py-3">
            <h2 id="person-access-heading" className="text-sm font-semibold">
              View / Edit access for each person
            </h2>
            <p className="text-xs text-muted-foreground">
              Choose a department to see who can view or edit it, and change it just for them.
            </p>
          </div>
          <div className="space-y-4 p-4">
            {departmentsQ.isError ? (
              <LoadError
                what="departments"
                error={departmentsQ.error}
                onRetry={() => departmentsQ.refetch()}
              />
            ) : (
              <FormField id="permissions-department" label="Department" className="max-w-xs">
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger id="permissions-department" className="h-9">
                    <SelectValue
                      placeholder={
                        departmentsQ.isLoading ? "Loading departments…" : "Choose a department"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(departmentsQ.data ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
            <PermissionsPanel departmentId={departmentId || undefined} />
          </div>
        </section>
      </div>
    </RequireRole>
  );
}
