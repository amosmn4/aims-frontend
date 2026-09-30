import { useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import { useClientRequestActivities } from "@/features/client-requests/use-client-requests";
import { useProjectActivities, useTenderActivities } from "@/features/pipeline/use-pipeline";

export type ActivityRecordKind = "client_request" | "tender" | "project";
export type ActivityType = "call" | "email" | "meeting" | "note";

export interface ActivityRecordRef {
  kind: ActivityRecordKind;
  id: string;
}

/** The fields every activity list row shares. */
export interface ActivityRow {
  id: string;
  parent_id: string | null;
  type: string;
  summary: string;
  occurred_at: string;
  created_at: string;
  created_by_id: string | null;
  created_by_name: string | null;
}

export const ACTIVITY_TYPES: ActivityType[] = ["call", "email", "meeting", "note"];

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
};

export const ACTIVITY_RECORD_NOUN: Record<ActivityRecordKind, string> = {
  client_request: "request",
  tender: "tender",
  project: "project",
};

const API_BASE: Record<ActivityRecordKind, string> = {
  client_request: "/client-requests",
  tender: "/tenders",
  project: "/projects",
};

// Same cache roots the list hooks use, so boards and pages share one copy.
const CACHE_ROOT: Record<ActivityRecordKind, string> = {
  client_request: "client-requests",
  tender: "tenders",
  project: "projects",
};

export const activitiesKey = (record: ActivityRecordRef) =>
  [CACHE_ROOT[record.kind], record.id, "activities"] as const;

/** Reads the record back from an activity list's query key. */
export function recordFromActivitiesKey(key: readonly unknown[]): ActivityRecordRef | null {
  if (key.length !== 3 || key[2] !== "activities" || typeof key[1] !== "string") return null;
  const kind = (Object.keys(CACHE_ROOT) as ActivityRecordKind[]).find(
    (k) => CACHE_ROOT[k] === key[0],
  );
  return kind ? { kind, id: key[1] } : null;
}

export function useRecordActivities(record: ActivityRecordRef): UseQueryResult<ActivityRow[]> {
  const request = useClientRequestActivities(
    record.kind === "client_request" ? record.id : undefined,
  );
  const tender = useTenderActivities(record.kind === "tender" ? record.id : undefined);
  const project = useProjectActivities(record.kind === "project" ? record.id : undefined);
  if (record.kind === "client_request") return request;
  return record.kind === "tender" ? tender : project;
}

export function useLogRecordActivity(record: ActivityRecordRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      type?: ActivityType;
      summary: string;
      occurredAt?: string;
      parentId?: string;
    }) =>
      apiJson(`${API_BASE[record.kind]}/${record.id}/activities`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: activitiesKey(record) });
      qc.invalidateQueries({ queryKey: ["engagements"] });
    },
  });
}

export function useDeleteRecordActivity(record: ActivityRecordRef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (activityId: string) =>
      apiJson(`${API_BASE[record.kind]}/activities/${activityId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: activitiesKey(record) });
      qc.invalidateQueries({ queryKey: ["engagements"] });
    },
  });
}
