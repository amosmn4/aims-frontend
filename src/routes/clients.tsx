import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card, PageHeader, Pill, StatusBadge } from "@/components/kit";
import { ClientForm } from "@/components/WorkspaceForms";
import { EmptyState, RecordActions, SearchField } from "@/components/RecordDialog";
import { useWorkspace } from "@/lib/workspace";
import { useRole } from "@/lib/role";
import type { Client } from "@/lib/data";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/clients")({
  head: () => ({ meta: meta("Clients", "Amsol clients, services and linked projects.") }),
  component: Clients,
});
function Clients() {
  const { clients, projects } = useWorkspace();
  const { mode, me } = useRole();
  const [edit, setEdit] = useState<Client | "new" | null>(null);
  const [search, setSearch] = useState("");
  const canEdit = mode === "ceo" || me.dept === "operations" || me.dept === "hr";
  const canCreate = mode !== "ceo" && (me.dept === "operations" || me.dept === "hr");
  const list = clients.filter((client) =>
    `${client.name} ${client.contact} ${client.services.join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Who we serve and what we do for them"
        action={
          canCreate && (
            <button className="action-button" onClick={() => setEdit("new")}>
              Add client
            </button>
          )
        }
      />
      <SearchField value={search} onChange={setSearch} placeholder="Search clients" />
      {!list.length && <EmptyState>No clients found.</EmptyState>}
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((client) => (
          <Card key={client.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold">{client.name}</h2>
                <div className="text-sm text-muted-foreground">Contact: {client.contact}</div>
              </div>
              {canEdit && (
                <RecordActions
                  collection="clients"
                  id={client.id}
                  label={client.name}
                  onEdit={() => setEdit(client)}
                />
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {client.services.map((service) => (
                <Pill key={service} tone="primary">
                  {service}
                </Pill>
              ))}
            </div>
            <div className="mt-4 space-y-2 border-t pt-3">
              {projects
                .filter((project) => project.client === client.id)
                .map((project) => (
                  <Link
                    key={project.id}
                    to="/projects/$id"
                    params={{ id: project.id }}
                    className="flex items-center justify-between gap-3 text-sm hover:text-primary"
                  >
                    <span>{project.name}</span>
                    <StatusBadge status={project.status} />
                  </Link>
                ))}
              {!projects.some((project) => project.client === client.id) && (
                <p className="text-sm text-muted-foreground">No linked projects.</p>
              )}
            </div>
          </Card>
        ))}
      </div>
      {edit && (
        <ClientForm record={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />
      )}
    </div>
  );
}
