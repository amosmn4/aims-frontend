import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useDeadlines,
  DEADLINE_TYPE_LABELS,
  DEADLINE_TYPE_STYLES,
  type DeadlineItem,
} from "@/features/calendar/use-calendar";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar — AIMS" }] }),
  component: DeadlineCalendar,
});

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function DeadlineCalendar() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Deadline Calendar"
        description="Everything due, anywhere — tender submissions, bond expiries, contract renewals and task due dates, in one read-only view."
      />
      <DeadlineCalendarView />
    </div>
  );
}

// Exported so every department hub can embed this same calendar grid as a "Calendar" tab, scoped
// via the optional `departmentId` prop — the central `/calendar` route renders it unfiltered.
export function DeadlineCalendarView({ departmentId }: { departmentId?: string } = {}) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first
  const daysInMonth = lastDay.getDate();

  const from = toDateStr(firstDay);
  const to = toDateStr(lastDay);
  const deadlinesQ = useDeadlines(from, to, departmentId);

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

  const cells: { date: string | null; day: number | null }[] = [];
  for (let i = 0; i < startOffset; i++) cells.push({ date: null, day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      day: d,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-semibold w-40 text-center">
            {firstDay.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </div>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCursor(new Date(new Date().setDate(1)))}
          >
            Today
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(DEADLINE_TYPE_LABELS).map(([type, label]) => (
            <Badge
              key={type}
              variant="secondary"
              className={DEADLINE_TYPE_STYLES[type as keyof typeof DEADLINE_TYPE_LABELS]}
            >
              {label}
            </Badge>
          ))}
        </div>
      </div>

      {deadlinesQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="grid grid-cols-7 border-b bg-muted/30">
            {DOW.map((d) => (
              <div
                key={d}
                className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground text-center"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => {
              if (!cell.date)
                return (
                  <div key={`pad-${i}`} className="min-h-[100px] border-b border-r bg-muted/10" />
                );
              const items = byDate.get(cell.date) ?? [];
              const isToday = cell.date === todayStr;
              return (
                <div
                  key={cell.date}
                  className={cn(
                    "min-h-[100px] border-b border-r p-1.5 space-y-1 overflow-y-auto",
                    isToday && "bg-primary/5",
                  )}
                >
                  <div
                    className={cn("text-xs font-medium", isToday && "text-primary font-semibold")}
                  >
                    {cell.day}
                  </div>
                  {items.map((item, idx) => (
                    <Link
                      key={idx}
                      to={item.to}
                      className={cn(
                        "block rounded px-1.5 py-0.5 text-[10px] leading-snug truncate hover:opacity-80",
                        DEADLINE_TYPE_STYLES[item.type],
                      )}
                      title={item.title}
                    >
                      {item.title}
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
