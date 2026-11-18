import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, PageHeader, Pill } from "@/components/kit";
import { RecordDialog, SearchField, EmptyState } from "@/components/RecordDialog";
import { Button } from "@/components/ui/button";
import { api, isDemo } from "@/lib/api";
import { useModuleAccess } from "@/lib/modules";

export const Route = createFileRoute("/inventory")({
  component: Inventory,
  head: () => ({ meta: [{ title: "Inventory | Amsol Ops" }] }),
});
type Item = {
  id: string;
  assetTag: string;
  deviceName: string;
  description: string | null;
  category: string;
  status: string;
  condition: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  assignedTo: string | null;
  officeId: string | null;
  departmentId: string | null;
  assignedUserId: string | null;
  purchaseDate: string | null;
  warrantyExpiry: string | null;
  notes: string | null;
  purchaseCost: string | number | null;
  usefulLifeMonths: number | null;
  currentValue: number | null;
  office: { name: string } | null;
  assignedUser: { fullName: string } | null;
};
type Options = {
  offices: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  staff: { id: string; name: string }[];
  categories: string[];
  statuses: string[];
  conditions: string[];
};
function Inventory() {
  const access = useModuleAccess("inventory");
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    category: "",
    status: "",
    condition: "",
    officeId: "",
    departmentId: "",
    assignedUserId: "",
  });
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<Item | "new" | null>(null);
  const [view, setView] = useState<Item | null>(null);
  const params = new URLSearchParams({ page: String(page), pageSize: "25" });
  if (search.trim()) params.set("q", search.trim());
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const options = useQuery({
    queryKey: ["inventory-options"],
    queryFn: () => api<Options>("/inventory/options"),
    enabled: !!access,
  });
  const query = useQuery({
    queryKey: ["inventory", params.toString()],
    queryFn: () => api<{ data: Item[]; total: number }>(`/inventory?${params}`),
    enabled: !!access,
  });
  if (isDemo || !access)
    return (
      <Card>Inventory is available to assigned staff and the CEO in the connected workspace.</Card>
    );
  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory"
        subtitle="Company assets, assignments and condition"
        action={
          access === "manage" ? (
            <Button onClick={() => setEdit("new")}>Add asset</Button>
          ) : undefined
        }
      />
      <SearchField
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Search assets in the selected filters"
      />
      <div className="flex flex-wrap gap-3">
        {(
          [
            ["category", "Category", options.data?.categories],
            ["status", "Status", options.data?.statuses],
            ["condition", "Condition", options.data?.conditions],
            ["officeId", "Office", options.data?.offices],
            ["departmentId", "Department", options.data?.departments],
            ["assignedUserId", "Assigned staff", options.data?.staff],
          ] as const
        ).map(([key, label, values]) => (
          <label className="field-label" key={key}>
            {label}
            <select
              className="field-input"
              value={filters[key]}
              onChange={(event) => {
                setFilters({ ...filters, [key]: event.target.value });
                setPage(1);
              }}
            >
              <option value="">All</option>
              {values?.map((value) => (
                <option
                  key={typeof value === "string" ? value : value.id}
                  value={typeof value === "string" ? value : value.id}
                >
                  {typeof value === "string" ? value.replaceAll("_", " ") : value.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {(query.error || options.error) && (
        <p role="alert">{query.error?.message ?? options.error?.message}</p>
      )}
      {query.isPending ? (
        <p role="status">Loading inventory...</p>
      ) : !query.data?.data.length ? (
        <EmptyState>No assets match these filters.</EmptyState>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                {[
                  "Asset",
                  "Category",
                  "Status",
                  "Condition",
                  "Assigned to",
                  "Office",
                  "Current value",
                  "",
                ].map((title) => (
                  <th className="p-4" key={title}>
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data.data.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="p-4">
                    <button
                      className="font-medium text-primary hover:underline"
                      onClick={() => setView(item)}
                    >
                      {item.deviceName}
                    </button>
                    <p className="text-xs text-muted-foreground">
                      {item.assetTag}
                      {item.serialNumber ? ` | ${item.serialNumber}` : ""}
                    </p>
                  </td>
                  <td className="p-4">{item.category}</td>
                  <td className="p-4">
                    <Pill>{item.status.replaceAll("_", " ")}</Pill>
                  </td>
                  <td className="p-4">{item.condition.replaceAll("_", " ")}</td>
                  <td className="p-4">
                    {item.assignedUser?.fullName ?? item.assignedTo ?? "Unassigned"}
                  </td>
                  <td className="p-4">{item.office?.name ?? "Unspecified"}</td>
                  <td className="p-4">
                    {item.currentValue == null
                      ? "Not recorded"
                      : `KES ${item.currentValue.toLocaleString("en-KE")}`}
                  </td>
                  <td className="p-4">
                    {access === "manage" && (
                      <Button variant="ghost" onClick={() => setEdit(item)}>
                        Edit
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <div className="flex items-center gap-3 text-sm">
        <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous
        </Button>
        <span>
          Page {page} | {query.data?.total ?? 0} matching assets
        </span>
        <Button
          variant="outline"
          disabled={page * 25 >= (query.data?.total ?? 0)}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
      {view && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setView(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{view.deviceName}</DialogTitle>
              <DialogDescription>{view.assetTag}</DialogDescription>
            </DialogHeader>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {[
                ["Description", view.description],
                ["Category", view.category],
                ["Status", view.status.replaceAll("_", " ")],
                ["Condition", view.condition.replaceAll("_", " ")],
                ["Brand", view.brand],
                ["Model", view.model],
                ["Serial number", view.serialNumber],
                ["Assigned staff", view.assignedUser?.fullName ?? view.assignedTo],
                ["Office", view.office?.name],
                ["Purchase date", view.purchaseDate?.slice(0, 10)],
                ["Warranty expiry", view.warrantyExpiry?.slice(0, 10)],
                ["Purchase cost (KES)", view.purchaseCost],
                ["Current value (KES)", view.currentValue],
                ["Useful life (months)", view.usefulLifeMonths],
                ["Notes", view.notes],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="whitespace-pre-wrap">{value ?? "Not recorded"}</dd>
                </div>
              ))}
            </dl>
          </DialogContent>
        </Dialog>
      )}
      {edit && options.data && (
        <InventoryForm
          item={edit === "new" ? undefined : edit}
          options={options.data}
          onClose={() => setEdit(null)}
          onSaved={async () => {
            await client.invalidateQueries({ queryKey: ["inventory"] });
          }}
        />
      )}
    </div>
  );
}

function InventoryForm({
  item,
  options,
  onClose,
  onSaved,
}: {
  item?: Item | undefined;
  options: Options;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const choices = (values: string[]) =>
    values.map((value) => ({ value, label: value.replaceAll("_", " ") }));
  const refs = (values: { id: string; name: string }[]) => [
    { value: "", label: "Unassigned" },
    ...values.map((value) => ({ value: value.id, label: value.name })),
  ];
  return (
    <RecordDialog
      title={item ? "Edit asset" : "Add asset"}
      onClose={onClose}
      initial={{
        assetTag: item?.assetTag ?? "",
        deviceName: item?.deviceName ?? "",
        description: item?.description ?? "",
        category: item?.category ?? "laptop",
        status: item?.status ?? "in_use",
        condition: item?.condition ?? "good",
        brand: item?.brand ?? "",
        model: item?.model ?? "",
        serialNumber: item?.serialNumber ?? "",
        assignedTo: item?.assignedTo ?? "",
        assignedUserId: item?.assignedUserId ?? "",
        departmentId: item?.departmentId ?? "",
        officeId: item?.officeId ?? "",
        purchaseDate: item?.purchaseDate?.slice(0, 10) ?? "",
        warrantyExpiry: item?.warrantyExpiry?.slice(0, 10) ?? "",
        purchaseCost: item?.purchaseCost == null ? "" : Number(item.purchaseCost),
        usefulLifeMonths: item?.usefulLifeMonths ?? "",
        notes: item?.notes ?? "",
      }}
      fields={[
        { name: "assetTag", label: "Asset tag", required: true },
        { name: "deviceName", label: "Asset name", required: true },
        { name: "description", label: "Description", type: "textarea" },
        {
          name: "category",
          label: "Category",
          type: "select",
          options: choices(options.categories),
        },
        { name: "status", label: "Status", type: "select", options: choices(options.statuses) },
        {
          name: "condition",
          label: "Condition",
          type: "select",
          options: choices(options.conditions),
        },
        { name: "brand", label: "Brand" },
        { name: "model", label: "Model" },
        { name: "serialNumber", label: "Serial number" },
        {
          name: "assignedUserId",
          label: "Assigned staff",
          type: "select",
          options: refs(options.staff),
        },
        { name: "assignedTo", label: "Other assignee" },
        {
          name: "departmentId",
          label: "Department",
          type: "select",
          options: refs(options.departments),
        },
        { name: "officeId", label: "Office", type: "select", options: refs(options.offices) },
        { name: "purchaseDate", label: "Purchase date", type: "date" },
        { name: "warrantyExpiry", label: "Warranty expiry", type: "date" },
        { name: "purchaseCost", label: "Purchase cost (KES)", type: "number", min: 0 },
        { name: "usefulLifeMonths", label: "Useful life (months)", type: "number", min: 1 },
        { name: "notes", label: "Notes", type: "textarea" },
      ]}
      onSave={async (values) => {
        const body = {
          ...values,
          officeId: values.officeId || null,
          departmentId: values.departmentId || null,
          assignedUserId: values.assignedUserId || null,
          purchaseDate: values.purchaseDate || null,
          warrantyExpiry: values.warrantyExpiry || null,
          purchaseCost: values.purchaseCost === "" ? null : Number(values.purchaseCost),
          usefulLifeMonths: values.usefulLifeMonths === "" ? null : Number(values.usefulLifeMonths),
        };
        await api(item ? `/inventory/${item.id}` : "/inventory", {
          method: item ? "PATCH" : "POST",
          body: JSON.stringify(body),
        });
        await onSaved();
      }}
    />
  );
}
