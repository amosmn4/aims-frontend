import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, PageHeader, Pill, fmtDate } from "@/components/kit";
import { EmptyState, RecordActions, SearchField } from "@/components/RecordDialog";
import { RequestForm } from "@/components/WorkspaceForms";
import { requestStatuses, type ClientRequest } from "@/lib/data";
import { canSeeRequests, visibleRequests } from "@/lib/business";
import { useWorkspace } from "@/lib/workspace";
import { meta } from "@/lib/meta";
import { useBusinessAccess } from "@/lib/access";
import { useRole } from "@/lib/role";

export const Route = createFileRoute("/client-requests")({
  head: () => ({ meta: meta("Client requests", "Log and track requests received from clients.") }),
  component: ClientRequests,
});
function ClientRequests() {
  const { mode, me } = useRole();
  const { clientRequests, person, client, people, businesses, deptName } = useWorkspace();
  const [edit, setEdit] = useState<ClientRequest | "new" | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [business, setBusiness] = useState("");
  const [department, setDepartment] = useState("");
  const access = useBusinessAccess();
  const managed =
    access.permissions?.filter((grant) => grant.manage).map((grant) => grant.business) ?? [];
  if (!canSeeRequests(mode, me.id, me.dept, clientRequests, people, managed))
    return (
      <Card>
        No client requests are assigned to you. Operations, Marketing or the CEO can assign
        requests.
      </Card>
    );
  const assigned = visibleRequests(mode, me.id, me.dept, clientRequests, people, managed);
  const visible = assigned.filter(
    (request) =>
      (!business || (request.business ?? "b0") === business) &&
      (!department || request.assignedDept === department),
  );
  const list = visible.filter(
    (request) =>
      (status === "all" || request.status === status) &&
      `${request.title} ${client(request.client ?? "")?.name ?? request.prospectClientName ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div>
      <PageHeader
        title="Client requests"
        subtitle="Every client request, from receipt to closure"
        action={
          mode !== "ceo" && (
            <button className="action-button" onClick={() => setEdit("new")}>
              Log request
            </button>
          )
        }
      />
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          className="rounded-md border px-3 py-1 text-sm"
          onClick={() => setStatus("all")}
          aria-pressed={status === "all"}
        >
          All ({visible.length})
        </button>
        {requestStatuses.map((value) => (
          <button
            key={value}
            className={`rounded-md border px-3 py-1 text-sm ${status === value ? "bg-muted font-semibold" : ""}`}
            onClick={() => setStatus(value)}
            aria-pressed={status === value}
          >
            {value} ({visible.filter((request) => request.status === value).length})
          </button>
        ))}
      </div>
      <SearchField value={search} onChange={setSearch} placeholder="Search client requests" />
      <div className="mb-5 flex flex-wrap gap-3">
        <label className="field-label">
          Business
          <select
            className="field-input"
            value={business}
            onChange={(event) => setBusiness(event.target.value)}
          >
            <option value="">All assigned businesses</option>
            {businesses.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Assigned department
          <select
            className="field-input"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
          >
            <option value="">All assignments</option>
            {[
              ...new Set(
                assigned.flatMap((request) => (request.assignedDept ? [request.assignedDept] : [])),
              ),
            ].map((id) => (
              <option key={id} value={id}>
                {deptName(id)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!list.length ? (
        <EmptyState>No requests match your selection.</EmptyState>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Request</th>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Received</th>
                <th className="px-5 py-3">Handler</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((request) => (
                <tr key={request.id}>
                  <td className="min-w-52 px-5 py-3">
                    <div className="font-medium">{request.title}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{request.notes}</p>
                  </td>
                  <td className="px-5 py-3">
                    {client(request.client ?? "")?.name ?? request.prospectClientName}
                    {!request.client && <Pill tone="muted">Prospective</Pill>}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">{fmtDate(request.received)}</td>
                  <td className="px-5 py-3">{person(request.handler).name}</td>
                  <td className="px-5 py-3">
                    <Pill>{request.status}</Pill>
                  </td>
                  <td className="px-5 py-3">
                    {(mode === "ceo" ||
                      me.dept === request.assignedDept ||
                      managed.includes(request.business ?? "b0") ||
                      request.handler === me.id) && (
                      <RecordActions
                        collection="clientRequests"
                        id={request.id}
                        label={request.title}
                        onEdit={() => setEdit(request)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {edit && (
        <RequestForm record={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />
      )}
    </div>
  );
}
