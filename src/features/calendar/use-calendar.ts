import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileText,
  Flag,
  GraduationCap,
  RefreshCw,
  ShieldAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { apiJson } from "@/lib/api-client";

export type DeadlineType =
  | "tender_submission"
  | "bond_expiry"
  | "contract_renewal"
  | "task_due"
  | "event"
  | "milestone"
  | "payroll_filing"
  | "report_due"
  | "training";

export const DEADLINE_TYPE_LABELS: Record<DeadlineType, string> = {
  event: "Event",
  tender_submission: "Tender submission",
  bond_expiry: "Bond expiry",
  contract_renewal: "Contract renewal",
  task_due: "Task due",
  milestone: "Milestone",
  payroll_filing: "Payroll filing",
  report_due: "Report due",
  training: "Training",
};

export const DEADLINE_TYPE_STYLES: Record<DeadlineType, string> = {
  event: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  tender_submission: "bg-primary/15 text-primary",
  bond_expiry: "bg-warning/15 text-warning",
  contract_renewal: "bg-accent/15 text-accent",
  task_due: "bg-secondary text-secondary-foreground",
  milestone: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  payroll_filing: "bg-destructive/15 text-destructive",
  report_due: "bg-success/15 text-success",
  training: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
};

/** An icon per type, so colour is never the only way to tell items apart. */
export const DEADLINE_TYPE_ICONS: Record<DeadlineType, LucideIcon> = {
  event: CalendarDays,
  tender_submission: FileText,
  bond_expiry: ShieldAlert,
  contract_renewal: RefreshCw,
  task_due: CheckSquare,
  milestone: Flag,
  payroll_filing: Wallet,
  report_due: ClipboardList,
  training: GraduationCap,
};

export interface DeadlineItem {
  date: string;
  type: DeadlineType;
  title: string;
  to: string;
  eventId?: string;
}

// `to` is a date (YYYY-MM-DD); send the end of that day so the whole day is included.
const endOfDay = (to: string) => `${to}T23:59:59.999Z`;

export function useDeadlines(from: string, to: string, departmentId?: string) {
  return useQuery({
    queryKey: ["calendar", "deadlines", from, to, departmentId ?? "all"],
    queryFn: () =>
      apiJson<DeadlineItem[]>(
        `/calendar/deadlines?from=${from}&to=${endOfDay(to)}${departmentId ? `&departmentId=${departmentId}` : ""}`,
      ),
  });
}

/* ---------- Calendar events ---------- */

export type EventVisibility = "everyone" | "department" | "private";

export const EVENT_VISIBILITY_LABELS: Record<EventVisibility, string> = {
  everyone: "Everyone in the company",
  department: "My department",
  private: "Only me",
};

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  departmentId: string | null;
  visibility: EventVisibility;
  createdBy: string;
  department: { id: string; name: string; code: string } | null;
  creator: { id: string; fullName: string | null; email: string };
  canEdit: boolean;
}

export interface CalendarEventInput {
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  departmentId: string | null;
  visibility: EventVisibility;
}

export function useCalendarEvents(from: string, to: string) {
  return useQuery({
    queryKey: ["calendar", "events", from, to],
    queryFn: () => apiJson<CalendarEvent[]>(`/calendar/events?from=${from}&to=${endOfDay(to)}`),
  });
}

export function useSaveCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: CalendarEventInput & { id?: string }) =>
      apiJson<CalendarEvent>(id ? `/calendar/events/${id}` : "/calendar/events", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar"] }),
  });
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/calendar/events/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar"] }),
  });
}

/* ---------- Date helpers ---------- */

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toTimeStr(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// All-day events are stored at UTC midnight so the server files them under the right day.
export function allDayIso(date: string) {
  return `${date}T00:00:00.000Z`;
}

export function localIso(date: string, time: string) {
  return new Date(`${date}T${time}`).toISOString();
}

export function formatEventWhen(e: CalendarEvent) {
  const dateOpts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  if (e.allDay) {
    const fmt = (iso: string) =>
      new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", dateOpts);
    const start = fmt(e.startsAt);
    const end =
      e.endsAt && e.endsAt.slice(0, 10) !== e.startsAt.slice(0, 10) ? fmt(e.endsAt) : null;
    return end ? `${start} – ${end} · All day` : `${start} · All day`;
  }
  const s = new Date(e.startsAt);
  const time = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const start = `${s.toLocaleDateString("en-GB", dateOpts)}, ${time(s)}`;
  if (!e.endsAt) return start;
  const en = new Date(e.endsAt);
  return toDateStr(en) === toDateStr(s)
    ? `${start} – ${time(en)}`
    : `${start} – ${en.toLocaleDateString("en-GB", dateOpts)}, ${time(en)}`;
}
