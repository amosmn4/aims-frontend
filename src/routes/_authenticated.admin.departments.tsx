import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, ShieldOff, Trash2 } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { PageHeader } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { confirmDialog } from "@/components/confirm-dialog";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { formatCurrency } from "@/features/finance/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/departments")({
  head: () => ({
    meta: [{ title: "Departments & Offices — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: DepartmentsAdmin,
});

type Department = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isCore: boolean;
};

type Office = {
  id: string;
  name: string;
  country: string;
  city: string | null;
  currencyCode: string;
  isHq: boolean;
};

type ServiceLine = {
  id: string;
  code: string;
  name: string;
  isRecurring: boolean;
  isActive?: boolean;
  monthlyTarget?: number | string | null;
  department: { id: string; code: string; name: string };
};

// Decimal targets arrive as strings; null means no target set.
const targetOf = (sl: ServiceLine) => (sl.monthlyTarget == null ? null : Number(sl.monthlyTarget));

const errText = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

type Errors<T> = Partial<Record<keyof T, string>>;

/** Form state with per-field errors that clear as the field changes. */
function useForm<T extends Record<string, unknown>>(initial: T) {
  const [form, setForm] = useState<T>(initial);
  const [errors, setErrors] = useState<Errors<T>>({});
  const dirty = (Object.keys(initial) as (keyof T)[]).some((k) => form[k] !== initial[k]);
  const patch = (p: Partial<T>) => {
    setForm((f) => ({ ...f, ...p }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(p)) delete next[k as keyof T];
      return next;
    });
  };
  return { form, patch, errors, setErrors, dirty };
}

function SectionState({
  isLoading,
  isError,
  error,
  onRetry,
  what,
}: {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  what: string;
}) {
  if (isError) return <LoadError what={what} error={error} onRetry={onRetry} className="m-4" />;
  if (isLoading)
    return (
      <div className="flex justify-center p-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  return null;
}

function DepartmentsAdmin() {
  const { isAdminOrCeo } = useAuth();
  const qc = useQueryClient();
  const [depOpen, setDepOpen] = useState(false);
  const [office, setOffice] = useState<Office | "new" | null>(null);
  const [serviceLine, setServiceLine] = useState<ServiceLine | "new" | null>(null);

  const depsQ = useQuery({
    queryKey: ["departments", "admin"],
    queryFn: () => apiJson<Department[]>("/departments"),
    enabled: isAdminOrCeo,
  });
  const officesQ = useQuery({
    queryKey: ["offices", "admin"],
    queryFn: () => apiJson<Office[]>("/offices"),
    enabled: isAdminOrCeo,
  });
  const serviceLinesQ = useQuery({
    queryKey: ["service-lines", "admin"],
    queryFn: () => apiJson<ServiceLine[]>("/service-lines"),
    enabled: isAdminOrCeo,
  });

  const deleteDep = useMutation({
    mutationFn: (id: string) => apiJson(`/departments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Department deleted");
      qc.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (err) => toast.error(errText(err, "Couldn't delete the department")),
  });

  const deleteServiceLine = useMutation({
    mutationFn: (id: string) => apiJson(`/service-lines/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Service line deleted");
      qc.invalidateQueries({ queryKey: ["service-lines"] });
      qc.invalidateQueries({ queryKey: ["finance", "service_lines"] });
    },
    onError: (err) => toast.error(errText(err, "Couldn't delete the service line")),
  });

  if (!isAdminOrCeo) {
    return (
      <div>
        <PageHeader
          title="Departments & Offices"
          description="The company's departments, offices and service lines."
        />
        <div className="rounded-lg border bg-card p-8 text-center">
          <ShieldOff className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">
            Only the CEO can change departments and offices.
          </p>
        </div>
      </div>
    );
  }

  const removeDep = async (d: Department) => {
    const ok = await confirmDialog({
      title: `Delete ${d.name}?`,
      description:
        "A department with projects, tenders or service lines can't be deleted. This can't be undone.",
      confirmLabel: "Delete department",
      destructive: true,
    });
    if (ok) deleteDep.mutate(d.id);
  };

  const removeServiceLine = async (sl: ServiceLine) => {
    const ok = await confirmDialog({
      title: `Delete "${sl.name}"?`,
      description: "Invoices and contracts that use it keep their history. This can't be undone.",
      confirmLabel: "Delete service line",
      destructive: true,
    });
    if (ok) deleteServiceLine.mutate(sl.id);
  };

  const departments = depsQ.data ?? [];
  const offices = officesQ.data ?? [];
  const serviceLines = serviceLinesQ.data ?? [];
  const companyTarget = serviceLines
    .filter((sl) => sl.isActive !== false)
    .reduce((sum, sl) => sum + (targetOf(sl) ?? 0), 0);

  const newOfficeButton = (
    <Button size="sm" variant="outline" onClick={() => setOffice("new")}>
      <Plus className="mr-1 h-4 w-4" /> New office
    </Button>
  );
  const newServiceLineButton = (
    <Button size="sm" variant="outline" onClick={() => setServiceLine("new")}>
      <Plus className="mr-1 h-4 w-4" /> New service line
    </Button>
  );

  return (
    <div>
      <PageHeader
        title="Departments & Offices"
        description="Add departments, regional offices and the service lines each department delivers."
        actions={
          <Button size="sm" onClick={() => setDepOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> New department
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-card" aria-labelledby="departments-heading">
          <div className="border-b p-4">
            <h2 id="departments-heading" className="font-semibold">
              Departments
            </h2>
          </div>
          <SectionState
            what="departments"
            isLoading={depsQ.isLoading}
            isError={depsQ.isError}
            error={depsQ.error}
            onRetry={() => depsQ.refetch()}
          />
          {depsQ.isSuccess &&
            (departments.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No departments yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="w-10">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div className="font-medium">{d.name}</div>
                        {d.description && (
                          <div className="text-xs text-muted-foreground">{d.description}</div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{d.code}</TableCell>
                      <TableCell>
                        {d.isCore ? (
                          <Badge>Built-in</Badge>
                        ) : (
                          <Badge variant="secondary">Added</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          disabled={deleteDep.isPending || d.isCore}
                          onClick={() => removeDep(d)}
                          title={
                            d.isCore ? "Built-in departments can't be deleted" : `Delete ${d.name}`
                          }
                          aria-label={
                            d.isCore
                              ? `${d.name} is built in and can't be deleted`
                              : `Delete department ${d.name}`
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ))}
        </section>

        <section className="rounded-lg border bg-card" aria-labelledby="offices-heading">
          <div className="flex items-center justify-between gap-2 border-b p-4">
            <h2 id="offices-heading" className="font-semibold">
              Offices
            </h2>
            {newOfficeButton}
          </div>
          <SectionState
            what="offices"
            isLoading={officesQ.isLoading}
            isError={officesQ.isError}
            error={officesQ.error}
            onRetry={() => officesQ.refetch()}
          />
          {officesQ.isSuccess &&
            (offices.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-muted-foreground">No offices yet.</p>
                <div className="mt-3">{newOfficeButton}</div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Office</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead className="w-10">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offices.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2 font-medium">
                          {o.name}
                          {o.isHq && (
                            <Badge className="bg-accent text-accent-foreground">Head office</Badge>
                          )}
                        </div>
                        {o.city && <div className="text-xs text-muted-foreground">{o.city}</div>}
                      </TableCell>
                      <TableCell>{o.country}</TableCell>
                      <TableCell className="font-mono text-xs">{o.currencyCode}</TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setOffice(o)}
                          title={`Edit ${o.name}`}
                          aria-label={`Edit office ${o.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ))}
        </section>
      </div>

      <section className="mt-6 rounded-lg border bg-card" aria-labelledby="service-lines-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div>
            <h2 id="service-lines-heading" className="font-semibold">
              Service lines
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              What each department sells. Used on contracts, invoices, tenders and client requests.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Company monthly target</div>
              <div className="text-sm font-semibold tabular-nums">
                {companyTarget > 0 ? formatCurrency(companyTarget) : "Not set"}
              </div>
            </div>
            {newServiceLineButton}
          </div>
        </div>
        <SectionState
          what="service lines"
          isLoading={serviceLinesQ.isLoading}
          isError={serviceLinesQ.isError}
          error={serviceLinesQ.error}
          onRetry={() => serviceLinesQ.refetch()}
        />
        {serviceLinesQ.isSuccess &&
          (serviceLines.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-muted-foreground">No service lines yet.</p>
              <div className="mt-3">{newServiceLineButton}</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Monthly target</TableHead>
                  <TableHead className="w-20">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serviceLines.map((sl) => (
                  <TableRow key={sl.id}>
                    <TableCell className="font-medium">{sl.name}</TableCell>
                    <TableCell className="font-mono text-xs">{sl.code}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{sl.department.name}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {sl.isRecurring ? "Recurring" : "One-off"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {targetOf(sl) == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        formatCurrency(targetOf(sl))
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setServiceLine(sl)}
                          title={`Edit ${sl.name}`}
                          aria-label={`Edit service line ${sl.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          disabled={deleteServiceLine.isPending}
                          onClick={() => removeServiceLine(sl)}
                          title={`Delete ${sl.name}`}
                          aria-label={`Delete service line ${sl.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ))}
      </section>

      {depOpen && <DepartmentDialog onClose={() => setDepOpen(false)} />}
      {office && (
        <OfficeDialog office={office === "new" ? null : office} onClose={() => setOffice(null)} />
      )}
      {serviceLine && (
        <ServiceLineDialog
          serviceLine={serviceLine === "new" ? null : serviceLine}
          departments={departments}
          onClose={() => setServiceLine(null)}
        />
      )}
    </div>
  );
}

function DialogButtons({
  onCancel,
  pending,
  label,
}: {
  onCancel: () => void;
  pending: boolean;
  label: string;
}) {
  return (
    <DialogFooter className="gap-2 sm:gap-2">
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
        {label}
      </Button>
    </DialogFooter>
  );
}

function DepartmentDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { form, patch, errors, setErrors, dirty } = useForm({
    code: "",
    name: "",
    description: "",
  });
  const { guardClose } = useUnsavedChanges(dirty);

  const save = useMutation({
    mutationFn: (dto: typeof form) =>
      apiJson("/departments", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => {
      toast.success("Department added");
      qc.invalidateQueries({ queryKey: ["departments"] });
      onClose();
    },
    onError: (err) => toast.error(errText(err, "Couldn't add the department")),
  });

  const submit = () => {
    const next: Errors<typeof form> = {};
    if (!form.code.trim()) next.code = "Enter a short code, e.g. legal";
    else if (!/^[a-z][a-z0-9_]*$/.test(form.code.trim()))
      next.code = "Use lowercase letters, numbers and underscores only, e.g. legal";
    if (!form.name.trim()) next.name = "Enter the department name";
    setErrors(next);
    if (Object.keys(next).length === 0)
      save.mutate({
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
      });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onClose)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New department</DialogTitle>
          <DialogDescription>
            It appears in department pickers straight away. Give people access on Roles &amp;
            Permissions.
          </DialogDescription>
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
          <FormField id="dep-name" label="Name" required error={errors.name}>
            <Input
              id="dep-name"
              value={form.name}
              aria-invalid={!!errors.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="e.g. Legal & Compliance"
              autoFocus
            />
          </FormField>
          <FormField
            id="dep-code"
            label="Code"
            required
            error={errors.code}
            hint="A short name used inside AIMS. It can't be changed later."
          >
            <Input
              id="dep-code"
              value={form.code}
              aria-invalid={!!errors.code}
              onChange={(e) => patch({ code: e.target.value.toLowerCase() })}
              placeholder="e.g. legal"
            />
          </FormField>
          <FormField id="dep-description" label="Description">
            <Input
              id="dep-description"
              value={form.description}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </FormField>
          <DialogButtons
            onCancel={() => guardClose(onClose)}
            pending={save.isPending}
            label="Add department"
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OfficeDialog({ office, onClose }: { office: Office | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { form, patch, errors, setErrors, dirty } = useForm({
    name: office?.name ?? "",
    country: office?.country ?? "",
    city: office?.city ?? "",
    currencyCode: office?.currencyCode ?? "KES",
    isHq: office?.isHq ?? false,
  });
  const { guardClose } = useUnsavedChanges(dirty);

  const save = useMutation({
    mutationFn: (dto: typeof form) =>
      apiJson(office ? `/offices/${office.id}` : "/offices", {
        method: office ? "PATCH" : "POST",
        body: JSON.stringify(dto),
      }),
    onSuccess: () => {
      toast.success(office ? "Office saved" : "Office added");
      qc.invalidateQueries({ queryKey: ["offices"] });
      qc.invalidateQueries({ queryKey: ["offices-lite"] });
      onClose();
    },
    onError: (err) => toast.error(errText(err, "Couldn't save the office")),
  });

  const submit = () => {
    const next: Errors<typeof form> = {};
    if (!form.name.trim()) next.name = "Enter the office name";
    if (!form.country.trim()) next.country = "Enter the country";
    if (form.currencyCode.trim().length !== 3)
      next.currencyCode = "Enter a 3-letter currency, e.g. KES";
    setErrors(next);
    if (Object.keys(next).length === 0)
      save.mutate({
        name: form.name.trim(),
        country: form.country.trim(),
        city: form.city.trim(),
        currencyCode: form.currencyCode.trim(),
        isHq: form.isHq,
      });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onClose)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{office ? `Edit ${office.name}` : "New office"}</DialogTitle>
          <DialogDescription>
            Staff can be assigned to an office on the Staff page.
          </DialogDescription>
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
          <FormField id="office-name" label="Office name" required error={errors.name}>
            <Input
              id="office-name"
              value={form.name}
              aria-invalid={!!errors.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="e.g. Lagos office"
            />
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="office-country" label="Country" required error={errors.country}>
              <Input
                id="office-country"
                value={form.country}
                aria-invalid={!!errors.country}
                onChange={(e) => patch({ country: e.target.value })}
              />
            </FormField>
            <FormField id="office-city" label="City">
              <Input
                id="office-city"
                value={form.city}
                onChange={(e) => patch({ city: e.target.value })}
              />
            </FormField>
          </div>
          <FormField id="office-currency" label="Currency" required error={errors.currencyCode}>
            <Input
              id="office-currency"
              value={form.currencyCode}
              aria-invalid={!!errors.currencyCode}
              onChange={(e) => patch({ currencyCode: e.target.value.toUpperCase() })}
              maxLength={3}
              className="sm:w-32"
            />
          </FormField>
          <div className="flex items-start justify-between gap-4 rounded-md border p-3">
            <div>
              <Label htmlFor="office-hq">Head office</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Only one office can be the head office. Turning this on moves it here.
              </p>
            </div>
            <Switch
              id="office-hq"
              checked={form.isHq}
              onCheckedChange={(v) => patch({ isHq: v })}
            />
          </div>
          <DialogButtons
            onCancel={() => guardClose(onClose)}
            pending={save.isPending}
            label={office ? "Save office" : "Add office"}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ServiceLineDialog({
  serviceLine,
  departments,
  onClose,
}: {
  serviceLine: ServiceLine | null;
  departments: Department[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const target = serviceLine ? targetOf(serviceLine) : null;
  const { form, patch, errors, setErrors, dirty } = useForm({
    code: serviceLine?.code ?? "",
    name: serviceLine?.name ?? "",
    departmentId: serviceLine?.department.id ?? "",
    isRecurring: serviceLine?.isRecurring ?? false,
    monthlyTarget: target == null ? "" : String(target),
  });
  const { guardClose } = useUnsavedChanges(dirty);

  const save = useMutation({
    mutationFn: (dto: {
      code: string;
      name: string;
      departmentId: string;
      isRecurring: boolean;
      monthlyTarget: number | null;
    }) =>
      apiJson(serviceLine ? `/service-lines/${serviceLine.id}` : "/service-lines", {
        method: serviceLine ? "PATCH" : "POST",
        body: JSON.stringify(dto),
      }),
    onSuccess: () => {
      toast.success(serviceLine ? "Service line saved" : "Service line added");
      qc.invalidateQueries({ queryKey: ["service-lines"] });
      qc.invalidateQueries({ queryKey: ["finance", "service_lines"] });
      onClose();
    },
    onError: (err) => toast.error(errText(err, "Couldn't save the service line")),
  });

  const submit = () => {
    const next: Errors<typeof form> = {};
    if (!form.code.trim()) next.code = "Enter a short code, e.g. OUTSOURCING";
    if (!form.name.trim()) next.name = "Enter the service line name";
    if (!form.departmentId) next.departmentId = "Choose the department that delivers it";
    const amount = form.monthlyTarget.trim() === "" ? null : Number(form.monthlyTarget);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0))
      next.monthlyTarget = "Enter a target of 0 or more, or leave it empty";
    setErrors(next);
    if (Object.keys(next).length === 0)
      save.mutate({
        code: form.code.trim(),
        name: form.name.trim(),
        departmentId: form.departmentId,
        isRecurring: form.isRecurring,
        monthlyTarget: amount,
      });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onClose)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{serviceLine ? `Edit ${serviceLine.name}` : "New service line"}</DialogTitle>
          <DialogDescription>
            Something a department sells, like payroll or recruitment.
          </DialogDescription>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="sl-name" label="Name" required error={errors.name}>
              <Input
                id="sl-name"
                value={form.name}
                aria-invalid={!!errors.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="e.g. Staff outsourcing"
              />
            </FormField>
            <FormField id="sl-code" label="Code" required error={errors.code}>
              <Input
                id="sl-code"
                value={form.code}
                aria-invalid={!!errors.code}
                onChange={(e) => patch({ code: e.target.value.toUpperCase() })}
                placeholder="e.g. OUTSOURCING"
              />
            </FormField>
          </div>
          <FormField
            id="sl-department"
            label="Delivering department"
            required
            error={errors.departmentId}
          >
            <Select value={form.departmentId} onValueChange={(v) => patch({ departmentId: v })}>
              <SelectTrigger id="sl-department" aria-invalid={!!errors.departmentId}>
                <SelectValue placeholder="Choose a department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            id="sl-target"
            label="Monthly revenue target (KES)"
            error={errors.monthlyTarget}
            hint="Revenue before VAT this line should bring in each month. Leave empty for no target."
          >
            <Input
              id="sl-target"
              type="number"
              min="0"
              step="1000"
              inputMode="decimal"
              value={form.monthlyTarget}
              aria-invalid={!!errors.monthlyTarget}
              onChange={(e) => patch({ monthlyTarget: e.target.value })}
              placeholder="e.g. 500000"
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.isRecurring}
              onCheckedChange={(v) => patch({ isRecurring: v === true })}
            />
            Recurring service (e.g. monthly payroll or licensing)
          </label>
          <DialogButtons
            onCancel={() => guardClose(onClose)}
            pending={save.isPending}
            label={serviceLine ? "Save service line" : "Add service line"}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
