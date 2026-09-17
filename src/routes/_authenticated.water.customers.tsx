import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Search } from "lucide-react";
import {
  useWaterCustomers,
  useDeleteWaterCustomer,
  useWaterAllZones,
  useCanManageWater,
  type WaterCustomerRow,
} from "@/features/water/use-water";
import { CustomerFormDialog, type CustomerFormValue } from "@/features/water/customer-form-dialog";
import { ListEmpty, ListNoMatches } from "@/features/water/water-ui";
import { RowActions } from "@/components/row-actions";
import { confirmDeleteCustomer, deleteErrorToast } from "@/features/water/water-delete";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/pagination-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/_authenticated/water/customers")({
  head: () => ({ meta: [{ title: "Water Project — Customers — AIMS" }] }),
  component: WaterCustomersPage,
});

const ALL = "__all__";

function WaterCustomersPage() {
  const canManage = useCanManageWater();
  const [zoneId, setZoneId] = useState("");
  const [q, setQ] = useState("");
  const { page, pageSize, setPage, setPageSize } = usePagination(25);

  const allZonesQ = useWaterAllZones();
  const customersQ = useWaterCustomers(
    { zoneId: zoneId || undefined, q: q.trim() || undefined },
    { page, pageSize },
  );
  const deleteCustomer = useDeleteWaterCustomer();
  const [editing, setEditing] = useState<CustomerFormValue | "new" | null>(null);

  const result = customersQ.data;
  const customers = result ? (Array.isArray(result) ? result : result.data) : [];
  const total = result && !Array.isArray(result) ? result.total : customers.length;
  const hasFilters = !!q.trim() || !!zoneId;

  const clearFilters = () => {
    setQ("");
    setZoneId("");
    setPage(1);
  };

  const handleDelete = async (c: WaterCustomerRow) => {
    if (!(await confirmDeleteCustomer({ name: c.name, meter_count: c.meters.length }))) return;
    deleteCustomer.mutate(c.id, {
      onSuccess: () => toast.success(`Customer "${c.name}" deleted`),
      onError: deleteErrorToast,
    });
  };

  const addButton = (
    <Button size="sm" onClick={() => setEditing("new")}>
      <Plus className="h-4 w-4 mr-1" /> Add customer
    </Button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        description="Everyone who has a household water meter. Registering a household meter adds its customer automatically."
        actions={canManage ? addButton : undefined}
      />
      {!canManage && <ViewOnlyBanner area="the Water Project" />}

      <div className="rounded-lg border bg-card p-3 flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, phone or meter number…"
            aria-label="Search customers"
            className="pl-7"
          />
        </div>
        <div className="w-full sm:w-44">
          <Select
            value={zoneId || ALL}
            onValueChange={(v) => {
              setZoneId(v === ALL ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9" aria-label="Filter by zone">
              <SelectValue placeholder="Zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All zones</SelectItem>
              {(allZonesQ.data ?? []).map((z) => (
                <SelectItem key={z.id} value={z.id}>
                  {z.parent_zone_id ? `↳ ${z.name}` : z.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {customersQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : customersQ.isError ? (
        <LoadError what="customers" error={customersQ.error} onRetry={() => customersQ.refetch()} />
      ) : customers.length === 0 ? (
        <div className="rounded-lg border bg-card">
          {hasFilters ? (
            <ListNoMatches onClear={clearFilters} />
          ) : (
            <ListEmpty message="No customers yet" action={canManage ? addButton : undefined} />
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Meter(s)</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && (
                    <TableHead className="w-20">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link
                        to="/water/customers/$customerId"
                        params={{ customerId: c.id }}
                        className="text-primary hover:underline"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{c.zone_name ?? "—"}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {c.meters.length > 0 ? c.meters.map((m) => m.meter_number).join(", ") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.phone ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          c.is_active
                            ? "bg-success/15 text-success"
                            : "bg-muted text-muted-foreground"
                        }
                        variant="secondary"
                      >
                        {c.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <RowActions
                          label={`customer ${c.name}`}
                          onEdit={() => setEditing(c)}
                          onDelete={() => handleDelete(c)}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      <CustomerFormDialog value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
