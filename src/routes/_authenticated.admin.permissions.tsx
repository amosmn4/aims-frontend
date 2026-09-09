import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { RequireRole } from "@/components/require-role";
import { PermissionsPanel } from "@/features/permissions/permissions-panel";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/permissions")({
  head: () => ({
    meta: [{ title: "Permissions — AIMS" }, { name: "robots", content: "noindex" }],
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
    <RequireRole
      roles={[]}
      message="Permissions management is restricted to System Administrator and CEO."
    >
      <div className="space-y-4 max-w-2xl">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Permissions
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Read/write access per person, per department — on top of what their role already grants
            by default.
          </p>
        </div>

        <div className="max-w-xs">
          <Label className="text-xs">Department</Label>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Choose a department" />
            </SelectTrigger>
            <SelectContent>
              {(departmentsQ.data ?? []).map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <PermissionsPanel departmentId={departmentId || undefined} />
        </div>
      </div>
    </RequireRole>
  );
}
