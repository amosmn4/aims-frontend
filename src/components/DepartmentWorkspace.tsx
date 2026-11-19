import { Link } from "@tanstack/react-router";
import { useRole } from "@/lib/role";
import { useWorkspace } from "@/lib/workspace";
import { departmentWorkspace } from "@/lib/department";
import { today } from "@/lib/access";
import { Card, PageHeader, Pill, SectionTitle, Stat, StatusBadge, fmtDate } from "./kit";
import { DepartmentModules } from "./DepartmentModules";
import { WeeklyReminder } from "./weekly/WeeklyReminder";

export function DepartmentWorkspace() {
  const { me } = useRole();
  const workspace = useWorkspace();
  if (!me.dept) return <Card>Your account needs a department to open a department workspace.</Card>;
  const data = departmentWorkspace(workspace, me.dept);
  const active = data.projects.filter((row) => row.status !== "completed");
  const tasks = data.tasks
    .filter((row) => row.status !== "Done")
    .sort((a, b) => a.due.localeCompare(b.due));
  const overdue = tasks.filter((row) => row.due < today());
  const requests = data.requests.filter((row) => row.status !== "Closed");
  return (
    <div className="space-y-6">
      <PageHeader
        title={`${workspace.deptName(me.dept)} workspace`}
        subtitle="Shared departmental projects, assigned work, requests and documents available to your account."
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Active projects" value={active.length} />
        <Stat label="Open tasks" value={tasks.length} />
        <Stat label="Overdue tasks" value={overdue.length} />
        <Stat label="Department requests" value={requests.length} />
      </div>
      <WeeklyReminder />
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>Tasks needing attention</SectionTitle>
          <Card className="space-y-3">
            {tasks.slice(0, 8).map((task) => (
              <div
                key={task.id}
                className="flex flex-wrap items-start justify-between gap-2 border-b pb-3 text-sm last:border-0 last:pb-0"
              >
                <div>
                  <Link to="/tasks" className="font-medium text-primary underline">
                    {task.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {workspace.person(task.assignee).name} | Due {fmtDate(task.due)}
                  </p>
                </div>
                <Pill>{task.priority}</Pill>
              </div>
            ))}
            {!tasks.length && (
              <p className="text-sm text-muted-foreground">
                No open tasks in your department view.
              </p>
            )}
            <Link to="/tasks" className="block text-sm text-primary underline">
              Open department tasks
            </Link>
          </Card>
        </section>
        <section>
          <SectionTitle>Department projects</SectionTitle>
          <Card className="space-y-3">
            {active.slice(0, 8).map((project) => (
              <Link
                key={project.id}
                to="/projects/$id"
                params={{ id: project.id }}
                className="flex items-center justify-between gap-3 border-b pb-3 text-sm last:border-0"
              >
                <span className="font-medium">{project.name}</span>
                <StatusBadge status={project.status} />
              </Link>
            ))}
            {!active.length && (
              <p className="text-sm text-muted-foreground">
                No active projects assigned to your department.
              </p>
            )}
            <Link to="/projects" className="block text-sm text-primary underline">
              Open projects
            </Link>
          </Card>
        </section>
        <section>
          <SectionTitle>Requests assigned to the department</SectionTitle>
          <Card className="space-y-3">
            {requests.slice(0, 6).map((request) => (
              <div
                key={request.id}
                className="flex items-start justify-between gap-3 border-b pb-3 text-sm"
              >
                <Link to="/client-requests" className="font-medium text-primary underline">
                  {request.title}
                </Link>
                <Pill>{request.status}</Pill>
              </div>
            ))}
            {!requests.length && (
              <p className="text-sm text-muted-foreground">No open department requests.</p>
            )}
          </Card>
        </section>
        <section>
          <SectionTitle>Submitted reports</SectionTitle>
          <Card className="space-y-3">
            {data.reports
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 6)
              .map((report) => (
                <div
                  key={report.id}
                  className="flex items-start justify-between gap-3 border-b pb-3 text-sm"
                >
                  <div>
                    <Link
                      to="/reports"
                      hash={`report-${report.id}`}
                      className="font-medium text-primary underline"
                    >
                      {report.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {workspace.person(report.author).name} |{" "}
                      {report.month ?? report.date.slice(0, 7)}
                    </p>
                  </div>
                  <Pill>{report.reviewed ? "Reviewed" : "Submitted"}</Pill>
                </div>
              ))}
            {!data.reports.length && (
              <p className="text-sm text-muted-foreground">
                No submitted reports shared with this department.
              </p>
            )}
          </Card>
        </section>
        <section>
          <SectionTitle>Shared documents</SectionTitle>
          <Card className="space-y-3">
            {data.documents.slice(0, 6).map((document) => (
              <div key={document.id} className="text-sm">
                <Link to="/documents" className="font-medium text-primary underline">
                  {document.name}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">{document.folder}</p>
              </div>
            ))}
            {!data.documents.length && (
              <p className="text-sm text-muted-foreground">
                No department or project documents shared with your account.
              </p>
            )}
          </Card>
        </section>
        <section>
          <SectionTitle>Department team</SectionTitle>
          <Card className="max-h-80 space-y-3 overflow-y-auto">
            {data.people.map((person) => (
              <div key={person.id} className="text-sm">
                <p className="font-medium">{person.name}</p>
                <p className="text-xs text-muted-foreground">{person.title}</p>
              </div>
            ))}
          </Card>
        </section>
      </div>
      <DepartmentModules dept={me.dept} />
    </div>
  );
}
