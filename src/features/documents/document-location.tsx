import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { DocumentRow } from "@/features/documents/use-documents";
import { useContracts, useDepartments } from "@/features/clients/use-clients-contracts";
import { useProjects, useTasks } from "@/features/projects/use-projects";
import { useTenders } from "@/features/tender/use-tender";
import { useClientRequests } from "@/features/client-requests/use-client-requests";
import { useFinanceReports } from "@/features/finance/use-finance-reports";
import { useDepartmentReports } from "@/features/reports/use-department-reports";
import { useAuth } from "@/lib/auth";

const linkClass = "font-medium text-foreground hover:text-primary hover:underline";

function Where({ kind, children }: { kind: string; children?: ReactNode }) {
  return (
    <span className="text-xs text-muted-foreground">
      {kind}
      {children && <>: {children}</>}
    </span>
  );
}

/** "Project: Website redesign", linking to the record the file is attached to. */
export function DocumentLocation({ doc }: { doc: DocumentRow }) {
  const id = doc.resource_id;
  switch (doc.resource_type) {
    case "department":
      return <LibraryLocation id={id} />;
    case "tender_document_library":
      return <Where kind="Library">Mandatory tender documents</Where>;
    case "project":
      return <ProjectLocation id={id} />;
    case "task":
      return <TaskLocation id={id} />;
    case "client_request":
      return <RequestLocation id={id} />;
    case "tender":
      return <TenderLocation id={id} />;
    case "department_report":
      return <DepartmentReportLocation id={id} />;
    case "finance_report":
      return <FinanceReportLocation id={id} />;
    case "contract":
      return <ContractLocation id={id} />;
  }
}

function LibraryLocation({ id }: { id: string }) {
  const name = useDepartments().data?.find((d) => d.id === id)?.name;
  return <Where kind="Library">{name ? `${name} library` : undefined}</Where>;
}

function ProjectLocation({ id }: { id: string }) {
  const name = useProjects().data?.find((p) => p.id === id)?.name;
  return (
    <Where kind="Project">
      <Link
        to="/projects/$projectId"
        params={{ projectId: id }}
        search={{ view: "documents" }}
        className={linkClass}
      >
        {name ?? "Open project"}
      </Link>
    </Where>
  );
}

function TaskLocation({ id }: { id: string }) {
  const task = useTasks().data?.find((t) => t.id === id);
  if (!task) return <Where kind="Task" />;
  return (
    <Where kind="Task">
      <Link
        to="/projects/$projectId"
        params={{ projectId: task.project_id }}
        search={{ view: "tasks" }}
        className={linkClass}
      >
        {task.project_name ? `${task.title} — ${task.project_name}` : task.title}
      </Link>
    </Where>
  );
}

function RequestLocation({ id }: { id: string }) {
  const request = useClientRequests().data?.find((r) => r.id === id);
  return (
    <Where kind="Client request">
      <Link to="/requests/$requestId" params={{ requestId: id }} className={linkClass}>
        {request?.title ?? "Open client request"}
      </Link>
    </Where>
  );
}

function TenderLocation({ id }: { id: string }) {
  const { canReadDepartment } = useAuth();
  const tender = useTenders().data?.find((t) => t.id === id);
  const label = tender?.title ?? "Open tender";
  if (!canReadDepartment("tender")) return <Where kind="Tender">{tender?.title}</Where>;
  return (
    <Where kind="Tender">
      <Link to="/tender/$tenderId" params={{ tenderId: id }} className={linkClass}>
        {label}
      </Link>
    </Where>
  );
}

function DepartmentReportLocation({ id }: { id: string }) {
  const report = useDepartmentReports().data?.find((r) => r.id === id);
  return (
    <Where kind="Report">
      <Link to="/department-reports/$reportId" params={{ reportId: id }} className={linkClass}>
        {report?.title ?? "Open report"}
      </Link>
    </Where>
  );
}

function FinanceReportLocation({ id }: { id: string }) {
  const { canReadDepartment } = useAuth();
  const report = useFinanceReports().data?.find((r) => r.id === id);
  if (!canReadDepartment("finance")) return <Where kind="Finance report">{report?.title}</Where>;
  return (
    <Where kind="Finance report">
      <Link to="/finance/reports/$id" params={{ id }} className={linkClass}>
        {report?.title ?? "Open report"}
      </Link>
    </Where>
  );
}

function ContractLocation({ id }: { id: string }) {
  const contract = useContracts().data?.find((c) => c.id === id);
  return (
    <Where kind="Contract">
      <Link to="/clients/contracts/$id" params={{ id }} className={linkClass}>
        {contract?.title ?? "Open contract"}
      </Link>
    </Where>
  );
}
