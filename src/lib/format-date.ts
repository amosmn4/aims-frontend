// One date style across AIMS: "15 Sep 2026", "15 Sep 2026, 09:42", or "Today, 09:42".
const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
const TIME: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
const DAY_SHORT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

const toDate = (value: string | Date | null | undefined) => {
  if (!value) return null;
  const d =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00`)
      : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "15 Sep 2026", or the fallback when there's no date. */
export function formatDate(value: string | Date | null | undefined, fallback = "—") {
  const d = toDate(value);
  return d ? d.toLocaleDateString("en-GB", DAY) : fallback;
}

/** "15 Sep 2026, 09:42". */
export function formatDateTime(value: string | Date | null | undefined, fallback = "—") {
  const d = toDate(value);
  return d
    ? `${d.toLocaleDateString("en-GB", DAY)}, ${d.toLocaleTimeString("en-GB", TIME)}`
    : fallback;
}

/** "Sep 2026", from "2026-09", a date string or a Date. */
export function formatMonth(value: string | Date | null | undefined, fallback = "—") {
  const key = typeof value === "string" ? /^(\d{4})-(\d{2})$/.exec(value) : null;
  const d = key ? new Date(Number(key[1]), Number(key[2]) - 1, 1) : toDate(value);
  return d ? d.toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : fallback;
}

/** "15–21 Sep" for the week starting on this date; "29 Sep – 5 Oct" across months. */
export function formatWeekRange(value: string | Date | null | undefined, fallback = "—") {
  const start = toDate(value);
  if (!start) return fallback;
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const from = start.toLocaleDateString("en-GB", sameMonth ? { day: "numeric" } : DAY_SHORT);
  const to = end.toLocaleDateString("en-GB", DAY_SHORT);
  const year = start.getFullYear() === new Date().getFullYear() ? "" : ` ${start.getFullYear()}`;
  return `${from}${sameMonth ? "–" : " – "}${to}${year}`;
}

/** "Today, 09:42", "Yesterday, 17:40", "3 days ago", or "12 Aug 2026". */
export function formatRelative(value: string | Date | null | undefined, fallback = "—") {
  const d = toDate(value);
  if (!d) return fallback;
  const days = Math.floor(
    (new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 864e5,
  );
  const time = d.toLocaleTimeString("en-GB", TIME);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  if (days > 1 && days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-GB", DAY);
}
