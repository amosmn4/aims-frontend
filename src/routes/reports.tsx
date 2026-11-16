import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, PageHeader, Pill, fmtDate } from "@/components/kit";
import { EmptyState, RecordActions, RecordDialog, SearchField } from "@/components/RecordDialog";
import { Button } from "@/components/ui/button";
import { reportSchema } from "@/lib/models";
import type { Report } from "@/lib/data";
import { myProjects, useRole } from "@/lib/role";
import { perform, saveRecord, useWorkspace } from "@/lib/workspace";
import { today } from "@/lib/access";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: meta("General Reports", "Submit and review Amsol reports.") }),
  component: Reports,
});
function Reports() {
  const { mode, me, reports, review } = useRole();
  const { projects, person, deptName, project, templates, departments } = useWorkspace();
  const [edit, setEdit] = useState<Report | "new" | null>(null);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [comments, setComments] = useState<Record<string, string>>({});
  const hash = useLocation({ select: (location) => location.hash });
  const mine = myProjects(mode, me.id, me.dept, projects);
  const reportProjects = projects.filter(
    (project) => mode === "ceo" || project.members.includes(me.id),
  );
  const visible = reports.filter(
    (report) =>
      mode === "ceo" ||
      (mode === "department"
        ? report.dept === me.dept || mine.some((project) => project.id === report.project)
        : report.author === me.id || mine.some((project) => project.id === report.project)),
  );
  const list = visible
    .filter(
      (report) =>
        hash === `report-${report.id}` ||
        ((tab === "all" || (tab === "pending" ? !report.reviewed : report.reviewed)) &&
          report.title.toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  useEffect(() => {
    if (hash.startsWith("report-"))
      document.getElementById(hash)?.scrollIntoView({ block: "start" });
  }, [hash, tab]);
  const record = edit === "new" ? undefined : (edit ?? undefined);
  return (
    <div>
      <PageHeader
        title="General Reports"
        subtitle={
          mode === "ceo" ? "Review updates and leave feedback" : "Submit updates and track reviews"
        }
        action={
          <div className="flex flex-wrap gap-3">
            <Link to="/weekly-reports" className="action-button">
              Weekly reporting
            </Link>
            {mode !== "ceo" && <Button onClick={() => setEdit("new")}>Submit report</Button>}
          </div>
        }
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {["all", "pending", "reviewed"].map((value) => (
          <button
            key={value}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
            className={`rounded-full px-3 py-1 text-sm capitalize ${tab === value ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
          >
            {value === "pending" ? "Awaiting review" : value}
          </button>
        ))}
      </div>
      <SearchField value={search} onChange={setSearch} placeholder="Search reports" />
      {!list.length && <EmptyState>No reports match your selection.</EmptyState>}
      <div className="space-y-4">
        {list.map((report) => (
          <div id={`report-${report.id}`} key={report.id} className="scroll-mt-6">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold">{report.title}</h2>
                  <div className="text-xs text-muted-foreground">
                    {person(report.author).name} | {deptName(report.dept)} | {fmtDate(report.date)}
                    {report.project && (
                      <>
                        {" "}
                        |{" "}
                        <Link
                          to="/projects/$id"
                          params={{ id: report.project }}
                          className="text-primary"
                        >
                          {project(report.project)?.name}
                        </Link>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill>{report.type}</Pill>
                  <Pill tone={report.reviewed ? "primary" : "accent"}>
                    {report.reviewed ? "Reviewed" : "Awaiting review"}
                  </Pill>
                  {!report.reviewed && mode !== "ceo" && report.author === me.id && (
                    <RecordActions
                      collection="reports"
                      id={report.id}
                      label={report.title}
                      onEdit={() => setEdit(report)}
                    />
                  )}
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">Progress</div>
                  <p className="whitespace-pre-wrap">{report.progress || "Not provided"}</p>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">Blockers</div>
                  <p className="whitespace-pre-wrap">{report.blockers || "None"}</p>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">Next steps</div>
                  <p className="whitespace-pre-wrap">{report.next || "Not provided"}</p>
                </div>
              </div>
              {report.comment && (
                <p className="mt-4 whitespace-pre-wrap rounded-lg bg-secondary p-3 text-sm">
                  <strong>CEO: </strong>
                  {report.comment}
                </p>
              )}
              {mode === "ceo" && !report.reviewed && (
                <form
                  className="mt-4 flex flex-wrap gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    perform(() => review(report.id, comments[report.id]), "Report reviewed");
                  }}
                >
                  <input
                    className="field-input min-w-40 flex-1"
                    aria-label={`Review comment for ${report.title}`}
                    placeholder="Comment (optional)"
                    maxLength={10000}
                    value={comments[report.id] ?? ""}
                    onChange={(event) =>
                      setComments({ ...comments, [report.id]: event.target.value })
                    }
                  />
                  <Button type="submit">Mark reviewed</Button>
                </form>
              )}
            </Card>
          </div>
        ))}
      </div>
      {edit && (
        <RecordDialog
          title={record ? "Edit report" : "Submit report"}
          onClose={() => setEdit(null)}
          initial={{
            title: record?.title ?? "",
            type: record?.type ?? (reportProjects.length ? "Project update" : "Weekly department"),
            project: record?.project ?? reportProjects[0]?.id ?? "",
            dept: record?.dept ?? me.dept ?? reportProjects[0]?.depts[0] ?? "hr",
            date: record?.date ?? today(),
            template: templates[0]?.id ?? "",
            progress: record?.progress ?? "",
            blockers: record?.blockers ?? "",
            next: record?.next ?? "",
          }}
          fields={(values) => {
            const template = templates.find((template) => template.id === values.template);
            return [
              { name: "title", label: "Report title", required: true },
              {
                name: "type",
                label: "Report type",
                type: "select",
                options: ["Project update", "Weekly department", "Ad-hoc"].map((value) => ({
                  value,
                  label: value,
                })),
              },
              ...(values.type === "Project update"
                ? [
                    {
                      name: "project" as const,
                      label: "Project",
                      type: "select" as const,
                      required: true,
                      options: reportProjects.map((project) => ({
                        value: project.id,
                        label: project.name,
                      })),
                    },
                  ]
                : []),
              {
                name: "dept",
                label: "Department",
                type: "select",
                options: departments
                  .filter((department) =>
                    values.type === "Project update"
                      ? !!reportProjects
                          .find((project) => project.id === values.project)
                          ?.depts.includes(department.id)
                      : mode === "ceo" || department.id === me.dept,
                  )
                  .map((department) => ({ value: department.id, label: department.name })),
                required: true,
              },
              { name: "date", label: "Report date", type: "date", required: true },
              {
                name: "template",
                label: "Template",
                type: "select",
                options: templates.map((template) => ({
                  value: template.id,
                  label: template.name,
                })),
              },
              {
                name: "progress",
                label: template?.progress ?? "Progress made",
                type: "textarea",
                required: true,
              },
              {
                name: "blockers",
                label: template?.blockers ?? "Blockers / support needed",
                type: "textarea",
              },
              { name: "next", label: template?.next ?? "Next steps", type: "textarea" },
            ];
          }}
          onSave={(values) =>
            saveRecord(
              "reports",
              reportSchema.parse({
                ...values,
                id: record?.id ?? crypto.randomUUID(),
                author: record?.author ?? me.id,
                project: values.type === "Project update" ? values.project : undefined,
                reviewed: record?.reviewed ?? false,
                comment: record?.comment,
              }),
            )
          }
        />
      )}
    </div>
  );
}
