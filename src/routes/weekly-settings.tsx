import { createFileRoute, Link, useBlocker } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, PageHeader } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/production/components/confirm-dialog";
import { api, isDemo } from "@/lib/api";
import { useAccount } from "@/lib/account";
import { useWeekly, type WeeklySettings, type WeeklySettingsResponse } from "@/lib/weekly";

export const Route = createFileRoute("/weekly-settings")({
  head: () => ({ meta: [{ title: "Weekly reporting schedules | Amsol Ops" }] }),
  component: WeeklySettingsPage,
});
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
function WeeklySettingsPage() {
  const { account } = useAccount();
  const settings = useWeekly<WeeklySettingsResponse>("settings", account?.role === "ceo");
  const [reload, setReload] = useState(0);
  if (isDemo || account?.role !== "ceo")
    return <Card>Only CEO accounts can configure weekly reporting schedules.</Card>;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Weekly reporting schedules"
        subtitle="Set separate deadlines and email delivery times for plans and reports."
        action={
          <Link to="/weekly-brief" className="action-button">
            Weekly email briefs
          </Link>
        }
      />
      {settings.isPending && <p role="status">Loading reporting schedules...</p>}
      {settings.error && <p role="alert">{settings.error.message}</p>}
      {settings.data && (
        <ScheduleForm
          key={reload}
          initial={settings.data}
          onReload={() => {
            void settings.refetch().then(() => setReload((value) => value + 1));
          }}
        />
      )}
    </div>
  );
}
function ScheduleForm({
  initial,
  onReload,
}: {
  initial: WeeklySettingsResponse;
  onReload: () => void;
}) {
  const [form, setForm] = useState<WeeklySettings>(initial.settings);
  const [version, setVersion] = useState(initial.version);
  const [saved, setSaved] = useState(JSON.stringify(initial.settings));
  const dirty = JSON.stringify(form) !== saved;
  useBlocker({
    shouldBlockFn: async () =>
      dirty &&
      !(await confirmDialog({
        title: "Discard schedule changes?",
        description: "You have unsaved schedule changes. Leave and discard them?",
        confirmLabel: "Discard changes",
        destructive: true,
      })),
    enableBeforeUnload: false,
  });
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      api("/weekly/settings", {
        method: "PUT",
        body: JSON.stringify({ version, settings: form }),
      }),
    onSuccess: async () => {
      setVersion((value) => value + 1);
      setSaved(JSON.stringify(form));
      await client.invalidateQueries({ queryKey: ["weekly"] });
      toast.success("Weekly reporting schedules saved");
    },
  });
  const change = <K extends keyof WeeklySettings>(key: K, value: WeeklySettings[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
      className="space-y-5"
    >
      <Card>
        <h2 className="mb-3 font-display text-xl font-semibold">Reporting period</h2>
        <label className="field-label max-w-xs">
          First reporting week
          <input
            required
            type="date"
            className="field-input"
            value={form.startWeek}
            onChange={(event) => change("startWeek", event.target.value)}
          />
        </label>
        <p className="mt-3 text-sm text-muted-foreground">
          Select a Monday. Each plan and report covers that Monday through Sunday. New staff are
          expected only for deadlines after they joined Ops.
        </p>
      </Card>
      {(["plan", "report"] as const).map((phase) => (
        <Card key={phase}>
          <fieldset className="space-y-4">
            <legend className="mb-3 font-display text-xl font-semibold">
              {phase === "plan" ? "Weekly plans" : "Weekly reports"}
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field-label">
                {phase === "plan" ? "Plan" : "Report"} submission day
                <select
                  aria-label={`${phase === "plan" ? "Plan" : "Report"} submission day`}
                  className="field-input"
                  value={form[`${phase}DeadlineDay`]}
                  onChange={(event) => change(`${phase}DeadlineDay`, Number(event.target.value))}
                >
                  {days.map((day, index) => (
                    <option key={day} value={index + 1}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                {phase === "plan" ? "Plan" : "Report"} submission time
                <input
                  required
                  type="time"
                  className="field-input"
                  value={form[`${phase}DeadlineTime`]}
                  onChange={(event) => change(`${phase}DeadlineTime`, event.target.value)}
                />
              </label>
              {phase === "report" && (
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.reportDeadlineFollowingWeek}
                    onChange={(event) =>
                      change("reportDeadlineFollowingWeek", event.target.checked)
                    }
                  />
                  Report deadline falls in the following week
                </label>
              )}
              <label className="field-label">
                {phase === "plan" ? "Plans" : "Reports"} email day
                <select
                  aria-label={`${phase === "plan" ? "Plans" : "Reports"} email day`}
                  className="field-input"
                  value={form[`${phase}EmailDay`]}
                  onChange={(event) => change(`${phase}EmailDay`, Number(event.target.value))}
                >
                  {days.map((day, index) => (
                    <option key={day} value={index + 1}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                {phase === "plan" ? "Plans" : "Reports"} email time
                <input
                  required
                  type="time"
                  className="field-input"
                  value={form[`${phase}EmailTime`]}
                  onChange={(event) => change(`${phase}EmailTime`, event.target.value)}
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form[`${phase}EmailEnabled`]}
                onChange={(event) => change(`${phase}EmailEnabled`, event.target.checked)}
              />
              Enable the consolidated {phase === "plan" ? "plans" : "reports"} email
            </label>
            <p className="text-sm text-muted-foreground">
              Delivery uses the first selected email day and time at or after this submission
              deadline. Each active CEO receives one email containing all staff, including missing
              submissions.
            </p>
          </fieldset>
        </Card>
      ))}
      <Card>
        <p className="font-medium">Timezone: Africa/Nairobi</p>
        <p className="mt-3 text-xs text-muted-foreground">
          Previously sent email snapshots are retained. Schedule changes affect briefs that have not
          yet been prepared.
        </p>
      </Card>
      {mutation.error && (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{mutation.error.message}</p>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              if (
                !dirty ||
                (await confirmDialog({
                  title: "Reload saved schedule?",
                  description: "This will discard your unsaved schedule changes.",
                  confirmLabel: "Reload schedule",
                  destructive: true,
                }))
              )
                onReload();
            }}
          >
            Reload saved schedule
          </Button>
        </div>
      )}
      <Button disabled={mutation.isPending}>
        {mutation.isPending ? "Saving schedules..." : "Save reporting schedules"}
      </Button>
    </form>
  );
}
