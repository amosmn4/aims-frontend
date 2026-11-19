import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Avatar, Card, PageHeader, Pill } from "@/components/kit";
import { EmptyState, RecordActions, SearchField } from "@/components/RecordDialog";
import { StaffEditor } from "@/components/StaffEditor";
import { useWorkspace } from "@/lib/workspace";
import { useRole } from "@/lib/role";
import type { Person } from "@/lib/data";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/people")({
  head: () => ({ meta: meta("Staff", "Amsol staff directory.") }),
  component: People,
});
function People() {
  const { people, projects, deptName, accounts } = useWorkspace();
  const { mode } = useRole();
  const [edit, setEdit] = useState<Person | "new" | null>(null);
  const [search, setSearch] = useState("");
  if (mode !== "ceo") return <Card>Staff directory is available to the CEO.</Card>;
  const record = edit === "new" ? undefined : (edit ?? undefined);
  const list = people.filter((person) =>
    `${person.name} ${person.title} ${person.dept ? deptName(person.dept) : "Executive"} ${accounts.find((account) => account.personId === person.id)?.email ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle="Staff directory"
        action={
          mode === "ceo" && (
            <button className="action-button" onClick={() => setEdit("new")}>
              Add staff
            </button>
          )
        }
      />
      <SearchField value={search} onChange={setSearch} placeholder="Search staff" />
      {!list.length && <EmptyState>No staff found.</EmptyState>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {list.map((person) => (
          <Card key={person.id}>
            <div className="flex items-start gap-3">
              <Avatar name={person.name} />
              <div className="min-w-0 flex-1">
                <h2 className="font-medium">{person.name}</h2>
                <p className="text-sm text-muted-foreground">{person.title}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Pill tone="primary">{person.dept ? deptName(person.dept) : "Executive"}</Pill>
                  <Pill>
                    {projects.filter((project) => project.members.includes(person.id)).length}{" "}
                    projects
                  </Pill>
                </div>
                <p className="mt-2 break-all text-xs text-muted-foreground">
                  {accounts.find((account) => account.personId === person.id)?.email ??
                    "Directory entry"}
                </p>
              </div>
            </div>
            {mode === "ceo" && (
              <div className="mt-3 flex justify-end border-t pt-2">
                <RecordActions
                  collection="people"
                  id={person.id}
                  label={person.name}
                  onEdit={() => setEdit(person)}
                  canDelete={
                    !accounts.some(
                      (account) => account.personId === person.id && account.role !== "staff",
                    )
                  }
                  deleteDescription="Deletes this staff entry and its Ops access. Staff with linked work or reporting history must be retained; use Accounts to deactivate or delete their sign-in access."
                />
              </div>
            )}
          </Card>
        ))}
      </div>
      {edit && <StaffEditor record={record} onClose={() => setEdit(null)} />}
    </div>
  );
}
