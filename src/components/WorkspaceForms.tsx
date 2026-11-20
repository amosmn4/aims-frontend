import { RecordDialog, type Field } from "./RecordDialog";
import { saveRecord, useWorkspace } from "@/lib/workspace";
import { useRole } from "@/lib/role";
import { today } from "@/lib/access";
import { useBusinessAccess } from "@/lib/access";
import { canManageBusinessFinance } from "@/lib/business";
import { reportingWeek } from "@/lib/weekly";
import {
  clientSchema,
  projectSchema,
  taskSchema,
  tenderSchema,
  requestSchema,
  businessSchema,
  financeSchema,
  moduleRecordSchema,
  type ModuleRecord,
} from "@/lib/models";
import {
  tenderStages,
  requestStatuses,
  type Project,
  type Task,
  type Client,
  type Tender,
  type ClientRequest,
  type Business,
  type BusinessFinance,
  type DeptId,
} from "@/lib/data";

const options = (values: readonly string[]) =>
  values.map((value) => ({ value, label: value.replaceAll("-", " ") }));

export function ProjectForm({
  record,
  onClose,
}: {
  record?: Project | undefined;
  onClose: () => void;
}) {
  const { people, clients, departments, businesses } = useWorkspace();
  const { me, mode } = useRole();
  const businessAccess = useBusinessAccess();
  return (
    <RecordDialog
      title={record ? "Edit project" : "New project"}
      onClose={onClose}
      initial={{
        name: record?.name ?? "",
        client: record?.client ?? "",
        lead: record?.lead ?? me.id,
        depts: record?.depts ?? (me.dept ? [me.dept] : []),
        members: record?.members ?? [me.id],
        status: record?.status ?? "on-track",
        stage: record?.stage ?? "Planning",
        progress: record?.progress ?? 0,
        due: record?.due ?? today(),
        summary: record?.summary ?? "",
        business: record?.business ?? "b0",
      }}
      fields={(values) => [
        { name: "name", label: "Project name", required: true },
        {
          name: "client",
          label: "Client",
          type: "select",
          options: [
            { value: "", label: "Internal project" },
            ...clients.map((client) => ({ value: client.id, label: client.name })),
          ],
        },
        {
          name: "lead",
          label: "Project lead",
          type: "select",
          required: true,
          options: people
            .filter(
              (person) =>
                mode === "ceo" ||
                person.id === me.id ||
                businessAccess.permissions?.some(
                  (grant) => grant.business === values.business && grant.manage,
                ),
            )
            .map((person) => ({ value: person.id, label: person.name })),
        },
        {
          name: "depts",
          label: "Departments",
          type: "multi",
          required: true,
          options: departments.map((department) => ({
            value: department.id,
            label: department.name,
          })),
        },
        {
          name: "members",
          label: "Team members",
          type: "multi",
          required: true,
          options: people.map((person) => ({ value: person.id, label: person.name })),
          help: "The lead is included automatically.",
        },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: options(["on-track", "at-risk", "delayed", "completed"]),
        },
        {
          name: "stage",
          label: "Stage",
          type: "select",
          options: options(["Planning", "In progress", "Review", "Completed"]),
        },
        {
          name: "progress",
          label: "Progress (%)",
          type: "number",
          min: 0,
          max: 100,
          step: 1,
          required: true,
        },
        { name: "due", label: "Due date", type: "date", required: true },
        { name: "summary", label: "Summary", type: "richtext", required: true },
        {
          name: "business",
          label: "Business",
          type: "select",
          options: businesses.map((business) => ({ value: business.id, label: business.name })),
        },
      ]}
      onSave={async (values) => {
        const completed =
          values.status === "completed" || values.stage === "Completed" || values.progress === 100;
        await saveRecord(
          "projects",
          projectSchema.parse({
            ...values,
            id: record?.id ?? crypto.randomUUID(),
            client: values.client || undefined,
            members: [...new Set([...values.members, values.lead])],
            ...(completed ? { status: "completed", stage: "Completed", progress: 100 } : {}),
          }),
        );
      }}
    />
  );
}

