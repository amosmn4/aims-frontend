import { useSyncExternalStore } from "react";
import { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError, isDemo } from "./api";
import * as demo from "./workspace-demo";
import { workspaceSchema, type Collection, type RecordOf, type Workspace } from "./models";

export { seedWorkspace, validateRelationships, STORAGE_KEY } from "./workspace-demo";
const queryClient = new QueryClient();
const listeners = new Set<() => void>();
let revision = -1;
let generation = 0;
let pending = false;
let storageError = "";
const empty = (): Workspace => ({
  version: 1,
  departments: [],
  people: [],
  accounts: [],
  clients: [],
  projects: [],
  tasks: [],
  reports: [],
  documents: [],
  tenders: [],
  clientRequests: [],
  businesses: [],
  businessFinance: [],
  businessAccess: [],
  staffBusiness: [],
  moduleRecords: [],
  templates: [],
  settings: {
    company: "Amsol Ops",
    reminderDays: 7,
    remindersEnabled: true,
    defaultDocumentAccess: "department",
  },
});
let current = empty();
const publish = () => listeners.forEach((listener) => listener());

export const getWorkspace = () => (isDemo ? demo.getWorkspace() : current);

export function clearWorkspace() {
  generation++;
  revision = -1;
  storageError = "";
  current = empty();
  queryClient.clear();
  publish();
}

export async function loadWorkspace() {
  if (isDemo) return;
  const requestedGeneration = generation;
  const result = await queryClient.fetchQuery({
    queryKey: ["ops-workspace", requestedGeneration],
    queryFn: () => api<{ workspace: unknown; revision: number }>("/workspace"),
    staleTime: 0,
    retry: false,
  });
  if (requestedGeneration !== generation) return;
  const data = workspaceSchema.parse(result.workspace);
  if (result.revision < revision) return;
  current = data;
  revision = result.revision;
  storageError = "";
  publish();
}

export async function mutateApi<T = unknown>(path: string, options: RequestInit): Promise<T> {
  if (pending) throw new Error("A change is being saved. Please wait and try again.");
  if (revision < 0 || storageError) throw new Error("Reload the workspace before saving changes.");
  const requestedGeneration = generation;
  pending = true;
  try {
    const result = await api<T>(path, {
      ...options,
      headers: { ...options.headers, "If-Match": String(revision) },
    });
    if (requestedGeneration === generation) {
      try {
        await loadWorkspace();
      } catch {
        storageError =
          "Your change was saved, but the workspace could not refresh. Reload it before continuing.";
        current = { ...current };
        publish();
      }
    }
    return result;
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) await loadWorkspace().catch(() => {});
    throw error;
  } finally {
    pending = false;
  }
}

export function saveRecord<K extends Collection>(collection: K, record: RecordOf<K>) {
  if (isDemo) return demo.saveRecord(collection, record);
  if (collection === "accounts") {
    const account = record as RecordOf<"accounts">;
    return mutateApi(`/accounts/${encodeURIComponent(account.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ role: account.role, active: account.active }),
    }).then(() => {});
  }
  return mutateApi(`/records/${collection}/${encodeURIComponent(record.id)}`, {
    method: "PUT",
    body: JSON.stringify(record),
  }).then(() => {});
}

export function removeRecord(collection: Collection, id: string) {
  if (isDemo) return demo.removeRecord(collection, id);
  return mutateApi(`/records/${collection}/${encodeURIComponent(id)}`, { method: "DELETE" }).then(
    () => {},
  );
}

export function updateWorkspace(update: (previous: Workspace) => Workspace): void | Promise<void> {
  if (isDemo) return demo.updateWorkspace(update);
  const next = update(current);
  const changed = Object.keys(current).filter(
    (key) =>
      JSON.stringify(current[key as keyof Workspace]) !==
      JSON.stringify(next[key as keyof Workspace]),
  );
  if (changed.length === 1 && changed[0] === "settings")
    return mutateApi("/settings", { method: "PUT", body: JSON.stringify(next.settings) }).then(
      () => {},
    );
  if (
    changed.length &&
    changed.every((key) => key === "staffBusiness" || key === "businessAccess")
  ) {
    const personIds = [
      ...new Set(
        [
          ...current.staffBusiness,
          ...next.staffBusiness,
          ...current.businessAccess,
          ...next.businessAccess,
        ].map((row) => row.person),
      ),
    ];
    const people = personIds.filter(
      (person) =>
        JSON.stringify(current.staffBusiness.filter((row) => row.person === person)) !==
          JSON.stringify(next.staffBusiness.filter((row) => row.person === person)) ||
        JSON.stringify(current.businessAccess.filter((row) => row.person === person)) !==
          JSON.stringify(next.businessAccess.filter((row) => row.person === person)),
    );
    if (people.length !== 1)
      throw new Error("Update one staff member's business permissions at a time.");
    const person = people[0]!;
    return mutateApi(`/business-permissions/${encodeURIComponent(person)}`, {
      method: "PUT",
      body: JSON.stringify({
        home: next.staffBusiness.find((row) => row.person === person)?.business ?? null,
        grants: next.businessAccess
          .filter((row) => row.person === person)
          .map((row) => row.business),
      }),
    }).then(() => {});
  }
  if (!changed.length) return;
  throw new Error("Use the corresponding server action to change these records.");
}

export async function reviewReport(id: string, comment?: string) {
  if (isDemo) {
    demo.updateWorkspace((data) => ({
      ...data,
      reports: data.reports.map((row) =>
        row.id === id ? { ...row, reviewed: true, comment: comment?.trim() || row.comment } : row,
      ),
    }));
    return;
  }
  await mutateApi(`/reports/${encodeURIComponent(id)}/review`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

export async function commentTask(id: string, comment: string) {
  if (isDemo) {
    demo.updateWorkspace((data) => ({
      ...data,
      tasks: data.tasks.map((task) =>
        task.id === id ? { ...task, ceoComment: comment.trim() || undefined } : task,
      ),
    }));
    return;
  }
  await mutateApi(`/tasks/${encodeURIComponent(id)}/comment`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

export async function perform(action: () => void | Promise<void>, message = "Changes saved") {
  try {
    await action();
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

function useApiWorkspace() {
  const data = useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
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

export const useWorkspace = isDemo ? demo.useWorkspace : useApiWorkspace;
