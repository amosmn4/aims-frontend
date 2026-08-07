import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiJson } from "@/lib/api-client";
import { PageHeader } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import { Loader2, Plus, ShieldOff, Trash2 } from "lucide-react";

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
  department: { id: string; code: string; name: string };
};

function DepartmentsAdmin() {
  const { isAdminOrCeo } = useAuth();
  const qc = useQueryClient();

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

  const addDepMutation = useMutation({
    mutationFn: (dto: { code: string; name: string; description: string }) =>
      apiJson("/departments", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => {
      toast.success("Department added");
      qc.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add department"),
  });

  const addOfficeMutation = useMutation({
    mutationFn: (dto: { name: string; country: string; city: string; currencyCode: string }) =>
      apiJson("/offices", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => {
      toast.success("Office added");
      qc.invalidateQueries({ queryKey: ["offices"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add office"),
  });

  const deleteDepMutation = useMutation({
    mutationFn: (id: string) => apiJson(`/departments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Department deleted");
      qc.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to delete department"),
  });

  const removeDep = async (id: string, name: string) => {
    const ok = await confirmDialog({
      title: `Delete ${name}?`,
      description: "Departments with any projects or tenders can't be deleted.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    deleteDepMutation.mutate(id);
  };

  const addServiceLineMutation = useMutation({
    mutationFn: (dto: { code: string; name: string; departmentId: string; isRecurring: boolean }) =>
      apiJson("/service-lines", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => {
      toast.success("Service line added");
      qc.invalidateQueries({ queryKey: ["service-lines"] });
      qc.invalidateQueries({ queryKey: ["finance", "service_lines"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to add service line"),
  });

  const deleteServiceLineMutation = useMutation({
    mutationFn: (id: string) => apiJson(`/service-lines/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Service line deleted");
      qc.invalidateQueries({ queryKey: ["service-lines"] });
      qc.invalidateQueries({ queryKey: ["finance", "service_lines"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to delete service line"),
  });

  const removeServiceLine = async (id: string, name: string) => {
    const ok = await confirmDialog({
      title: `Delete "${name}"?`,
      description: "Invoices/contracts referencing it keep their history.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    deleteServiceLineMutation.mutate(id);
  };

  const [depOpen, setDepOpen] = useState(false);
  const [depForm, setDepForm] = useState({ code: "", name: "", description: "" });
  const [officeOpen, setOfficeOpen] = useState(false);
  const [officeForm, setOfficeForm] = useState({
    name: "",
    country: "",
    city: "",
    currencyCode: "KES",
  });
  const [slOpen, setSlOpen] = useState(false);
  const [slForm, setSlForm] = useState({
    code: "",
    name: "",
    departmentId: "",
    isRecurring: false,
  });

  if (!isAdminOrCeo) {
    return (
      <div>
        <PageHeader title="Departments & Offices" />
        <div className="rounded-lg border bg-card p-8 text-center">
          <ShieldOff className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Admin access required.</p>
        </div>
      </div>
    );
  }

  const addDep = () => {
    if (!depForm.code || !depForm.name) return;
    addDepMutation.mutate(depForm, {
      onSuccess: () => {
        setDepOpen(false);
        setDepForm({ code: "", name: "", description: "" });
      },
    });
  };

  const addOffice = () => {
    if (!officeForm.name || !officeForm.country) return;
    addOfficeMutation.mutate(officeForm, {
      onSuccess: () => {
        setOfficeOpen(false);
        setOfficeForm({ name: "", country: "", city: "", currencyCode: "KES" });
      },
    });
  };

  const addServiceLine = () => {
    if (!slForm.code || !slForm.name || !slForm.departmentId) return;
    addServiceLineMutation.mutate(slForm, {
      onSuccess: () => {
        setSlOpen(false);
        setSlForm({ code: "", name: "", departmentId: "", isRecurring: false });
      },
    });
  };

  return (
    <div>
      <PageHeader
        title="Departments, Offices & Service Lines"
        description="Extend Amsol with new departments, regional offices and service lines without a code release."
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="rounded-lg border bg-card">
          <div className="p-4 flex items-center justify-between border-b">
            <h2 className="font-semibold">Departments</h2>
            <Dialog open={depOpen} onOpenChange={setDepOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" /> New
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New department</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Code</Label>
                    <Input
                      value={depForm.code}
                      onChange={(e) => setDepForm({ ...depForm, code: e.target.value })}
                      placeholder="legal"
                    />
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={depForm.name}
                      onChange={(e) => setDepForm({ ...depForm, name: e.target.value })}
                      placeholder="Legal & Compliance"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input
                      value={depForm.description}
                      onChange={(e) => setDepForm({ ...depForm, description: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={addDep} disabled={addDepMutation.isPending}>
                    {addDepMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {depsQ.isLoading ? (
            <div className="p-6 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(depsQ.data ?? []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="font-medium">{d.name}</div>
                      {d.description && (
                        <div className="text-xs text-muted-foreground">{d.description}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{d.code}</TableCell>
                    <TableCell>
                      {d.isCore ? <Badge>Core</Badge> : <Badge variant="secondary">Custom</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        disabled={deleteDepMutation.isPending}
                        onClick={() => removeDep(d.id, d.name)}
                        title="Delete department"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        <section className="rounded-lg border bg-card">
          <div className="p-4 flex items-center justify-between border-b">
            <h2 className="font-semibold">Offices</h2>
            <Dialog open={officeOpen} onOpenChange={setOfficeOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" /> New
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New office</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Office name</Label>
                    <Input
                      value={officeForm.name}
                      onChange={(e) => setOfficeForm({ ...officeForm, name: e.target.value })}
                      placeholder="Lagos Office"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Country</Label>
                      <Input
                        value={officeForm.country}
                        onChange={(e) => setOfficeForm({ ...officeForm, country: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>City</Label>
                      <Input
                        value={officeForm.city}
                        onChange={(e) => setOfficeForm({ ...officeForm, city: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Currency</Label>
                    <Input
                      value={officeForm.currencyCode}
                      onChange={(e) =>
                        setOfficeForm({
                          ...officeForm,
                          currencyCode: e.target.value.toUpperCase(),
                        })
                      }
                      maxLength={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={addOffice} disabled={addOfficeMutation.isPending}>
                    {addOfficeMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    )}
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {officesQ.isLoading ? (
            <div className="p-6 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Office</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Currency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(officesQ.data ?? []).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <div className="font-medium flex items-center gap-2">
                        {o.name}
                        {o.isHq && <Badge className="bg-accent text-accent-foreground">HQ</Badge>}
                      </div>
                      {o.city && <div className="text-xs text-muted-foreground">{o.city}</div>}
                    </TableCell>
                    <TableCell>{o.country}</TableCell>
                    <TableCell className="text-xs font-mono">{o.currencyCode}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>

      <section className="rounded-lg border bg-card mt-6">
        <div className="p-4 flex items-center justify-between border-b">
          <div>
            <h2 className="font-semibold">Service Lines</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Each service line belongs to the department that delivers it — used across Contracts,
              Invoices, Tenders and Client Requests.
            </p>
          </div>
          <Dialog open={slOpen} onOpenChange={setSlOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New service line</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Code</Label>
                  <Input
                    value={slForm.code}
                    onChange={(e) => setSlForm({ ...slForm, code: e.target.value.toUpperCase() })}
                    placeholder="OUTSOURCING"
                  />
                </div>
                <div>
                  <Label>Name</Label>
                  <Input
                    value={slForm.name}
                    onChange={(e) => setSlForm({ ...slForm, name: e.target.value })}
                    placeholder="Staff Outsourcing"
                  />
                </div>
                <div>
                  <Label>Delivering department</Label>
                  <Select
                    value={slForm.departmentId}
                    onValueChange={(v) => setSlForm({ ...slForm, departmentId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a department" />
                    </SelectTrigger>
                    <SelectContent>
                      {(depsQ.data ?? []).map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={slForm.isRecurring}
                    onCheckedChange={(v) => setSlForm({ ...slForm, isRecurring: v === true })}
                  />
                  Recurring service (e.g. monthly payroll/licensing)
                </label>
              </div>
              <DialogFooter>
                <Button onClick={addServiceLine} disabled={addServiceLineMutation.isPending}>
                  {addServiceLineMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  )}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {serviceLinesQ.isLoading ? (
          <div className="p-6 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(serviceLinesQ.data ?? []).map((sl) => (
                <TableRow key={sl.id}>
                  <TableCell className="font-medium">{sl.name}</TableCell>
                  <TableCell className="text-xs font-mono">{sl.code}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{sl.department.name}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {sl.isRecurring ? "Recurring" : "One-off"}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      disabled={deleteServiceLineMutation.isPending}
                      onClick={() => removeServiceLine(sl.id, sl.name)}
                      title="Delete service line"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
