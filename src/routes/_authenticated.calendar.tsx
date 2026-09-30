import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import {
  useCalendarEvents,
  useDeadlines,
  toDateStr,
  DEADLINE_TYPE_ICONS,
  DEADLINE_TYPE_LABELS,
  DEADLINE_TYPE_STYLES,
  type CalendarEvent,
  type DeadlineItem,
  type DeadlineType,
} from "@/features/calendar/use-calendar";
import { EventFormDialog, type EventFormTarget } from "@/features/calendar/event-form-dialog";
import { EventDetailsDialog } from "@/features/calendar/event-details-dialog";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { formatDate } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar — AIMS" }] }),
  component: DeadlineCalendar,
});

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function DeadlineCalendar() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Calendar"
        description="Events and everything due across AIMS: tenders, bonds, contracts, tasks, milestones, payroll filings, reports and training."
      />
      <DeadlineCalendarView />
    </div>
  );
}

const typeLabel = (t: DeadlineType) => DEADLINE_TYPE_LABELS[t] ?? "Item";
const typeIcon = (t: DeadlineType) => DEADLINE_TYPE_ICONS[t] ?? CalendarDays;
const dayLabel = (date: string) =>
  `${new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short" })} ${formatDate(date)}`;

/** One calendar entry: icon plus type in words, never colour alone. */
function CalendarEntry({
  item,
  onOpenEvent,
  variant,
}: {
  item: DeadlineItem;
  onOpenEvent: (eventId: string) => void;
  variant: "grid" | "agenda";
}) {
  const Icon = typeIcon(item.type);
  const label = typeLabel(item.type);
  const cls =
    variant === "grid"
      ? cn(
          "flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-xs leading-snug hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          DEADLINE_TYPE_STYLES[item.type] ?? DEADLINE_TYPE_STYLES.task_due,
        )
      : "flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

  const content =
    variant === "grid" ? (
      <>
        <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="sr-only">{label}: </span>
        <span className="truncate">{item.title}</span>
      </>
    ) : (
      <>
        <span
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            DEADLINE_TYPE_STYLES[item.type] ?? DEADLINE_TYPE_STYLES.task_due,
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs text-muted-foreground">{label}</span>
          <span className="block text-sm font-medium">{item.title}</span>
        </span>
      </>
    );

  if (item.type === "event" && item.eventId) {
    const eventId = item.eventId;
    return (
      <button
        type="button"
        className={cls}
        title={`${label}: ${item.title}`}
        onClick={(e) => {
          e.stopPropagation();
          onOpenEvent(eventId);
        }}
      >
        {content}
      </button>
    );
  }
  return (
    <Link
      to={item.to}
      className={cls}
      title={`${label}: ${item.title}`}
      onClick={(e) => e.stopPropagation()}
    >
      {content}
    </Link>
  );
}