export function TaskForm({
  record,
  projectId,
  onClose,
}: {
  record?: Task | undefined;
  projectId?: string | undefined;
  onClose: () => void;
}) {
  const { projects, people, businesses } = useWorkspace();
  const { mode, me } = useRole();
  const businessAccess = useBusinessAccess();
  const manages = (business?: string) =>
    !!businessAccess.permissions?.some(
      (grant) => grant.business === (business ?? "b0") && grant.manage,
    );
  const selected = record?.project ?? projectId ?? "";
  const parent = projects.find((project) => project.id === selected);
  const availableBusinesses = businesses.filter(
    (business) =>
      mode === "ceo" ||
      business.id === "b0" ||
      businessAccess.permissions?.some((grant) => grant.business === business.id),
  );
  const currentWeek = reportingWeek();
  const weekEnd = new Date(new Date(currentWeek + "T12:00:00Z").getTime() + 6 * 86400000)
    .toISOString()
    .slice(0, 10);
  const initial = {
    title: record?.title ?? "",
    description: record?.description
      ? (new DOMParser()
          .parseFromString(
            record.description.replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?>/gi, "\n"),
            "text/html",
          )
          .body.textContent?.trim() ?? "")
      : "",
    project: selected,
    assignee:
      record?.assignee ??
      (selected && (mode === "ceo" || parent?.lead === me.id)
        ? (parent?.members[0] ?? me.id)
        : me.id),
    due: record?.due ?? weekEnd,
    priority: record?.priority ?? "Medium",
    status: record?.status ?? "To do",
    business: record?.business ?? parent?.business ?? "b0",
    weekStart: record?.weekStart ?? currentWeek,
    source: record?.source ?? (selected ? "project" : "ad_hoc"),
    subtasksText: record?.subtasks?.map((item) => item.title).join("\n") ?? "",
  };
  return (
    <RecordDialog<typeof initial>
      title={record ? "Edit task" : "New task"}
      description={
        selected
          ? "Add a task to this project."
          : "Add a task for this week. A weekly plan is optional."
      }
      onClose={onClose}
      initial={initial}
      fields={(values): Field<typeof values>[] => [
        { name: "title", label: "Task name", required: true },
        { name: "description", label: "Notes (optional)", type: "textarea" },
        { name: "due", label: "Due date", type: "date", required: true },
        {
          name: "priority",
          label: "Priority",
          type: "select",
          options: ["High", "Medium", "Low", "Urgent"].map((value) => ({ value, label: value })),
        },
        ...(!selected && availableBusinesses.length > 1
          ? [
              {
                name: "business" as const,
                label: "Business",
                type: "select" as const,
                options: availableBusinesses.map((business) => ({
                  value: business.id,
                  label: business.name,
                })),
              },
            ]
          : []),
        ...(mode === "ceo" || manages(values.business) || parent?.lead === me.id
          ? [
              {
                name: "assignee" as const,
                label: "Assignee",
                type: "select" as const,
                required: true,
                options: people
                  .filter((person) => !selected || parent?.members.includes(person.id))
                  .map((person) => ({ value: person.id, label: person.name })),
              },
            ]
          : []),
        ...(record
          ? [
              {
                name: "subtasksText" as const,
                label: "Subtasks (optional, one per line)",
                type: "textarea" as const,
              },
            ]
          : []),
      ]}
      onSave={(values) =>
        saveRecord(
          "tasks",
          taskSchema.parse({
            ...record,
            ...values,
            description:
              record && values.description === initial.description
                ? record.description
                : values.description,
            id: record?.id ?? crypto.randomUUID(),
            subtasks: values.subtasksText
              .split("\n")
              .map((title) => title.trim())
              .filter(Boolean)
              .map((title, index) => {
                const previous =
                  record?.subtasks?.[index]?.title === title ? record.subtasks[index] : undefined;
                return {
                  id: previous?.id ?? crypto.randomUUID(),
                  title,
                  done: previous?.done ?? false,
                };
              }),
          }),
        )
      }
    />
  );
}

export function ClientForm({
  record,
  onClose,
}: {
  record?: Client | undefined;
  onClose: () => void;
}) {
  const { people, departments, businesses } = useWorkspace();
  const { mode, me } = useRole();
  return (
    <RecordDialog
      title={record ? "Edit client" : "Add client"}
      onClose={onClose}
      initial={{
        name: record?.name ?? "",
        contact: record?.contact ?? "",
        services: record?.services.join(", ") ?? "",
        assignees: record?.assignees ?? [me.id],
        assignedDept: record?.assignedDept ?? "",
        business: record?.business ?? "b0",
      }}
      fields={[
        { name: "name", label: "Client name", required: true },
        { name: "contact", label: "Contact person", required: true },
        { name: "services", label: "Services (comma separated)", required: true },
        {
          name: "assignees",
          label: "Assigned staff",
          type: "multi",
          options: people.map((person) => ({ value: person.id, label: person.name })),
        },
        {
          name: "assignedDept",
          label: "Assigned department",
          type: "select",
          options: [
            { value: "", label: "Selected staff only" },
            ...departments
              .filter((dept) => mode === "ceo" || dept.id === me.dept)
              .map((dept) => ({ value: dept.id, label: dept.name })),
          ],
        },
        {
          name: "business",
          label: "Business",
          type: "select",
          options: businesses.map((business) => ({ value: business.id, label: business.name })),
        },
      ]}
      onSave={(values) =>
        saveRecord(
          "clients",
          clientSchema.parse({
            ...values,
            id: record?.id ?? crypto.randomUUID(),
            assignedDept: values.assignedDept || undefined,
            services: [
              ...new Set(
                values.services
                  .split(",")
                  .map((service) => service.trim())
                  .filter(Boolean),
              ),
            ],
          }),
        )
      }
    />
  );
}

