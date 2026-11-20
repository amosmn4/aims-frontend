import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, PageHeader, Pill } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/production/components/confirm-dialog";
import { WeeklyEntryView } from "@/components/weekly/WeeklyEntryView";
import { useAccount } from "@/lib/account";
import { api, isDemo } from "@/lib/api";
import {
  reportingWeek,
  useWeekly,
  weeklyStatus,
  weeklyTime,
  type WeeklyBrief,
  type WeeklyDelivery,
  type WeeklyPhase,
} from "@/lib/weekly";

export const Route = createFileRoute("/weekly-brief")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { week?: string; staff?: string; phase?: WeeklyPhase } => ({
    ...(typeof search["week"] === "string" ? { week: search["week"] } : {}),
    ...(typeof search["staff"] === "string" ? { staff: search["staff"] } : {}),
    ...(search["phase"] === "plan" || search["phase"] === "report"
      ? { phase: search["phase"] }
      : {}),
  }),
  head: () => ({
    meta: [{ title: "CEO weekly brief | Amsol Ops" }, { name: "robots", content: "noindex" }],
  }),
  component: WeeklyBriefPage,
});
function WeeklyBriefPage() {
  const { account } = useAccount();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const week = search.week ?? reportingWeek();
  const phase = search.phase ?? "plan";
  const ceo = account?.role === "ceo";
  const preview = useWeekly<WeeklyBrief>(
    `brief?week=${encodeURIComponent(week)}&phase=${phase}`,
    ceo,
  );
  const history = useWeekly<WeeklyDelivery[]>("deliveries", ceo);
  const [showEmail, setShowEmail] = useState(false);
  const client = useQueryClient();
  const send = useMutation({
    mutationFn: () =>
      api<{ status: string }>("/weekly/deliveries", {
        method: "POST",
        body: JSON.stringify({ week, phase }),
      }),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ["weekly"] });
      if (result.status === "sent") toast.success("One consolidated brief was sent to your email");
      else toast.error("Delivery could not be confirmed. Check delivery history.");
    },
  });
  const retry = useMutation({
    mutationFn: (id: string) =>
      api<{ status: string }>(`/weekly/deliveries/${id}/retry`, {
        method: "POST",
        body: JSON.stringify({ acknowledgePossibleDuplicate: true }),
      }),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ["weekly"] });
      toast.info(`Delivery status: ${result.status}`);
    },
  });
  if (isDemo || !ceo)
    return <Card>Weekly email briefs are available to signed-in CEO accounts.</Card>;
  const person = preview.data?.data.staff.find((row) => row.id === search.staff);
  return (
    <div className="space-y-5">
      <PageHeader
        title="CEO weekly brief"
        subtitle="Separate consolidated emails for weekly plans and weekly results."
        action={
          <Link to="/weekly-settings" className="action-button">
            Reporting schedules
          </Link>
        }
      />
      <div className="flex flex-wrap items-end gap-4">
        <label className="field-label">
          Reporting week
          <input
            aria-label="Reporting week"
            className="field-input"
            type="date"
            value={week}
            onChange={(event) => {
              if (event.target.value)
                void navigate({
                  search: {
                    week: reportingWeek(new Date(`${event.target.value}T12:00:00Z`)),
                    phase,
                  },
                });
            }}
          />
        </label>
        <label className="field-label">
          Brief type
          <select
            aria-label="Brief type"
            className="field-input"
            value={phase}
            onChange={(event) => {
              void navigate({ search: { week, phase: event.target.value as WeeklyPhase } });
            }}
          >
            <option value="plan">Weekly plans</option>
            <option value="report">Weekly reports</option>
          </select>
        </label>
        <Link
          to="/weekly-reports"
          search={{ week, phase }}
          className="text-sm text-primary underline"
        >
          Open weekly reporting
        </Link>
      </div>
      {preview.isPending && <p role="status">Preparing brief...</p>}
      {preview.error && <p role="alert">{preview.error.message}</p>}
      {preview.data && (
        <>
          <Card>
            <h2 className="font-display text-xl font-semibold">{preview.data.subject}</h2>
            <p className="my-3 text-sm">
              {preview.data.data.staff.filter((row) => row[phase]?.submittedAt).length} of{" "}
              {preview.data.data.staff.length} staff submitted. Week ends{" "}
              {preview.data.data.weekEnd}.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => setShowEmail((value) => !value)}>
                {showEmail ? "Hide email preview" : "Preview email"}
              </Button>
              <Button
                disabled={send.isPending || !preview.data.data.configured}
                onClick={async () => {
                  if (
                    await confirmDialog({
                      title: "Send weekly brief now?",
                      description:
                        "This sends one consolidated brief to your CEO email. Each week and brief type can be sent once.",
                      confirmLabel: "Send brief",
                    })
                  )
                    send.mutate();
                }}
              >
                Send brief to me now
              </Button>
            </div>
            {send.error && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {send.error.message}
              </p>
            )}
            {showEmail && (
              <iframe
                title="Weekly email preview"
                sandbox=""
                srcDoc={preview.data.html}
                className="mt-4 h-[34rem] w-full rounded-lg border bg-white"
              />
            )}
          </Card>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-3">Staff</th>
                    <th className="p-3">Submission</th>
                    <th className="p-3">Tasks</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.data.data.staff.map((row) => (
                    <tr key={row.id} className="border-b">
                      <td className="p-3 align-top">
                        <Link
                          to="/weekly-brief"
                          search={{ week, phase, staff: row.id }}
                          className="font-medium text-primary underline"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="p-3 align-top">
                        <Pill>{weeklyStatus(row[phase], row.expected[phase])}</Pill>
                      </td>
                      <td className="max-w-lg whitespace-pre-wrap p-3 align-top">
                        {row[phase]?.submittedAt
                          ? row[phase]?.submission.items.map((item) => item.title).join(" | ") ||
                            row[phase]?.submission.note ||
                            "No tasks recorded."
                          : "No submitted brief available."}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {search.staff && !person && (
            <p role="alert">This staff member is not included in the selected week's brief.</p>
          )}
          {person && (
            <section className="space-y-3">
              <h2 className="font-display text-xl font-semibold">{person.name}</h2>
              {person[phase] ? (
                <WeeklyEntryView key={`${person.id}:${week}:${phase}`} entry={person[phase]!} />
              ) : (
                <Card>No submission has been received from {person.name}.</Card>
              )}
            </section>
          )}
        </>
      )}
      <Card>
        <h2 className="mb-4 font-display text-xl font-semibold">Email delivery history</h2>
        {history.error && <p role="alert">{history.error.message}</p>}
        {!history.data?.length && (
          <p className="text-sm text-muted-foreground">No weekly emails have been prepared yet.</p>
        )}
        <div className="space-y-3">
          {history.data?.map((row) => (
            <div key={row.id} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-3">
                <p>
                  <strong>{row.phase === "plan" ? "Plans" : "Reports"}</strong> | {row.weekStart} |{" "}
                  {row.recipient.name}
                </p>
                <Pill>{row.status}</Pill>
              </div>
              <p className="mt-2">
                {row.sentAt ? `Sent ${weeklyTime(row.sentAt)}` : `Attempts: ${row.attempts}`}
              </p>
              {row.lastError && <p className="mt-2">{row.lastError}</p>}
              {["failed", "uncertain"].includes(row.status) && (
                <Button
                  variant="outline"
                  className="mt-3"
                  disabled={retry.isPending}
                  onClick={async () => {
                    if (
                      await confirmDialog({
                        title: "Retry email delivery?",
                        description:
                          "Check your inbox first. An unconfirmed attempt may already have arrived.",
                        confirmLabel: "Retry delivery",
                      })
                    )
                      retry.mutate(row.id);
                  }}
                >
                  Retry delivery
                </Button>
              )}
            </div>
          ))}
        </div>
        {retry.error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {retry.error.message}
          </p>
        )}
      </Card>
    </div>
  );
}
