import type {
  FigureSource,
  ReportFigure,
  ReportSection,
  ReportStatus,
  ReviewerKind,
} from "./use-reports";

const LOCALE = "en-KE";
const UTC: Intl.DateTimeFormatOptions = { timeZone: "UTC" };

const toNumber = (value: number | string | null | undefined): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Reads a figure for a person: "KES 4,120,000", "31%", "128". */
export function formatFigure(
  f: Pick<ReportFigure, "value" | "format"> & { unit?: string | null },
): string {
  if (f.value === null || f.value === undefined || f.value === "") return "—";
  if (typeof f.value === "string") return f.value;
  const n = f.value;
  switch (f.format) {
    case "money":
      return `${f.unit ?? "KES"} ${Math.round(n).toLocaleString(LOCALE)}`;
    case "percent":
      return `${round1(n)}%`;
    case "days":
      return `${Math.round(n)} day${Math.round(n) === 1 ? "" : "s"}`;
    case "hours":
      return `${Math.round(n)} hr${Math.round(n) === 1 ? "" : "s"}`;
    case "text":
      return String(n);
    default:
      return Math.round(n).toLocaleString(LOCALE);
  }
}

/** What AIMS worked out, before anyone corrected it. */
export function formatSystemValue(f: ReportFigure): string {
  return formatFigure({ value: f.systemValue ?? null, format: f.format, unit: f.unit });
}

/** True when a person changed a number AIMS worked out. */
export function isCorrected(f: ReportFigure): boolean {
  if (f.systemValue === null || f.systemValue === undefined) return false;
  return String(f.systemValue) !== String(f.value ?? "");
}

export interface FigureDelta {
  direction: "up" | "down" | "flat";
  /** "31%", "4" or "0.3pp". */
  text: string;
  /** Null when the period before was zero, so there is nothing to divide by. */
  percent: number | null;
}

/** How this figure moved against the same figure last period. */
export function figureDelta(f: ReportFigure): FigureDelta | null {
  const now = toNumber(f.value);
  const before = toNumber(f.previousValue);
  if (now === null || before === null) return null;
  const diff = now - before;
  const percent = before === 0 ? null : (diff / Math.abs(before)) * 100;
  if (diff === 0) return { direction: "flat", text: "no change", percent: 0 };
  const direction: FigureDelta["direction"] = diff > 0 ? "up" : "down";
  if (f.format === "percent") {
    return { direction, text: `${round1(Math.abs(diff))}pp`, percent };
  }
  if (percent !== null && Math.abs(before) >= 10) {
    return { direction, text: `${Math.round(Math.abs(percent))}%`, percent };
  }
  return {
    direction,
    text: formatFigure({ value: Math.abs(diff), format: f.format, unit: f.unit }),
    percent,
  };
}

/** A figure that moved more than a fifth is worth explaining. */
export function movedALot(f: ReportFigure): boolean {
  const delta = figureDelta(f);
  return !!delta && delta.percent !== null && Math.abs(delta.percent) > 20;
}

export const DELTA_TONE: Record<FigureDelta["direction"], string> = {
  up: "text-success",
  down: "text-destructive",
  flat: "text-muted-foreground",
};

export const DELTA_ARROW: Record<FigureDelta["direction"], string> = {
  up: "▲",
  down: "▼",
  flat: "–",
};

export const SOURCE_LABEL: Record<FigureSource, string> = {
  aims: "AIMS",
  typed: "Typed",
  ai: "AI drafted",
};

export const SOURCE_TONE: Record<FigureSource, string> = {
  aims: "bg-primary/10 text-primary",
  typed: "bg-secondary text-secondary-foreground",
  ai: "bg-warning/15 text-warning",
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  draft: "Not sent",
  submitted: "Waiting",
  changes_requested: "Needs changes",
  approved: "Approved",
};

export const REPORT_STATUS_TONE: Record<ReportStatus, string> = {
  draft: "bg-secondary text-secondary-foreground",
  submitted: "bg-primary/10 text-primary",
  changes_requested: "bg-warning/15 text-warning",
  approved: "bg-success/15 text-success",
};

/** "September 2026" for the month a date falls in. */
export function monthLabel(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { ...UTC, month: "long", year: "numeric" });
}

/** "September 2026", or "4 Sep 2026 – 19 Oct 2026" when it isn't a whole month. */
export function formatReportPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "";
  const wholeMonth =
    s.getUTCDate() === 1 &&
    s.getUTCFullYear() === e.getUTCFullYear() &&
    s.getUTCMonth() === e.getUTCMonth();
  if (wholeMonth) return monthLabel(start);
  const day = (d: Date) =>
    d.toLocaleDateString("en-GB", { ...UTC, day: "numeric", month: "short", year: "numeric" });
  return `${day(s)} – ${day(e)}`;
}

/** The month after this period, for "your next report is for October". */
export function nextMonthLabel(end: string | null | undefined): string {
  if (!end) return "";
  const d = new Date(end);
  if (Number.isNaN(d.getTime())) return "";
  return monthLabel(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString());
}

/** Who is expected to read and decide on this report. */
export function reviewerLabel(kind: ReviewerKind, departmentName?: string | null): string {
  if (kind === "ceo") return "The CEO";
  return departmentName ? `The head of ${departmentName}` : "Your head of department";
}

/** Drops the leading capital mid-sentence, leaving names like "IT" alone. */
export const lowerFirst = (text: string) => `${text.charAt(0).toLowerCase()}${text.slice(1)}`;

/** What the button that sends the report should say. */
export function sendLabel(
  status: ReportStatus,
  reviewerKind: ReviewerKind,
  departmentName?: string | null,
): string {
  if (status === "changes_requested") return "Update and send again";
  return `Send to ${lowerFirst(reviewerLabel(reviewerKind, departmentName))}`;
}

/** True when a section still has nothing in it. */
export function isSectionEmpty(section: ReportSection): boolean {
  if (section.type === "list" || section.type === "risks")
    return (section.items?.length ?? 0) === 0;
  if (section.type === "figures") return false;
  return !section.body || section.body.trim().length === 0;
}

/** The required sections nobody has filled in yet. */
export function missingSections(sections: ReportSection[]): string[] {
  return sections.filter((s) => s.required && isSectionEmpty(s)).map((s) => s.title);
}

/** A person's name, falling back to their email. */
export function personName(
  user: { fullName: string | null; email: string } | null | undefined,
  fallback = "Someone",
): string {
  return user?.fullName || user?.email || fallback;
}