export function TenderForm({
  record,
  onClose,
}: {
  record?: Tender | undefined;
  onClose: () => void;
}) {
  const { people } = useWorkspace();
  const { mode, me } = useRole();
  return (
    <RecordDialog
      title={record ? "Edit tender" : "Log tender"}
      onClose={onClose}
      initial={{
        title: record?.title ?? "",
        issuer: record?.issuer ?? "",
        value: record?.value ?? 0,
        due: record?.due ?? today(),
        stage: record?.stage ?? "Identified",
        members: record?.members ?? [me.id],
        notes: record?.notes ?? "",
      }}
      fields={[
        { name: "title", label: "Tender title", required: true },
        { name: "issuer", label: "Issuer", required: true },
        { name: "value", label: "Value (KES)", type: "number", min: 0, required: true },
        { name: "due", label: "Closing date", type: "date", required: true },
        { name: "stage", label: "Stage", type: "select", options: options(tenderStages) },
        {
          name: "members",
          label: "Assigned staff",
          type: "multi",
          required: true,
          options: people.map((person) => ({ value: person.id, label: person.name })),
        },
        { name: "notes", label: "Notes", type: "textarea" },
      ]}
      onSave={(values) =>
        saveRecord(
          "tenders",
          tenderSchema.parse({
            ...values,
            id: record?.id ?? crypto.randomUUID(),
            members: mode === "ceo" ? values.members : [...new Set([...values.members, me.id])],
          }),
        )
      }
    />
  );
}

export function RequestForm({
  record,
  onClose,
}: {
  record?: ClientRequest | undefined;
  onClose: () => void;
}) {
  const { people, clients, departments, businesses } = useWorkspace();
  const { mode, me } = useRole();
  return (
    <RecordDialog
      title={record ? "Edit client request" : "Log client request"}
      onClose={onClose}
      initial={{
        title: record?.title ?? "",
        clientMode: record?.client ? "existing" : "prospective",
        client: record?.client ?? clients[0]?.id ?? "",
        prospectClientName: record?.prospectClientName ?? "",
        source: record?.source ?? (me.dept === "marketing" ? "marketing" : "operations"),
        received: record?.received ?? today(),
        handler: record?.handler ?? me.id,
        assignedDept: record?.assignedDept ?? me.dept ?? "",
        business: record?.business ?? "b0",
        status: record?.status ?? "Received",
        notes: record?.notes ?? "",
      }}
      fields={(values) => [
        { name: "title", label: "Request title", required: true },
        ...(mode === "ceo"
          ? [
              {
                name: "source" as const,
                label: "Request source",
                type: "select" as const,
                options: [
                  { value: "operations", label: "Operations" },
                  { value: "marketing", label: "Marketing" },
                ],
              },
            ]
          : []),
        {
          name: "clientMode",
          label: "Client",
          type: "select",
          options: [
            { value: "existing", label: "Existing Amsol client" },
            { value: "prospective", label: "Prospective client (not added to Clients)" },
          ],
        },
        ...(values.clientMode === "existing"
          ? [
              {
                name: "client" as const,
                label: "Select client",
                type: "select" as const,
                required: true,
                options: [
                  { value: "", label: "Choose an existing client" },
                  ...clients.map((client) => ({ value: client.id, label: client.name })),
                ],
              },
            ]
          : [
              {
                name: "prospectClientName" as const,
                label: "Prospective client name",
                required: true,
              },
            ]),
        { name: "received", label: "Date received", type: "date", required: true },
        {
          name: "assignedDept",
          label: "Assigned department",
          type: "select",
          options: [
            { value: "", label: "Assigned handler only" },
            ...departments
              .filter((dept) => mode === "ceo" || dept.id === me.dept)
              .map((dept) => ({ value: dept.id, label: dept.name })),
          ],
        },
        {
          name: "business",
          label: "Business",
          type: "select",
          options: businesses.map((business) => ({ value: business.id, label: business.name })),
        },
        {
          name: "handler",
          label: "Handler",
          type: "select",
          required: true,
          options: people
            .filter(
              (person) => mode === "ceo" || person.id === me.id || person.dept === values.source,
            )
            .map((person) => ({ value: person.id, label: person.name })),
        },
        { name: "status", label: "Status", type: "select", options: options(requestStatuses) },
        { name: "notes", label: "Notes", type: "textarea" },
      ]}
      onSave={(values) =>
        saveRecord(
          "clientRequests",
          requestSchema.parse({
            ...values,
            id: record?.id ?? crypto.randomUUID(),
            client: values.clientMode === "existing" ? values.client : undefined,
            assignedDept: values.assignedDept || undefined,
            prospectClientName:
              values.clientMode === "prospective" ? values.prospectClientName : undefined,
          }),
        )
      }
    />
  );
}

