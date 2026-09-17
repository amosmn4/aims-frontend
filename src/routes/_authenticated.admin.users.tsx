import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, Mail, Pencil, Plus, ShieldOff, Trash2, X } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { PageHeader } from "@/components/app-shell";
import { useAuth, ROLE_LABELS, type AppRole } from "@/lib/auth";
import { formatDateTime, formatRelative } from "@/lib/format-date";
import { confirmDialog } from "@/components/confirm-dialog";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { PaginationBar } from "@/components/pagination-bar";
import { usePagination, type PaginatedResponse } from "@/hooks/use-pagination";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [{ title: "Staff — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: UsersAdmin,
});

const STAFF_ROLES: AppRole[] = [
  "ceo",
  "finance",
  "hr",
  "it",
  "marketing",
  "tender",
  "operations",
  "water",
  "department_head",
  "account_manager",
  "general_staff",
];

// Department codes that are also roles: joining the department grants its working role.
const DEPARTMENT_ROLE_CODES: AppRole[] = [
  "finance",
  "hr",
  "it",
  "marketing",
  "tender",
  "operations",
];

type Department = { id: string; name: string; code: string };
type Office = { id: string; name: string };

type AdminUser = {
  id: string;
  email: string;
  fullName: string | null;
  jobTitle: string | null;
  phone: string | null;
  isActive: boolean;
  departmentId: string | null;
  officeId: string | null;
  roles: { role: AppRole }[];
  hasPassword: boolean;
  lastActiveAt: string | null;
};

