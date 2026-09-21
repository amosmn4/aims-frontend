import { useMemo } from "react";
import { useTickets, type TicketPriority, type TicketRow } from "@/features/it/use-tickets";
import type { AgingRow } from "@/components/aging-bars";

/** How quickly IT aims to pick a ticket up, by how urgent it is. */
export const RESPONSE_HOURS: Record<TicketPriority, number> = {
  urgent: 4,
  high: 24,
  medium: 72,
  low: 120,
};

export const RESPONSE_TARGET_TEXT: Record<TicketPriority, string> = {
  urgent: "within 4 hours",
  high: "within 1 day",
  medium: "within 3 days",
  low: "within 5 days",
};

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export const hoursWaiting = (ticket: TicketRow, now = Date.now()) =>
  (now - new Date(ticket.createdAt).getTime()) / HOUR;

/** Tickets past their pick-up time and still not started. */
export const isPastResponseTime = (ticket: TicketRow, now = Date.now()) =>
  ticket.status === "open" && hoursWaiting(ticket, now) > RESPONSE_HOURS[ticket.priority];

const startOfWeek = (d: Date) => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  return copy;
};

const weekLabel = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Everything the IT dashboard needs about tickets, worked out once. */
export function useTicketInsights() {
  const query = useTickets();

  const data = useMemo(() => {
    const tickets = query.data ?? [];
    const now = Date.now();
    const unfinished = tickets.filter((t) => t.status === "open" || t.status === "in_progress");

    const byPriority = new Map<TicketPriority, number>();
    for (const t of unfinished) byPriority.set(t.priority, (byPriority.get(t.priority) ?? 0) + 1);

    const breaching = unfinished
      .filter((t) => isPastResponseTime(t, now))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const ageBuckets: { label: string; tone: AgingRow["tone"]; max: number }[] = [
      { label: "Raised today", tone: "ok", max: 1 },
      { label: "1 to 2 days waiting", tone: "watch", max: 3 },
      { label: "3 to 7 days waiting", tone: "late", max: 8 },
      { label: "Over a week waiting", tone: "bad", max: Infinity },
    ];
    const counts = ageBuckets.map(() => 0);
    for (const t of unfinished) {
      const days = (now - new Date(t.createdAt).getTime()) / DAY;
      counts[ageBuckets.findIndex((b) => days < b.max)] += 1;
    }
    const ageRows: AgingRow[] = ageBuckets.map((b, i) => ({
      label: b.label,
      count: counts[i],
      tone: b.tone,
      to: "/it/tickets",
      search: { view: "list" },
    }));

    // Six weeks of raised against finished, so IT can see if it is keeping up.
    const thisWeek = startOfWeek(new Date());
    const flow = Array.from({ length: 6 }, (_, i) => {
      const from = new Date(thisWeek);
      from.setDate(from.getDate() - (5 - i) * 7);
      const to = new Date(from);
      to.setDate(to.getDate() + 7);
      const within = (iso: string | null) => {
        if (!iso) return false;
        const t = new Date(iso).getTime();
        return t >= from.getTime() && t < to.getTime();
      };
      return {
        week: weekLabel(from),
        raised: tickets.filter((t) => within(t.createdAt)).length,
        finished: tickets.filter((t) => within(t.resolvedAt ?? t.closedAt)).length,
      };
    });

    return {
      tickets,
      unfinished,
      byPriority,
      breaching,
      ageRows,
      flow,
      openCount: unfinished.filter((t) => t.status === "open").length,
      inProgressCount: unfinished.filter((t) => t.status === "in_progress").length,
    };
  }, [query.data]);

  return { query, ...data };
}
