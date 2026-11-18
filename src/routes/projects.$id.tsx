import { useState } from "react";
import { getWorkspace, useWorkspace } from "@/lib/workspace";
import { ProjectForm, TaskForm } from "@/components/WorkspaceForms";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Download, FileText, Lock } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { downloadProjectPdf } from "@/lib/project-export";
import {
  AccessBadge,
  Avatar,
  Card,
  PageHeader,
  Pill,
  Progress,
  SectionTitle,
  StatusBadge,
  fmtDate,
} from "@/components/kit";
import type { Stage } from "@/lib/data";
import { canOpenDoc, useRole } from "@/lib/role";
import { SafeHtml } from "@/production/components/safe-html";
import { useBusinessAccess } from "@/lib/access";

export const Route = createFileRoute("/projects/$id")({
  loader: ({ params }) => {
    const p = getWorkspace().projects.find((project) => project.id === params.id);
    if (!p) throw notFound();
    const summary = p.summary
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return { name: p.name, summary };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.name} · Amsol` : "Project · Amsol" },
      { name: "description", content: loaderData?.summary ?? "Amsol project" },
      {
        property: "og:title",
        content: loaderData ? `${loaderData.name} · Amsol` : "Project · Amsol",
      },
      { property: "og:description", content: loaderData?.summary ?? "Amsol project" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectPage,
});

const stages: Stage[] = ["Planning", "In progress", "Review", "Completed"];

function ProjectPage() {
  const { id } = Route.useParams();
  const workspace = useWorkspace();
  const { project, client, deptName, person, tasks, documents: allDocs, projects } = workspace;
  const p = project(id);
  const [edit, setEdit] = useState(false);
  const [newTask, setNewTask] = useState(false);
  const { mode, me, reports } = useRole();
  const access = useBusinessAccess();
  const managesBusiness = !!access.permissions?.some(
    (grant) => grant.business === (p?.business ?? "b0") && grant.manage,
  );
  if (!p)
    return (
      <Card>
        Project not found.{" "}
        <Link to="/projects" className="text-primary">
          Return to projects
        </Link>
      </Card>
    );
  const isMember =
    mode === "ceo" ||
    managesBusiness ||
    p.members.includes(me.id) ||
    (mode === "department" && me.dept !== null && p.depts.includes(me.dept));
  const pt = tasks.filter((t) => t.project === p.id);
  const pr = reports.filter((r) => r.project === p.id);
  const docs = allDocs.filter((d) => d.project === p.id);

  return (
    <div>
      <Link to="/projects" className="text-sm text-muted-foreground">
        ← Projects
      </Link>
      <PageHeader
        title={p.name}
        subtitle={`${p.client ? client(p.client)?.name : "Internal"} · Lead: ${person(p.lead).name}`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={p.status} />
            {(mode === "ceo" || p.lead === me.id || managesBusiness) && (
              <Button onClick={() => setEdit(true)}>Edit project</Button>
            )}
            {mode === "ceo" && (
              <Button variant="outline" onClick={() => downloadProjectPdf(p, reports, workspace)}>
                <Download className="h-4 w-4" />
                Download progress PDF
              </Button>
            )}
          </div>
        }
      />

      {edit && <ProjectForm record={p} onClose={() => setEdit(false)} />}
      {newTask && <TaskForm projectId={p.id} onClose={() => setNewTask(false)} />}
      <Card className="mb-6">
        <div className="mb-4 grid grid-cols-4 gap-2">
          {stages.map((s, i) => {
            const cur = stages.indexOf(p.stage);
            return (
              <div key={s}>
                <div className={`h-1.5 rounded-full ${i <= cur ? "bg-primary" : "bg-muted"}`} />
                <div
                  className={`mt-2 text-xs ${i === cur ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                >
                  {s}
                </div>
              </div>
            );
          })}
        </div>
        <SafeHtml html={p.summary} className="blog-content text-sm" />
        <div className="mt-4 flex items-center gap-3">
          <Progress value={p.progress} />
          <span className="text-sm tabular-nums">{p.progress}%</span>
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            due {fmtDate(p.due)}
          </span>
        </div>
      </Card>

      {!isMember ? (
        <Card className="flex items-center gap-3 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" />
          You're not on this project, so you can only see the summary.
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div>
              <SectionTitle>Updates & reports</SectionTitle>
              <div className="space-y-3">
                {pr.length === 0 && (
                  <Card className="text-sm text-muted-foreground">No reports yet.</Card>
                )}
                {pr.map((r) => (
                  <Card key={r.id}>
                    <div className="flex justify-between">
                      <Link
                        to="/reports"
                        hash={`report-${r.id}`}
                        className="font-medium text-primary"
                      >
                        {r.title}
                      </Link>
                      {r.reviewed ? (
                        <Pill tone="primary">Reviewed by CEO</Pill>
                      ) : (
                        <Pill>Awaiting review</Pill>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {person(r.author).name} · {fmtDate(r.date)}
                    </div>
                    <dl className="mt-3 space-y-1 text-sm">
                      {r.progress && (
                        <div>
                          <dt className="inline font-semibold">Progress: </dt>
                          <dd className="inline">{r.progress}</dd>
                        </div>
                      )}
                      {r.blockers && (
                        <div>
                          <dt className="inline font-semibold">Blockers: </dt>
                          <dd className="inline">{r.blockers}</dd>
                        </div>
                      )}
                      {r.next && (
                        <div>
                          <dt className="inline font-semibold">Next: </dt>
                          <dd className="inline">{r.next}</dd>
                        </div>
                      )}
                    </dl>
                  </Card>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-3 flex items-center justify-between">
                <SectionTitle>Tasks</SectionTitle>
                {(mode === "ceo" || p.members.includes(me.id)) && (
                  <Button size="sm" onClick={() => setNewTask(true)}>
                    New task
                  </Button>
                )}
              </div>
              <Card className="divide-y p-0">
                {pt.map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span
                      className={t.status === "Done" ? "text-muted-foreground line-through" : ""}
                    >
                      {t.title}
                    </span>
                    <span className="flex items-center gap-3 text-xs text-muted-foreground">
                      {person(t.assignee).name}
                      <Pill>{t.status}</Pill>
                    </span>
                  </div>
                ))}
              </Card>
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <SectionTitle>Team</SectionTitle>
              <Card className="space-y-3">
                {p.members.map((m) => {
                  const x = person(m);
                  return (
                    <div key={m} className="flex items-center gap-3">
                      <Avatar name={x.name} size="sm" />
                      <div>
                        <div className="text-sm font-medium">
                          {x.name}
                          {m === p.lead && " · Lead"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {x.dept ? deptName(x.dept) : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Card>
            </div>
            <div>
              <SectionTitle>Documents</SectionTitle>
              <Card className="space-y-3">
                {docs.length === 0 && (
                  <div className="text-sm text-muted-foreground">None linked.</div>
                )}
                {docs.map((d) => (
                  <div key={d.id} className="flex items-start gap-2 text-sm">
                    <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <div>
                        {canOpenDoc(d, mode, me.id, me.dept, projects) ? (
                          <Link
                            to="/documents"
                            hash={`document-${d.id}`}
                            className="text-primary underline"
                          >
                            {d.name}
                          </Link>
                        ) : (
                          "Restricted document"
                        )}
                      </div>
                      <AccessBadge access={d.access} />
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
