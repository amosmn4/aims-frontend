import { useState, type ReactNode } from "react";
import AddOutlined from "@mui/icons-material/AddOutlined";
import { Card, PageHeader, Pill } from "@/components/kit";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAccount } from "@/lib/account";
import {
  reportingWeek,
  useWeekly,
  weeklyStatus,
  weeklyTime,
  type WeeklyDetail,
  type WeeklyEntry,
  type WeeklyHistory,
  type WeeklyPhase,
} from "@/lib/weekly";
import { WeeklyEditor } from "./WeeklyEditor";
import { WeeklyEntryView } from "./WeeklyEntryView";

function WeeklyModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Review or prepare your weekly submission.</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function StaffWeeklyReports({
  phase,
  week,
  onFilter,
}: {
  phase: WeeklyPhase;
  week: string | undefined;
  onFilter: (phase: WeeklyPhase, week?: string) => void;
}) {
  const { account } = useAccount();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<WeeklyEntry | null>(null);
  const [action, setAction] = useState<{ kind: "new" | "edit" | "append"; week: string } | null>(
    null,
  );
  const [reload, setReload] = useState(0);
  const params = new URLSearchParams({
    phase,
    page: String(page),
    ...(week ? { week } : {}),
    ...(status ? { status } : {}),
  });
  const listing = useWeekly<WeeklyHistory>(`submissions?${params}`);
  const detail = useWeekly<WeeklyDetail>(
    `reports/${action?.week ?? reportingWeek()}/${account?.id ?? ""}`,
    !!action && action.kind !== "new",
  );
  const close = () => setAction(null);
  const noun = phase === "plan" ? "plan" : "report";
  return (
    <div className="space-y-6">
      <PageHeader
        title={phase === "plan" ? "My weekly plans" : "My weekly reports"}
        subtitle="Your submissions, saved drafts and feedback in one place."
        action={
          <Button onClick={() => setAction({ kind: "new", week: week ?? reportingWeek() })}>
            <AddOutlined fontSize="small" />
            New {noun}
          </Button>
        }
      />
      <div className="flex flex-wrap gap-2">
        {(["plan", "report"] as const).map((value) => (
          <Button
            key={value}
            variant={phase === value ? "default" : "outline"}
            onClick={() => {
              setPage(1);
              setStatus("");
              onFilter(value, week);
            }}
          >
            {value === "plan" ? "Weekly plans" : "Weekly reports"}
          </Button>
        ))}
      </div>
      <Card>
        <div className="mb-5 flex flex-wrap items-end gap-4">
          <label className="field-label">
            Reporting week
            <input
              aria-label="Reporting week"
              className="field-input"
              type="date"
              value={week ?? ""}
              onChange={(event) => {
                setPage(1);
                onFilter(
                  phase,
                  event.target.value
                    ? reportingWeek(new Date(`${event.target.value}T12:00:00Z`))
                    : undefined,
                );
              }}
            />
          </label>
          <label className="field-label">
            Submission status
            <select
              className="field-input"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All submissions and drafts</option>
              <option value="submitted">Submitted</option>
              <option value="draft">Drafts</option>
              <option value="returned">Returned for correction</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </label>
          {week && (
            <Button
              variant="ghost"
              onClick={() => {
                setPage(1);
                onFilter(phase);
              }}
            >
              All weeks
            </Button>
          )}
          <p className="text-sm text-muted-foreground">
            {listing.data?.total ?? 0} {noun}
            {listing.data?.total === 1 ? "" : "s"}
          </p>
        </div>
        {listing.isPending && <p role="status">Loading your weekly {noun}s...</p>}
        {listing.error && <p role="alert">{listing.error.message}</p>}
        {listing.data?.items.length === 0 && (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No weekly {noun}s match this view. Select New {noun} to prepare one.
          </p>
        )}
        <div className="space-y-3">
          {listing.data?.items.map((entry) => (
            <article key={entry.id} className="rounded-xl border p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold">Week of {entry.weekStart}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entry.submittedAt
                      ? `Submitted ${weeklyTime(entry.submittedAt)}`
                      : `Saved ${weeklyTime(entry.updatedAt)}`}{" "}
                    | {entry.submission.items.length} tasks
                  </p>
                </div>
                <Pill>{weeklyStatus(entry)}</Pill>
              </div>
              <p className="my-3 text-sm text-muted-foreground">
                {entry.submission.items
                  .slice(0, 3)
                  .map((item) => item.title)
                  .join(" | ") || "No tasks recorded"}
              </p>
              {entry.returnComment && (
                <p className="mb-3 text-sm">Correction requested: {entry.returnComment}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {entry.submittedAt ? (
                  <Button variant="outline" onClick={() => setView(entry)}>
                    View {noun}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setAction({ kind: "edit", week: entry.weekStart })}
                  >
                    {entry.returnedAt ? "Update and resubmit" : "Resume draft"}
                  </Button>
                )}
                {phase === "plan" && entry.submittedAt && (
                  <Button onClick={() => setAction({ kind: "append", week: entry.weekStart })}>
                    Add tasks
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
        {listing.data && listing.data.total > listing.data.limit && (
          <div className="mt-5 flex items-center justify-end gap-3">
            <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span className="text-sm">
              Page {page} of {Math.ceil(listing.data.total / listing.data.limit)}
            </span>
            <Button
              variant="outline"
              disabled={page * listing.data.limit >= listing.data.total}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </Card>
      {view && (
        <WeeklyModal
          title={`Submitted weekly ${noun} | ${view.weekStart}`}
          onClose={() => setView(null)}
        >
          <WeeklyEntryView entry={view} />
        </WeeklyModal>
      )}
      {action?.kind === "new" && (
        <WeeklyModal title={`New weekly ${noun}`} onClose={close}>
          <label className="field-label">
            Week to prepare
            <input
              aria-label="Week to prepare"
              className="field-input"
              type="date"
              value={action.week}
              onChange={(event) => {
                if (event.target.value)
                  setAction({
                    ...action,
                    week: reportingWeek(new Date(`${event.target.value}T12:00:00Z`)),
                  });
              }}
            />
          </label>
          <p className="text-sm text-muted-foreground">
            Each reporting week has one plan and one report. Existing drafts can be resumed.
          </p>
          <Button onClick={() => setAction({ ...action, kind: "edit" })}>Continue</Button>
        </WeeklyModal>
      )}
      {action &&
      action.kind !== "new" &&
      (detail.isPending ||
        detail.error ||
        !detail.data?.configured ||
        (action.kind === "edit" && detail.data[phase]?.submittedAt) ||
        (action.kind === "append" &&
          (!detail.data.plan?.submittedAt || detail.data.report?.submittedAt))) ? (
        <WeeklyModal title={`Weekly ${noun} | ${action.week}`} onClose={close}>
          {detail.isPending ? (
            <p role="status">Loading submission...</p>
          ) : detail.error ? (
            <p role="alert">{detail.error.message}</p>
          ) : !detail.data?.configured ? (
            <p>The CEO has not configured weekly reporting yet.</p>
          ) : (
            <p>
              {action.kind === "append"
                ? "Tasks can be added to a submitted plan before its weekly report is submitted."
                : `This week's ${noun} is already submitted. Open it from the list${phase === "plan" ? " or use Add tasks" : ""}.`}
            </p>
          )}
        </WeeklyModal>
      ) : (
        action &&
        action.kind !== "new" &&
        detail.data && (
          <WeeklyEditor
            key={`${action.week}:${phase}:${action.kind}:${reload}`}
            detail={detail.data}
            phase={phase}
            append={action.kind === "append"}
            onClose={close}
            onReload={() => {
              void detail.refetch().then(() => setReload((value) => value + 1));
            }}
          />
        )
      )}
    </div>
  );
}
