import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiJson } from "@/lib/api-client";
import { PageHeader } from "@/components/app-shell";
import { useAuth, ROLE_LABELS, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, ShieldOff, Mail } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [{ title: "Users & Roles — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: UsersAdmin,
});

const ALL_ROLES: AppRole[] = [
  "ceo",
  "system_admin",
  "finance",
  "hr",
  "it",
  "marketing",
  "tender",
  "department_head",
  "account_manager",
  "general_staff",
];

type Department = { id: string; name: string };
type Office = { id: string; name: string };

type AdminUser = {
  id: string;
  email: string;
  fullName: string | null;
  isActive: boolean;
  departmentId: string | null;
  officeId: string | null;
  roles: { role: AppRole }[];
  hasPassword: boolean;
};

const emptyCreateForm = {
  email: "",
  fullName: "",
  departmentId: "",
  officeId: "",
  roles: [] as AppRole[],
};

function UsersAdmin() {
  const { isAdminOrCeo } = useAuth();
  const qc = useQueryClient();

  const usersQ = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => apiJson<AdminUser[]>("/users"),
    enabled: isAdminOrCeo,
  });

  const departmentsQ = useQuery({
    queryKey: ["departments", "admin"],
    queryFn: () => apiJson<Department[]>("/departments"),
    enabled: isAdminOrCeo,
  });

  const officesQ = useQuery({
    queryKey: ["offices", "admin"],
    queryFn: () => apiJson<Office[]>("/offices"),
    enabled: isAdminOrCeo,
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Record<string, unknown> }) =>
      apiJson(`/users/${id}`, { method: "PATCH", body: JSON.stringify(dto) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed"),
  });

  const createUserMutation = useMutation({
    mutationFn: (dto: typeof emptyCreateForm) =>
      apiJson<{ inviteSent: boolean }>("/users", {
        method: "POST",
        body: JSON.stringify({
          email: dto.email,
          fullName: dto.fullName || undefined,
          departmentId: dto.departmentId || undefined,
          officeId: dto.officeId || undefined,
          roles: dto.roles,
        }),
      }),
    onSuccess: (res) => {
      toast.success(
        res.inviteSent
          ? "User created — invite email sent"
          : "User created — email not sent (SMTP not configured); share the setup link manually",
      );
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not create user"),
  });

  const resendInviteMutation = useMutation({
    mutationFn: (id: string) => apiJson<{ inviteSent: boolean }>(`/users/${id}/resend-invite`, { method: "POST" }),
    onSuccess: (res) => toast.success(res.inviteSent ? "Invite resent" : "Invite issued — email not sent (SMTP not configured)"),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not resend invite"),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);

  if (!isAdminOrCeo) {
    return (
      <div>
        <PageHeader title="Users & Roles" />
        <div className="rounded-lg border bg-card p-8 text-center">
          <ShieldOff className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Only the System Administrator and CEO can manage users.
          </p>
        </div>
      </div>
    );
  }

  const deptName = (id: string | null) =>
    id ? ((departmentsQ.data ?? []).find((d) => d.id === id)?.name ?? "—") : "—";

  const setRoles = (u: AdminUser, roles: AppRole[]) => {
    updateUserMutation.mutate({ id: u.id, dto: { roles } });
  };

  const updateDepartment = (u: AdminUser, departmentId: string | null) => {
    updateUserMutation.mutate({ id: u.id, dto: { departmentId } });
  };

  const toggleCreateRole = (role: AppRole, checked: boolean) => {
    setCreateForm((f) => ({
      ...f,
      roles: checked ? [...f.roles, role] : f.roles.filter((r) => r !== role),
    }));
  };

  const submitCreate = () => {
    if (!createForm.email || createForm.roles.length === 0) {
      toast.error("Email and at least one role are required");
      return;
    }
    createUserMutation.mutate(createForm, {
      onSuccess: () => {
        setCreateOpen(false);
        setCreateForm(emptyCreateForm);
      },
    });
  };

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        description="Manage staff access, roles and department assignments across AIMS."
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> New user
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>New user</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Work email</Label>
                  <Input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  An email will be sent to this address with a link to verify their email and set
                  their own password.
                </p>
                <div>
                  <Label>Full name</Label>
                  <Input
                    value={createForm.fullName}
                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Department</Label>
                    <Select
                      value={createForm.departmentId || "none"}
                      onValueChange={(v) =>
                        setCreateForm({ ...createForm, departmentId: v === "none" ? "" : v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {(departmentsQ.data ?? []).map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Office</Label>
                    <Select
                      value={createForm.officeId || "none"}
                      onValueChange={(v) =>
                        setCreateForm({ ...createForm, officeId: v === "none" ? "" : v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {(officesQ.data ?? []).map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Roles</Label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {ALL_ROLES.map((r) => (
                      <label key={r} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={createForm.roles.includes(r)}
                          onCheckedChange={(checked) => toggleCreateRole(r, checked === true)}
                        />
                        {ROLE_LABELS[r]}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submitCreate} disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  )}
                  Create user
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {usersQ.isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="w-56">Grant role</TableHead>
                <TableHead className="w-36">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(usersQ.data ?? []).map((u) => {
                const userRoles = u.roles.map((r) => r.role);
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium">{u.fullName || "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.departmentId ?? "none"}
                        onValueChange={(v) => updateDepartment(u, v === "none" ? null : v)}
                      >
                        <SelectTrigger className="h-8 w-52">
                          <SelectValue placeholder="Assign…">
                            {deptName(u.departmentId)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {(departmentsQ.data ?? []).map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {userRoles.length === 0 && (
                          <span className="text-xs text-muted-foreground">No roles</span>
                        )}
                        {userRoles.map((r) => (
                          <Badge
                            key={r}
                            variant="secondary"
                            className="cursor-pointer"
                            onClick={() =>
                              setRoles(
                                u,
                                userRoles.filter((x) => x !== r),
                              )
                            }
                            title="Click to remove"
                          >
                            {ROLE_LABELS[r]} ×
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value=""
                        onValueChange={(v) => setRoles(u, [...userRoles, v as AppRole])}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Add role…" />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_ROLES.filter((r) => !userRoles.includes(r)).map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {u.hasPassword ? (
                        <span className="text-xs text-muted-foreground">Active</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={resendInviteMutation.isPending}
                          onClick={() => resendInviteMutation.mutate(u.id)}
                        >
                          <Mail className="h-3 w-3 mr-1" /> Resend invite
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="mt-4 text-xs text-muted-foreground">
        New users are created by a System Administrator or the CEO using the "New user" button
        above. Click a role badge to remove it.
      </div>
    </div>
  );
}