// Shared by every department hub's Calendar tab; `departmentId` narrows it to that department.
export function DeadlineCalendarView({ departmentId }: { departmentId?: string } = {}) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [formTarget, setFormTarget] = useState<EventFormTarget | null>(null);
  const [openEventId, setOpenEventId] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first
  const daysInMonth = lastDay.getDate();
  const monthLabel = firstDay.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const from = toDateStr(firstDay);
  const to = toDateStr(lastDay);
  const deadlinesQ = useDeadlines(from, to, departmentId);
  const eventsQ = useCalendarEvents(from, to);
  const openEvent = eventsQ.data?.find((e) => e.id === openEventId) ?? null;

  const byDate = useMemo(() => {
    const map = new Map<string, DeadlineItem[]>();
    for (const d of deadlinesQ.data ?? []) {
      const list = map.get(d.date) ?? [];
      list.push(d);
      map.set(d.date, list);
    }
    return map;
  }, [deadlinesQ.data]);

  const todayStr = toDateStr(new Date());
  const newEventDate = todayStr >= from && todayStr <= to ? todayStr : from;

  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  const agendaDays = dates.filter((d) => byDate.has(d));

  const editEvent = (event: CalendarEvent) => {
    setOpenEventId(null);
    setFormTarget({ mode: "edit", event });
  };
  const newEventOn = (date: string) => setFormTarget({ mode: "create", date });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="w-36 text-center text-sm font-semibold" aria-live="polite">
            {monthLabel}
          </h2>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCursor(new Date(new Date().setDate(1)))}
          >
            This month
          </Button>
        </div>
        <Button size="sm" onClick={() => newEventOn(newEventDate)}>
          <Plus className="mr-1 h-4 w-4" /> New event
        </Button>
      </div>

      <ul className="flex flex-wrap items-center gap-1.5" aria-label="What the icons mean">
        {(Object.keys(DEADLINE_TYPE_LABELS) as DeadlineType[]).map((type) => {
          const Icon = typeIcon(type);
          return (
            <li
              key={type}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                DEADLINE_TYPE_STYLES[type],
              )}
            >
              <Icon className="h-3 w-3" aria-hidden="true" />
              {typeLabel(type)}
            </li>
          );
        })}
      </ul>

      {deadlinesQ.isError ? (
        <LoadError
          what="the calendar"
          error={deadlinesQ.error}
          onRetry={() => deadlinesQ.refetch()}
        />
      ) : deadlinesQ.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
            <div className="grid grid-cols-7 border-b bg-muted/30" aria-hidden="true">
              {DOW.map((d) => (
                <div
                  key={d}
                  className="px-2 py-1.5 text-center text-xs font-semibold text-muted-foreground"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: startOffset }, (_, i) => (
                <div key={`pad-${i}`} className="min-h-25 border-b border-r bg-muted/10" />
              ))}
              {dates.map((date, i) => {
                const items = byDate.get(date) ?? [];
                const isToday = date === todayStr;
                return (
                  <div
                    key={date}
                    onClick={() => newEventOn(date)}
                    className={cn(
                      "min-h-25 cursor-pointer space-y-1 overflow-y-auto border-b border-r p-1.5 hover:bg-muted/20",
                      isToday && "bg-primary/5",
                    )}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        newEventOn(date);
                      }}
                      aria-label={`New event on ${dayLabel(date)}${isToday ? " (today)" : ""}`}
                      className={cn(
                        "rounded px-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isToday && "bg-primary font-semibold text-primary-foreground",
                      )}
                    >
                      {i + 1}
                    </button>
                    {items.map((item, idx) => (
                      <CalendarEntry
                        key={`${item.type}-${idx}`}
                        item={item}
                        variant="grid"
                        onOpenEvent={setOpenEventId}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="md:hidden">
            {agendaDays.length === 0 ? (
              <div className="rounded-lg border bg-card px-4 py-10 text-center">
                <p className="text-sm font-medium">Nothing on the calendar in {monthLabel}</p>
                <Button size="sm" className="mt-3" onClick={() => newEventOn(newEventDate)}>
                  <Plus className="mr-1 h-4 w-4" /> New event
                </Button>
              </div>
            ) : (
              <ol className="space-y-3" aria-label={`Calendar for ${monthLabel}, day by day`}>
                {agendaDays.map((date) => {
                  const isToday = date === todayStr;
                  return (
                    <li
                      key={date}
                      className={cn("rounded-lg border bg-card", isToday && "border-primary")}
                    >
                      <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5">
                        <h3 className="text-sm font-semibold">
                          {dayLabel(date)}
                          {isToday && (
                            <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                              Today
                            </span>
                          )}
                        </h3>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          onClick={() => newEventOn(date)}
                          aria-label={`New event on ${dayLabel(date)}`}
                        >
                          <Plus className="mr-1 h-4 w-4" /> Add event
                        </Button>
                      </div>
                      <ul className="divide-y">
                        {(byDate.get(date) ?? []).map((item, idx) => (
                          <li key={`${item.type}-${idx}`}>
                            <CalendarEntry
                              item={item}
                              variant="agenda"
                              onOpenEvent={setOpenEventId}
                            />
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </>
      )}

      <EventDetailsDialog
        open={!!openEventId}
        event={openEvent}
        loading={eventsQ.isLoading}
        onClose={() => setOpenEventId(null)}
        onEdit={editEvent}
      />
      <EventFormDialog
        target={formTarget}
        departmentId={departmentId}
        onClose={() => setFormTarget(null)}
      />
    </div>
  );
}
