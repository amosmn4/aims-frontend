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
import { toast } from "sonner";
import { Loader2, Plus, ShieldOff } from "lucide-react";

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

  const [depOpen, setDepOpen] = useState(false);
  const [depForm, setDepForm] = useState({ code: "", name: "", description: "" });
  const [officeOpen, setOfficeOpen] = useState(false);
  const [officeForm, setOfficeForm] = useState({
    name: "",
    country: "",
    city: "",
    currencyCode: "KES",
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

  return (
    <div>
      <PageHeader
        title="Departments & Offices"
        description="Extend Amsol with new departments and regional offices without a code release."
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
    </div>
  );
}
