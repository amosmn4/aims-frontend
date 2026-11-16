import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import * as seed from "./data";
import { workspaceSchema, type Collection, type RecordOf, type Workspace } from "./models";

export const STORAGE_KEY = "amsol-ops-workspace-v1";
const hashes = [
  "66089e09976aec29b2a9bc1e2eac332bd82c24d755ed421fd55013fe0d0a7595",
  "6f3c071cde5f7a748ab1703da2ce7c2370a5951e413949f0bfc303a9c745d602",
  "7a1a1c9c4696ec293fe29cbfe9fc838a5a46acba78f4c2cd6ae39117968e338f",
  "28dd533ef9361aa7763abe900eb054da32da4abd7d305ffe144901e2deff6f67",
  "f3789521191498b6e21d117a0da1ba9b880d4e7f87da0425a6013c1ca433aedf",
  "5e31f23bbd8b74d75033aae22f9d2898b5530b0545b3d41f792e6dbd1c2cfca8",
  "c5015ea6018c12151486a9044402578765eaa722cb11911d7a4058c2c5daaffb",
  "0078eaccb9d81b38009e2b3adb1b5575f296a4eb437205507fba936cf21d40a8",
  "8b67ce50e40328fb819801485a9de8594a0e803017fe9cea781139eaab656b62",
];
const emails = ["ceo", "brian", "faith", "finance", "lucy", "it", "marketing", "operations", "joy"];

function addFinanceEntryDefaults(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const workspace = value as Record<string, unknown>;
  if (!Array.isArray(workspace["businessFinance"])) return value;
  return {
    ...workspace,
    businessFinance: workspace["businessFinance"].map((item: unknown) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return item;
      const row = item as Record<string, unknown>;
      const month = typeof row["month"] === "string" ? row["month"] : "";
      return {
        ...row,
        date: typeof row["date"] === "string" ? row["date"] : `${month}-01`,
        description:
          typeof row["description"] === "string"
            ? row["description"]
            : typeof row["note"] === "string" && row["note"].trim()
              ? row["note"]
              : "Existing monthly finance record",
      };
    }),
  };
}

export function seedWorkspace(): Workspace {
  return workspaceSchema.parse({
    version: 1,
    departments: seed.departments,
    people: seed.people,
    clients: seed.clients,
    projects: seed.projects,
    tasks: seed.tasks,
    reports: seed.reports,
    documents: seed.documents.map((doc) => ({
      ...doc,
      name: `${doc.name.replace(/\.[^.]+$/, "")} (sample).pdf`,
      sample: true,
      mime: "application/pdf",
    })),
    tenders: seed.tenders,
    clientRequests: seed.clientRequests,
    businesses: seed.businesses,
    businessFinance: seed.businessFinance,
    businessAccess: seed.businessAccess,
    staffBusiness: seed.staffBusiness,
    accounts: seed.people.map((person, index) => ({
      id: `account-${person.id}`,
      personId: person.id,
      email: `${emails[index]}@amsol.local`,
      role: index === 0 ? "ceo" : "staff",
      active: true,
      salt: `amsol-local-${person.id}`,
      passwordHash: hashes[index],
    })),
    moduleRecords: [],
    templates: [
      {
        id: "standard",
        name: "Standard update",
        progress: "Progress made",
        blockers: "Blockers / support needed",
        next: "Next steps",
      },
    ],
    settings: {
      company: "Amsol Ops",
      reminderDays: 7,
      remindersEnabled: true,
      defaultDocumentAccess: "public",
    },
  });
}

let current: Workspace | undefined;
let storageError = "";
const listeners = new Set<() => void>();

export function getWorkspace(): Workspace {
  if (current) return current;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    current = saved
      ? workspaceSchema.parse(addFinanceEntryDefaults(JSON.parse(saved)))
      : seedWorkspace();
    validateRelationships(current);
  } catch {
    storageError =
      "Saved workspace could not be read. A temporary sample workspace is shown. Export or repair browser storage before saving.";
    current = seedWorkspace();
  }
  return current;
}