export function BusinessForm({
  record,
  onClose,
}: {
  record?: Business | undefined;
  onClose: () => void;
}) {
  return (
    <RecordDialog
      title={record ? "Edit business" : "Add business"}
      onClose={onClose}
      initial={{ name: record?.name ?? "", sector: record?.sector ?? "" }}
      fields={[
        { name: "name", label: "Business name", required: true },
        { name: "sector", label: "Sector", required: true },
      ]}
      onSave={(values) =>
        saveRecord(
          "businesses",
          businessSchema.parse({ ...values, id: record?.id ?? crypto.randomUUID() }),
        )
      }
    />
  );
}

export function FinanceForm({
  record,
  businessId,
  onClose,
}: {
  record?: BusinessFinance | undefined;
  businessId?: string | undefined;
  onClose: () => void;
}) {
  const { businesses: allBusinesses } = useWorkspace();
  const { mode } = useRole();
  const access = useBusinessAccess();
  const businesses = allBusinesses.filter((business) =>
    canManageBusinessFinance(mode, business.id, access),
  );
  return (
    <RecordDialog
      title={record ? "Edit finance entry" : "Log business finances"}
      description="Record a dated business finance entry with a description."
      onClose={onClose}
      initial={{
        business: record?.business ?? businessId ?? businesses[0]?.id ?? "",
        date: record?.date ?? today(),
        description: record?.description ?? record?.note ?? "",
        revenue: record?.revenue ?? 0,
        expenses: record?.expenses ?? 0,
      }}
      fields={[
        {
          name: "business",
          label: "Business",
          type: "select",
          required: true,
          options: businesses.map((business) => ({ value: business.id, label: business.name })),
        },
        { name: "date", label: "Date", type: "date", required: true },
        { name: "description", label: "Description", type: "textarea", required: true },
        { name: "revenue", label: "Revenue (KES)", type: "number", min: 0, required: true },
        { name: "expenses", label: "Expenses (KES)", type: "number", min: 0, required: true },
      ]}
      onSave={(values) =>
        saveRecord(
          "businessFinance",
          financeSchema.parse({
            ...values,
            month: values.date.slice(0, 7),
            id: record?.id ?? crypto.randomUUID(),
          }),
        )
      }
    />
  );
}

export function ModuleForm({
  record,
  dept,
  module,
  onClose,
}: {
  record?: ModuleRecord | undefined;
  dept: DeptId;
  module: string;
  onClose: () => void;
}) {
  const { people } = useWorkspace();
  const { me, mode } = useRole();
  return (
    <RecordDialog
      title={record ? `Edit ${module} record` : `Add ${module} record`}
      onClose={onClose}
      initial={{
        title: record?.title ?? "",
        owner: record?.owner ?? me.id,
        date: record?.date ?? today(),
        status: record?.status ?? "Planned",
        notes: record?.notes ?? "",
        amount: record?.amount ?? 0,
      }}
      fields={[
        { name: "title", label: "Title / reference", required: true },
        {
          name: "owner",
          label: "Owner",
          type: "select",
          required: true,
          options: people
            .filter((person) => mode === "ceo" || person.id === me.id)
            .map((person) => ({ value: person.id, label: person.name })),
        },
        { name: "date", label: "Date", type: "date", required: true },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: options(["Planned", "In progress", "Completed", "Blocked"]),
        },
        { name: "amount", label: "Amount (KES, if applicable)", type: "number", min: 0 },
        { name: "notes", label: "Details / notes", type: "textarea", required: true },
      ]}
      onSave={(values) =>
        saveRecord(
          "moduleRecords",
          moduleRecordSchema.parse({
            ...values,
            amount: Number(values.amount),
            id: record?.id ?? crypto.randomUUID(),
            dept,
            module,
          }),
        )
      }
    />
  );
}
