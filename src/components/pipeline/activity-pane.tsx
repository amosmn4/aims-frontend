import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { LoadError } from "@/components/load-error";
import { ActivityThread } from "@/features/activity/activity-thread";
import { recordFromActivitiesKey, type ActivityRecordRef } from "@/features/activity/use-activity";

export interface ActivityEntry {
  id: string;
  type: string;
  summary: string;
  occurred_at: string;
  created_by_name: string | null;
  parent_id?: string | null;
}

interface ActivityPaneProps {
  /** The record these entries belong to; worked out from `activities` when omitted. */
  record?: ActivityRecordRef;
  activities?: ActivityEntry[];
  isLoading?: boolean;
  /** Unused: the pane logs, replies and deletes itself. Kept so existing callers compile. */
  onAdd?: (type: string, summary: string) => void;
  isAdding?: boolean;
  /** Boards have always let anyone who opens the record log activity. */
  canLog?: boolean;
  readOnlyReason?: string;
}

/** The Activity tab of a board's side panel: the record's Activity thread. */
export function ActivityPane({
  record,
  activities,
  isLoading,
  canLog = true,
  readOnlyReason,
}: ActivityPaneProps) {
  const qc = useQueryClient();
  // Finds the activity query that produced these rows, to learn its record.
  const inferred = useMemo(() => {
    if (record || !activities) return null;
    const query = qc
      .getQueryCache()
      .getAll()
      .find((q) => q.state.data === activities);
    return query ? recordFromActivitiesKey(query.queryKey) : null;
  }, [qc, record, activities]);
  const target = record ?? inferred;

  if (!target) {
    return isLoading ? (
      <div className="flex justify-center py-6" role="status" aria-label="Loading activity">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    ) : (
      <LoadError
        what="activity"
        onRetry={() =>
          qc.refetchQueries({
            predicate: (q) => q.queryKey[2] === "activities" && q.state.status === "error",
          })
        }
      />
    );
  }

  return (
    <ActivityThread
      key={`${target.kind}:${target.id}`}
      record={target}
      canLog={canLog}
      readOnlyReason={readOnlyReason}
      headingLevel="h3"
    />
  );
}
