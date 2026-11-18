import { leaveDays } from "@/lib/weekly";
import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, PageHeader, Pill, Stat, fmtDate } from "@/components/kit";
import { EmptyState, SearchField } from "@/components/RecordDialog";
import { Button } from "@/components/ui/button";
import { MonthlyReportEditor } from "@/components/MonthlyReportEditor";
import type { Report } from "@/lib/data";
import { useRole } from "@/lib/role";
import { perform, useWorkspace } from "@/lib/workspace";
import { documentBlob, downloadBlob } from "@/lib/file-storage";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: meta("Monthly Reports", "Monthly results, tasks, leave and staff reporting."),
  }),
  component: Reports,
});
function Reports() {
  const { mode, me, reports, review } = useRole();
  const { person, deptName, departments, people, documents, businesses } = useWorkspace();
  const [edit, setEdit] = useState<Report | "new" | null>(null);
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("");
  const [staff, setStaff] = useState("");
  const [dept, setDept] = useState("");
  const [business, setBusiness] = useState("");
  const [status, setStatus] = useState("");
  const [comments, setComments] = useState<Record<string, string>>({});
  const hash = useLocation({ select: (location) => location.hash });
  const visible = reports.filter((row) =>
    mode === "ceo"
      ? row.status !== "draft"
      : row.author === me.id ||
        (mode === "department" && row.dept === me.dept && row.status !== "draft"),
  );
  const scoped = visible.filter(
    (row) =>
      (!month || (row.month ?? row.date.slice(0, 7)) === month) &&
      (!staff || row.author === staff) &&
      (!dept || row.dept === dept) &&
      (!business || (row.business ?? "b0") === business) &&
      `${row.title} ${row.progress ?? ""} ${person(row.author).name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const list = scoped
    .filter(
      (row) =>
        !status ||
        (status === "reviewed"
          ? row.reviewed
          : status === "draft"
            ? row.status === "draft"
            : !row.reviewed && row.status !== "draft"),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  useEffect(() => {
    if (hash.startsWith("report-"))
      document.getElementById(hash)?.scrollIntoView({ block: "start" });
  }, [hash]);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Monthly Reports"
        subtitle={
          mode === "ceo"
            ? "Review staff results, task outcomes, urgent work and leave"
            : "Report your monthly results, including ad hoc and contingency work"
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/weekly-reports" className="action-button">
              Weekly reporting
            </Link>
            {mode !== "ceo" && <Button onClick={() => setEdit("new")}>Submit report</Button>}
          </div>
        }
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Reports" value={scoped.length} />
        <Stat
          label="Awaiting review"
          value={scoped.filter((row) => !row.reviewed && row.status !== "draft").length}
        />
        <Stat label="Reviewed" value={scoped.filter((row) => row.reviewed).length} />
        <Stat
          label="Task outcomes"
          value={scoped.reduce((count, row) => count + (row.taskSnapshots?.length ?? 0), 0)}
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="field-label">
          Month
          <input
            className="field-input"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </label>
        <label className="field-label">
          Status
          <select
            className="field-input"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All</option>
            <option value="pending">Awaiting review</option>
            <option value="reviewed">Reviewed</option>
            {mode !== "ceo" && <option value="draft">Draft</option>}
          </select>
        </label>
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
        {mode === "ceo" && (
          <>
            <label className="field-label">
              Staff
              <select
                className="field-input"
                value={staff}
                onChange={(event) => setStaff(event.target.value)}
              >
                <option value="">All staff</option>
                {people
                  .filter((row) => row.dept)
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field-label">
              Department
              <select
                className="field-input"
                value={dept}
                onChange={(event) => setDept(event.target.value)}
              >
                <option value="">All departments</option>
                {departments.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>
      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Search reports within these filters"
      />
      {!list.length && <EmptyState>No reports match your selection.</EmptyState>}
      <div className="space-y-4">
        {list.map((report) => (
          <div id={`report-${report.id}`} key={report.id} className="scroll-mt-6">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold">{report.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {person(report.author).name} | {deptName(report.dept)} |{" "}
                    {report.month ?? report.date.slice(0, 7)} | {fmtDate(report.date)}
                  </p>
                  {report.project && (
                    <Link
                      to="/projects/$id"
                      params={{ id: report.project }}
                      className="text-xs text-primary underline"
                    >
                      Open linked project
                    </Link>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill>{report.type}</Pill>
                  <Pill>
                    {report.status === "draft"
                      ? "Draft"
                      : report.reviewed
                        ? "Reviewed"
                        : "Awaiting review"}
                  </Pill>
                  {!report.reviewed && report.author === me.id && mode !== "ceo" && (
                    <Button variant="outline" size="sm" onClick={() => setEdit(report)}>
                      Edit
                    </Button>
                  )}
                </div>
              </div>
              <div className="my-4 grid gap-3 text-sm md:grid-cols-3">
                {(
                  [
                    ["Progress and results", report.progress],
                    ["Blockers and support", report.blockers],
                    ["Next steps", report.next],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <h3 className="text-xs font-semibold text-muted-foreground">{label}</h3>
                    <p className="mt-1 whitespace-pre-wrap">{value || "Not provided"}</p>
                  </div>
                ))}
              </div>
              {!!report.taskSnapshots?.length && (
                <details className="my-3 rounded-lg border p-3" open={mode === "ceo"}>
                  <summary className="cursor-pointer text-sm font-medium">
                    Task outcomes ({report.taskSnapshots.length}) |{" "}
                    {report.taskSnapshots.filter((row) => row.status === "Done").length} completed
                  </summary>
                  <div className="mt-2 divide-y">
                    {report.taskSnapshots.map((task) => (
                      <div key={task.id} className="py-2 text-sm">
                        <div className="flex justify-between gap-3">
                          <span>{task.title}</span>
                          <span className="flex gap-2">
                            <Pill>{task.status}</Pill>
                            {task.priority && <Pill>{task.priority}</Pill>}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {task.source.replaceAll("_", " ")} | due {task.due}
                        </p>
                        {task.subtasks?.map((item) => (
                          <label key={item.id} className="mt-1 flex gap-2 text-xs">
                            <input type="checkbox" checked={item.done} readOnly disabled />
                            {item.title}
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </details>
              )}
              {!!report.leaveSnapshot?.length && (
                <div className="my-3 rounded-lg border bg-muted/20 p-3 text-sm">
                  <strong>Recorded leave | {leaveDays(report.leaveSnapshot)} calendar days</strong>
                  {report.leaveSnapshot.map((row) => (
                    <p key={`${row.start}:${row.end}`}>
                      {row.start} to {row.end}
                      {row.note ? ` | ${row.note}` : ""}
                    </p>
                  ))}
                </div>
              )}
              {!!report.attachments?.length && (
                <div className="my-3 flex flex-wrap gap-2">
                  {report.attachments.map((id) => {
                    const doc = documents.find((row) => row.id === id);
                    return doc ? (
                      <Button
                        key={id}
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          perform(async () => {
                            downloadBlob(await documentBlob(doc), doc.name);
                          }, "Download started")
                        }
                      >
                        {doc.name}
                      </Button>
                    ) : null;
                  })}
                </div>
              )}
              {report.comment && (
                <p className="mt-4 whitespace-pre-wrap rounded-lg border bg-muted/20 p-3 text-sm">
                  <strong>CEO feedback: </strong>
                  {report.comment}
                </p>
              )}
              {mode === "ceo" && !report.reviewed && (
                <form
                  className="mt-4 flex flex-wrap gap-2 border-t pt-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void perform(() => review(report.id, comments[report.id]), "Report reviewed");
                  }}
                >
                  <input
                    className="field-input min-w-40 flex-1"
                    aria-label={`Review comment for ${report.title}`}
                    placeholder="Feedback for this staff member (optional)"
                    maxLength={10000}
                    value={comments[report.id] ?? ""}
                    onChange={(event) =>
                      setComments({ ...comments, [report.id]: event.target.value })
                    }
                  />
                  <Button>Mark reviewed</Button>
                </form>
              )}
            </Card>
          </div>
        ))}
      </div>
      {edit && (
        <MonthlyReportEditor
          record={edit === "new" ? undefined : edit}
          onClose={() => setEdit(null)}
        />
      )}
    </div>
  );
}