export function validateRelationships(data: Workspace) {
  const hasPerson = (id: string) => data.people.some((person) => person.id === id);
  const hasProject = (id: string) => data.projects.some((project) => project.id === id);
  const hasClient = (id: string) => data.clients.some((client) => client.id === id);
  const hasBusiness = (id: string) => data.businesses.some((business) => business.id === id);
  for (const project of data.projects) {
    if (
      !hasPerson(project.lead) ||
      project.members.some((id) => !hasPerson(id)) ||
      (project.client && !hasClient(project.client))
    )
      throw new Error("Projects must reference existing staff and clients.");
    if (!project.members.includes(project.lead))
      throw new Error("The project lead must belong to the project team.");
  }
  for (const task of data.tasks) {
    if (
      !hasProject(task.project) ||
      !data.projects.find((project) => project.id === task.project)?.members.includes(task.assignee)
    )
      throw new Error("Tasks must be assigned to a member of their project.");
  }
  for (const report of data.reports) {
    if (!hasPerson(report.author) || (report.project && !hasProject(report.project)))
      throw new Error("Reports must reference existing staff and projects.");
    if (report.type === "Project update" && !report.project)
      throw new Error("Select a project for a project update.");
  }
  for (const request of data.clientRequests)
    if (
      (!!request.client && !hasClient(request.client)) ||
      !hasPerson(request.handler) ||
      !!request.client === !!request.prospectClientName
    )
      throw new Error("Choose one existing or prospective client and an existing handler.");
  for (const tender of data.tenders)
    if (tender.members.some((id) => !hasPerson(id)))
      throw new Error("Tender members must be existing staff.");
  for (const row of data.businessFinance)
    if (!hasBusiness(row.business))
      throw new Error("Finance records must belong to an existing business.");
    else if (row.date.slice(0, 7) !== row.month)
      throw new Error("Finance entry date and reporting month must match.");
  for (const doc of data.documents) {
    if (
      !hasPerson(doc.owner) ||
      (doc.project && !hasProject(doc.project)) ||
      doc.allowed?.some((id) => !hasPerson(id))
    )
      throw new Error("Document references must exist.");
    if (doc.access === "project" && !doc.project)
      throw new Error("Choose a project for project access.");
    if (doc.access === "department" && !doc.dept)
      throw new Error("Choose a department for department access.");
    if (doc.access === "restricted" && !doc.allowed?.length)
      throw new Error("Choose staff who may open the restricted document.");
  }
  for (const row of [...data.businessAccess, ...data.staffBusiness])
    if (!hasPerson(row.person) || !hasBusiness(row.business))
      throw new Error("Business permissions must reference existing records.");
  for (const account of data.accounts)
    if (!hasPerson(account.personId))
      throw new Error("Accounts must belong to an existing staff member.");
  const emails = data.accounts.map((account) => account.email.toLowerCase());
  if (new Set(emails).size !== emails.length)
    throw new Error("An account already uses this email address.");
  if (
    !data.accounts.some(
      (account) => account.active && account.role === "ceo" && account.passwordHash,
    )
  )
    throw new Error("Keep at least one active CEO account.");
  if (new Set(data.accounts.map((account) => account.personId)).size !== data.accounts.length)
    throw new Error("A staff member can have only one account.");
  for (const record of data.moduleRecords) {
    if (!hasPerson(record.owner)) throw new Error("Choose an existing record owner.");
    if (
      !data.departments
        .find((department) => department.id === record.dept)
        ?.modules.includes(record.module)
    )
      throw new Error("Remove a module's records before removing the module.");
  }
}

export function updateWorkspace(update: (previous: Workspace) => Workspace) {
  const previous = getWorkspace();
  if (storageError) throw new Error(storageError);
  const next = workspaceSchema.parse(update(previous));
  validateRelationships(next);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    throw new Error("Browser storage is unavailable or full. Your change was not saved.");
  }
  current = next;
  listeners.forEach((listener) => listener());
}

export function saveRecord<K extends Collection>(collection: K, record: RecordOf<K>) {
  updateWorkspace((previous) => ({
    ...previous,
    [collection]: [...previous[collection].filter((item) => item.id !== record.id), record],
  }));
}

export function removeRecord(collection: Collection, id: string) {
  if (collection === "businesses" && id === seed.CORE_BUSINESS_ID)
    throw new Error("The core Amsol business cannot be deleted.");
  updateWorkspace((previous) => ({
    ...previous,
    [collection]: previous[collection].filter((item) => item.id !== id),
  }));
}

export function perform(action: () => void, message = "Changes saved") {
  try {
    action();
    toast.success(message);
    return true;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Your changes could not be saved.");
    return false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    current = undefined;
    storageError = "";
    getWorkspace();
    listeners.forEach((listener) => listener());
  });
}

export function useWorkspace() {
  const data = useSyncExternalStore(subscribe, getWorkspace, getWorkspace);
  return {
    ...data,
    storageError,
    person: (id: string) =>
      data.people.find((person) => person.id === id) ?? {
        id,
        name: "Unknown staff",
        title: "",
        dept: null,
      },
    project: (id: string) => data.projects.find((project) => project.id === id),
    client: (id: string) => data.clients.find((client) => client.id === id),
    deptName: (id: string) =>
      data.departments.find((department) => department.id === id)?.name ?? id,
  };
}
