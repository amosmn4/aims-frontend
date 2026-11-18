import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Avatar, Card, PageHeader, Progress, StatusBadge, Pill, fmtDate } from "@/components/kit";
import { EmptyState, RecordActions, SearchField } from "@/components/RecordDialog";
import { ProjectForm } from "@/components/WorkspaceForms";
import type { Project, Status } from "@/lib/data";
import { myProjects, useRole } from "@/lib/role";
import { useWorkspace } from "@/lib/workspace";
import { meta } from "@/lib/meta";
import { useBusinessAccess } from "@/lib/access";

export const Route = createFileRoute("/projects/")({
  head: () => ({ meta: meta("Projects", "Amsol projects, progress and teams.") }),
  component: Projects,
});
const filters: (Status | "all")[] = ["all", "on-track", "at-risk", "delayed", "completed"];

function Projects() {
  const { mode, me } = useRole();
  const { projects, client, deptName, person, businesses } = useWorkspace();
  const [filter, setFilter] = useState<Status | "all">("all");
  const [search, setSearch] = useState("");
  const [business, setBusiness] = useState("");
  const [edit, setEdit] = useState<Project | "new" | null>(null);
  const access = useBusinessAccess();
  const managed =
    access.permissions?.filter((grant) => grant.manage).map((grant) => grant.business) ?? [];
  const list = myProjects(mode, me.id, me.dept, projects, managed).filter(
    (project) =>
      (filter === "all" || project.status === filter) &&
      (!business || (project.business ?? "b0") === business) &&
      project.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle={
          mode === "ceo"
            ? "Every project across Amsol"
            : mode === "department"
              ? "Projects involving your department"
              : "Projects you belong to"
        }
        action={
          (mode !== "staff" || managed.length > 0) && (
            <button className="action-button" onClick={() => setEdit("new")}>
              New project
            </button>
          )
        }
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {filters.map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={`rounded-full px-3 py-1 text-sm capitalize ${filter === value ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
          >
            {value.replace("-", " ")}
          </button>
        ))}
      </div>
      <SearchField value={search} onChange={setSearch} placeholder="Search projects" />
      <label className="field-label mb-5 max-w-sm">
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
      {!list.length && (
        <EmptyState>No projects found. Change the filters or create a project.</EmptyState>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((project) => (
          <Card key={project.id} className="h-full">
            <Link to="/projects/$id" params={{ id: project.id }} className="block">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-display text-lg font-semibold">{project.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {project.client ? client(project.client)?.name : "Internal project"}
                  </div>
                </div>
                <StatusBadge status={project.status} />
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Progress value={project.progress} />
                <span className="text-sm tabular-nums">{project.progress}%</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {project.depts.map((dept) => (
                  <Pill key={dept} tone="primary">
                    {deptName(dept)}
                  </Pill>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="flex -space-x-2">
                  {project.members.map((member) => (
                    <Avatar key={member} name={person(member).name} size="sm" />
                  ))}
                </div>
                <span>
                  {project.stage} | due {fmtDate(project.due)}
                </span>
              </div>
            </Link>
            {(mode === "ceo" ||
              project.lead === me.id ||
              managed.includes(project.business ?? "b0")) && (
              <div className="mt-3 flex justify-end border-t pt-2">
                <RecordActions
                  collection="projects"
                  id={project.id}
                  label={project.name}
                  onEdit={() => setEdit(project)}
                />
              </div>
            )}
          </Card>
        ))}
      </div>
      {edit && (
        <ProjectForm record={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />
      )}
    </div>
  );
}