const PHONE_RE = /^\+?[\d\s()-]{9,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NONE = "none";

const errText = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;
const nameOf = (u: AdminUser) => u.fullName || u.email;
const shownRoles = (u: AdminUser) =>
  u.roles.map((r) => r.role).filter((r) => STAFF_ROLES.includes(r));

const impliedRoleFor = (departments: Department[], departmentId: string) => {
  const code = departments.find((d) => d.id === departmentId)?.code as AppRole | undefined;
  return code && DEPARTMENT_ROLE_CODES.includes(code) ? code : null;
};

function UsersAdmin() {
  const { isAdminOrCeo, profile } = useAuth();
  const qc = useQueryClient();
  const { page, pageSize, setPage, setPageSize } = usePagination(25);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const usersQ = useQuery({
    queryKey: ["admin", "users", page, pageSize],
    queryFn: () =>
      apiJson<PaginatedResponse<AdminUser>>(`/users?page=${page}&pageSize=${pageSize}`),
    enabled: isAdminOrCeo,
  });
  const users = usersQ.data?.data ?? [];

  const departmentsQ = useQuery({
    queryKey: ["departments", "admin"],
    queryFn: () => apiJson<Department[]>("/departments"),
    enabled: isAdminOrCeo,
  });
  const departments = departmentsQ.data ?? [];

  const officesQ = useQuery({
    queryKey: ["offices", "admin"],
    queryFn: () => apiJson<Office[]>("/offices"),
    enabled: isAdminOrCeo,
  });

  const updateUser = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Record<string, unknown> }) =>
      apiJson(`/users/${id}`, { method: "PATCH", body: JSON.stringify(dto) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
    onError: (err) => toast.error(errText(err, "Couldn't save the change")),
  });

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link).then(
      () => toast.success("Link copied"),
      () => toast.error("Couldn't copy. Copy it from here instead: " + link),
    );
  };

  // The raw link is always offered, in case the email couldn't be sent.
  const notifySetupLink = (
    res: { inviteSent: boolean; setupLink: string },
    sent: string,
    unsent: string,
  ) => {
    const action = { label: "Copy link", onClick: () => copyLink(res.setupLink) };
    if (res.inviteSent) toast.success(sent, { action });
    else toast.warning(unsent, { action });
  };

  const resendInvite = useMutation({
    mutationFn: (id: string) =>
      apiJson<{ inviteSent: boolean; setupLink: string }>(`/users/${id}/resend-invite`, {
        method: "POST",
      }),
    onSuccess: (res) =>
      notifySetupLink(
        res,
        "Invite sent again",
        "Invite ready, but the email couldn't be sent. Copy the link and send it to them.",
      ),
    onError: (err) => toast.error(errText(err, "Couldn't send the invite")),
  });

  const resetPassword = useMutation({
    mutationFn: (id: string) =>
      apiJson<{ inviteSent: boolean; setupLink: string }>(`/users/${id}/reset-password`, {
        method: "POST",
      }),
    onSuccess: (res) =>
      notifySetupLink(
        res,
        "Password reset link sent",
        "Reset link ready, but the email couldn't be sent. Copy the link and send it to them.",
      ),
    onError: (err) => toast.error(errText(err, "Couldn't send the reset link")),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => apiJson(`/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Staff member deleted");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err) => toast.error(errText(err, "Couldn't delete the staff member")),
  });

  if (!isAdminOrCeo) {
    return (
      <div>
        <PageHeader title="Staff" description="Everyone who can sign in to AIMS." />
        <div className="rounded-lg border bg-card p-8 text-center">
          <ShieldOff className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">Only the CEO can manage staff.</p>
        </div>
      </div>
    );
  }

  const removeUser = async (u: AdminUser) => {
    const ok = await confirmDialog({
      title: `Delete ${nameOf(u)}?`,
      description: "They won't be able to sign in any more. This can't be undone.",
      confirmLabel: "Delete staff member",
      destructive: true,
    });
    if (ok) deleteUser.mutate(u.id);
  };

  const removeRole = async (u: AdminUser, role: AppRole) => {
    const ok = await confirmDialog({
      title: `Remove the ${ROLE_LABELS[role]} role?`,
      description: `${nameOf(u)} loses what this role lets them do straight away.`,
      confirmLabel: "Remove role",
      destructive: true,
    });
    if (!ok) return;
    updateUser.mutate(
      { id: u.id, dto: { roles: u.roles.map((r) => r.role).filter((r) => r !== role) } },
      { onSuccess: () => toast.success(`${ROLE_LABELS[role]} role removed`) },
    );
  };

  const addRole = (u: AdminUser, role: AppRole) =>
    updateUser.mutate(
      { id: u.id, dto: { roles: [...u.roles.map((r) => r.role), role] } },
      { onSuccess: () => toast.success(`${nameOf(u)} now has the ${ROLE_LABELS[role]} role`) },
    );

  const updateDepartment = (u: AdminUser, departmentId: string | null) => {
    const userRoles = u.roles.map((r) => r.role);
    const implied = departmentId ? impliedRoleFor(departments, departmentId) : null;
    const roles = implied && !userRoles.includes(implied) ? [...userRoles, implied] : undefined;
    updateUser.mutate(
      { id: u.id, dto: { departmentId, ...(roles && { roles }) } },
      { onSuccess: () => toast.success("Department saved") },
    );
  };

  const newButton = (
    <Button size="sm" onClick={() => setCreateOpen(true)}>
      <Plus className="mr-1 h-4 w-4" /> New staff member
    </Button>
  );

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Add staff, set their department and roles, and see who is active."
        actions={newButton}
      />

      {usersQ.isError ? (
        <LoadError what="staff" error={usersQ.error} onRetry={() => usersQ.refetch()} />
      ) : usersQ.isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : users.length === 0 && (usersQ.data?.total ?? 0) === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-12 text-center">
          <p className="text-sm font-medium">No staff yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add someone and we'll email them a link to set their password.
          </p>
          <div className="mt-3">{newButton}</div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          {departmentsQ.isError && (
            <p role="alert" className="border-b px-4 py-2 text-xs text-destructive">
              Couldn't load departments, so they can't be changed right now.{" "}
              <button type="button" className="underline" onClick={() => departmentsQ.refetch()}>
                Try again
              </button>
            </p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff member</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="w-48">Give a role</TableHead>
                <TableHead className="w-36">Last active</TableHead>
                <TableHead className="w-36">Status</TableHead>
                <TableHead className="w-28">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const roles = shownRoles(u);
                const isMe = u.id === profile?.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium">{u.fullName || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {[u.jobTitle, u.email, u.phone].filter(Boolean).join(" · ")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.departmentId ?? NONE}
                        disabled={departmentsQ.isError}
                        onValueChange={(v) => updateDepartment(u, v === NONE ? null : v)}
                      >
                        <SelectTrigger
                          className="h-8 w-48"
                          aria-label={`Department for ${nameOf(u)}`}
                        >
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Unassigned</SelectItem>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {roles.length === 0 && (
                          <span className="text-xs text-muted-foreground">No roles</span>
                        )}
                        {roles.map((r) => (
                          <Badge key={r} variant="secondary" className="gap-1 pr-1">
                            {ROLE_LABELS[r]}
                            <button
                              type="button"
                              className="rounded-sm p-0.5 hover:bg-background/60"
                              onClick={() => removeRole(u, r)}
                              aria-label={`Remove the ${ROLE_LABELS[r]} role from ${nameOf(u)}`}
                              title="Remove role"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select value="" onValueChange={(v) => addRole(u, v as AppRole)}>
                        <SelectTrigger className="h-8" aria-label={`Give ${nameOf(u)} a role`}>
                          <SelectValue placeholder="Give a role…" />
                        </SelectTrigger>
                        <SelectContent>
                          {STAFF_ROLES.filter((r) => !roles.includes(r)).map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {u.lastActiveAt ? (
                        <time dateTime={u.lastActiveAt} title={formatDateTime(u.lastActiveAt)}>
                          {formatRelative(u.lastActiveAt)}
                        </time>
                      ) : (
                        <span className="text-muted-foreground">Never signed in</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.hasPassword ? (
                        <span className="text-xs text-muted-foreground">
                          {u.isActive ? "Active" : "Deactivated"}
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          disabled={resendInvite.isPending}
                          onClick={() => resendInvite.mutate(u.id)}
                          aria-label={`Resend invite to ${nameOf(u)}`}
                        >
                          <Mail className="mr-1 h-3.5 w-3.5" /> Resend invite
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => setEditing(u)}
                          title="Edit details"
                          aria-label={`Edit details for ${nameOf(u)}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {u.hasPassword && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            disabled={resetPassword.isPending}
                            onClick={() => resetPassword.mutate(u.id)}
                            title="Send password reset link"
                            aria-label={`Send a password reset link to ${nameOf(u)}`}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive disabled:opacity-30"
                          disabled={deleteUser.isPending || isMe}
                          onClick={() => removeUser(u)}
                          title={isMe ? "You can't delete your own account" : "Delete staff member"}
                          aria-label={
                            isMe ? "You can't delete your own account" : `Delete ${nameOf(u)}`
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <PaginationBar
            page={usersQ.data?.page ?? page}
            pageSize={usersQ.data?.pageSize ?? pageSize}
            total={usersQ.data?.total ?? 0}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {createOpen && (
        <NewStaffDialog
          departments={departments}
          offices={officesQ.data ?? []}
          onClose={() => setCreateOpen(false)}
          onCreated={(res) =>
            notifySetupLink(
              res,
              "Staff member added. We emailed them a link to set their password.",
              "Staff member added, but the email couldn't be sent. Copy the link and send it to them.",
            )
          }
        />
      )}

      {editing && (
        <EditStaffDialog
          user={editing}
          offices={officesQ.data ?? []}
          saving={updateUser.isPending}
          onClose={() => setEditing(null)}
          onSave={(dto) =>
            updateUser.mutate(
              { id: editing.id, dto },
              {
                onSuccess: () => {
                  toast.success("Details saved");
                  setEditing(null);
                },
              },
            )
          }
        />
      )}
    </div>
  );
}

const emptyCreateForm = {
  email: "",
  fullName: "",
  jobTitle: "",
  phone: "",
  departmentId: "",
  officeId: "",
  roles: [] as AppRole[],
};
type CreateForm = typeof emptyCreateForm;

function NewStaffDialog({
  departments,
  offices,
  onClose,
  onCreated,
}: {
  departments: Department[];
  offices: Office[];
  onClose: () => void;
  onCreated: (res: { inviteSent: boolean; setupLink: string }) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CreateForm>(emptyCreateForm);
  const [errors, setErrors] = useState<Partial<Record<"email" | "roles" | "phone", string>>>({});
  const dirty =
    form.roles.length > 0 ||
    (Object.keys(emptyCreateForm) as (keyof CreateForm)[]).some(
      (k) => k !== "roles" && form[k] !== emptyCreateForm[k],
    );
  const { guardClose } = useUnsavedChanges(dirty);

  const create = useMutation({
    mutationFn: (dto: CreateForm) =>
      apiJson<{ inviteSent: boolean; setupLink: string }>("/users", {
        method: "POST",
        body: JSON.stringify({
          email: dto.email.trim(),
          fullName: dto.fullName.trim() || undefined,
          jobTitle: dto.jobTitle.trim() || undefined,
          phone: dto.phone.trim() || undefined,
          departmentId: dto.departmentId || undefined,
          officeId: dto.officeId || undefined,
          roles: dto.roles,
        }),
      }),
    onSuccess: (res) => {
      onCreated(res);
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      onClose();
    },
    onError: (err) => toast.error(errText(err, "Couldn't add the staff member")),
  });

  const patch = (p: Partial<CreateForm>) => {
    setForm((f) => ({ ...f, ...p }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(p)) delete next[k as keyof typeof next];
      return next;
    });
  };

  const submit = () => {
    const next: typeof errors = {};
    if (!EMAIL_RE.test(form.email.trim())) next.email = "Enter their work email";
    if (form.roles.length === 0) next.roles = "Choose at least one role";
    if (form.phone.trim() && !PHONE_RE.test(form.phone.trim()))
      next.phone = "Enter a phone number like 0712 345 678";
    setErrors(next);
    if (Object.keys(next).length === 0) create.mutate(form);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onClose)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New staff member</DialogTitle>
          <DialogDescription>We'll email them a link to set their password.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <RequiredNote />
          <FormField id="new-staff-email" label="Work email" required error={errors.email}>
            <Input
              id="new-staff-email"
              type="email"
              value={form.email}
              aria-invalid={!!errors.email}
              onChange={(e) => patch({ email: e.target.value })}
              autoFocus
            />
          </FormField>
          <FormField id="new-staff-name" label="Full name">
            <Input
              id="new-staff-name"
              value={form.fullName}
              onChange={(e) => patch({ fullName: e.target.value })}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="new-staff-job" label="Job title">
              <Input
                id="new-staff-job"
                value={form.jobTitle}
                onChange={(e) => patch({ jobTitle: e.target.value })}
              />
            </FormField>
            <FormField id="new-staff-phone" label="Phone number" error={errors.phone}>
              <Input
                id="new-staff-phone"
                type="tel"
                placeholder="0712 345 678"
                value={form.phone}
                aria-invalid={!!errors.phone}
                onChange={(e) => patch({ phone: e.target.value })}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              id="new-staff-department"
              label="Department"
              hint="Also gives them that department's role."
            >
              <Select
                value={form.departmentId || NONE}
                onValueChange={(v) => {
                  const departmentId = v === NONE ? "" : v;
                  const implied = departmentId ? impliedRoleFor(departments, departmentId) : null;
                  patch({
                    departmentId,
                    roles:
                      implied && !form.roles.includes(implied)
                        ? [...form.roles, implied]
                        : form.roles,
                  });
                }}
              >
                <SelectTrigger id="new-staff-department" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Unassigned</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="new-staff-office" label="Office">
              <Select
                value={form.officeId || NONE}
                onValueChange={(v) => patch({ officeId: v === NONE ? "" : v })}
              >
                <SelectTrigger id="new-staff-office" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Unassigned</SelectItem>
                  {offices.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <fieldset aria-describedby={errors.roles ? "new-staff-roles-error" : undefined}>
            <legend className="text-sm font-medium">
              Roles
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
              <span className="sr-only"> (required)</span>
            </legend>
            <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {STAFF_ROLES.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.roles.includes(r)}
                    onCheckedChange={(checked) =>
                      patch({
                        roles:
                          checked === true ? [...form.roles, r] : form.roles.filter((x) => x !== r),
                      })
                    }
                  />
                  {ROLE_LABELS[r]}
                </label>
              ))}
            </div>
            {errors.roles && (
              <p id="new-staff-roles-error" role="alert" className="mt-1 text-xs text-destructive">
                {errors.roles}
              </p>
            )}
          </fieldset>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => guardClose(onClose)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Add staff member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditStaffDialog({
  user,
  offices,
  saving,
  onClose,
  onSave,
}: {
  user: AdminUser;
  offices: Office[];
  saving: boolean;
  onClose: () => void;
  onSave: (dto: Record<string, unknown>) => void;
}) {
  const initial = {
    fullName: user.fullName ?? "",
    jobTitle: user.jobTitle ?? "",
    phone: user.phone ?? "",
    officeId: user.officeId ?? NONE,
  };
  const [form, setForm] = useState(initial);
  const [phoneError, setPhoneError] = useState("");
  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some(
    (k) => form[k] !== initial[k],
  );
  const { guardClose } = useUnsavedChanges(dirty);

  const save = () => {
    if (form.phone.trim() && !PHONE_RE.test(form.phone.trim())) {
      setPhoneError("Enter a phone number like 0712 345 678");
      return;
    }
    onSave({
      fullName: form.fullName.trim() || undefined,
      jobTitle: form.jobTitle.trim() || null,
      phone: form.phone.trim() || null,
      officeId: form.officeId === NONE ? undefined : form.officeId,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && guardClose(onClose)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {nameOf(user)}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <FormField id="edit-staff-name" label="Full name">
            <Input
              id="edit-staff-name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="edit-staff-job" label="Job title">
              <Input
                id="edit-staff-job"
                value={form.jobTitle}
                onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
              />
            </FormField>
            <FormField id="edit-staff-phone" label="Phone number" error={phoneError}>
              <Input
                id="edit-staff-phone"
                type="tel"
                placeholder="0712 345 678"
                value={form.phone}
                aria-invalid={!!phoneError}
                onChange={(e) => {
                  setForm({ ...form, phone: e.target.value });
                  setPhoneError("");
                }}
              />
            </FormField>
          </div>
          <FormField id="edit-staff-office" label="Office">
            <Select value={form.officeId} onValueChange={(v) => setForm({ ...form, officeId: v })}>
              <SelectTrigger id="edit-staff-office" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {offices.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => guardClose(onClose)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Save details
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
