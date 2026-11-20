import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import ScheduleOutlined from "@mui/icons-material/ScheduleOutlined";
import { isDemo } from "@/lib/api";
import { useSubmissionSchedules } from "@/lib/reporting";
import { mutateApi, perform } from "@/lib/workspace";
import { Button } from "./ui/button";

export type { SubmissionScheduleRecord } from "@/lib/reporting";

export function SubmissionSchedule({
  kind,
  target,
  saveDraft,
  disabled = false,
  onScheduled,
  onBusyChange,
}: {
  kind: "plan" | "report" | "monthly";
  target: string;
  saveDraft: () => Promise<unknown>;
  disabled?: boolean;
  onScheduled?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const client = useQueryClient();
  const query = useSubmissionSchedules();
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const schedule = query.data?.find((row) => row.kind === kind && row.target === target);
  if (isDemo) return null;
  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4 text-sm">
      <h3 className="flex items-center gap-2 font-semibold">
        <ScheduleOutlined fontSize="small" />
        Schedule submission
      </h3>
      <p className="text-muted-foreground">
        Your latest saved draft will submit automatically. You will receive a reminder one hour
        before. Email to the CEO follows the normal reporting schedule.
      </p>
      {query.error && <p role="alert">{query.error.message}</p>}
      {schedule && (
        <p role="status">
          {schedule.status}:{" "}
          {new Date(schedule.runAt).toLocaleString("en-GB", { timeZone: "Africa/Nairobi" })} EAT
          {schedule.lastError ? ` | ${schedule.lastError}` : ""}
        </p>
      )}
      {schedule?.status === "pending" &&
        new Date(schedule.runAt).getTime() - Date.now() <= 3600000 && (
          <p className="font-medium">
            Your submission is due within one hour. Save any updates before its scheduled time.
          </p>
        )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="field-label">
          Submission time (EAT)
          <input
            className="field-input"
            type="datetime-local"
            value={when}
            onChange={(event) => setWhen(event.target.value)}
          />
        </label>
        <Button
          type="button"
          disabled={busy || disabled || !when}
          onClick={async () => {
            setBusy(true);
            onBusyChange?.(true);
            await perform(async () => {
              const date = new Date(`${when}:00+03:00`);
              if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now())
                throw new Error("Choose a future date and time.");
              await saveDraft();
              await mutateApi("/submission-schedules", {
                method: "PUT",
                body: JSON.stringify({ kind, target, runAt: date.toISOString() }),
              });
              await client.invalidateQueries({ queryKey: ["submission-schedules"] });
              onScheduled?.();
            }, "Submission scheduled");
            setBusy(false);
            onBusyChange?.(false);
          }}
        >
          Save and schedule
        </Button>
        {schedule && ["pending", "failed"].includes(schedule.status) && (
          <Button
            type="button"
            variant="outline"
            disabled={busy || disabled}
            onClick={async () => {
              setBusy(true);
              onBusyChange?.(true);
              await perform(async () => {
                await mutateApi(`/submission-schedules/${schedule.id}`, { method: "DELETE" });
                await client.invalidateQueries({ queryKey: ["submission-schedules"] });
              }, "Schedule cancelled");
              setBusy(false);
              onBusyChange?.(false);
            }}
          >
            Cancel schedule
          </Button>
        )}
      </div>
    </div>
  );
}
