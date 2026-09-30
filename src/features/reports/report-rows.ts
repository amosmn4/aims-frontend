import type { ReportFigure } from "./use-reports";

/** Small readers the report list screens share. */

/** One page shows every kind of report. */
export const reportPath = (id: string): string => `/reports/${id}`;

/** Your own report for the current period. */
export const MY_REPORT_PATH: string = "/reports/mine";

/** "August" — the month a report covers. */
export const monthOf = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { timeZone: "UTC", month: "long" });

/** "6 September", for dates people read inside a sentence. */
export const dayOf = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : "";

export const samePeriod = (a: string | undefined, b: string | undefined) =>
  !!a && !!b && a.slice(0, 10) === b.slice(0, 10);

interface RawSection {
  id?: string;
  type?: string;
  body?: string | null;
}

/**
 * The one thing the reviewer has to act on, in the writer's own words.
 * Taken from what they wrote, never worked out from anything else.
 */
export function actionNeeded(row: unknown): string | null {
  const raw = (row as { sections?: unknown } | null | undefined)?.sections;
  const sections: RawSection[] = Array.isArray(raw) ? raw : [];
  const bodyOf = (match: (s: RawSection) => boolean) =>
    sections.find((s) => !!s && typeof s === "object" && match(s))?.body?.trim();
  const body =
    bodyOf((s) => s.id === "decisions") ||
    bodyOf((s) => s.id === "blocked") ||
    bodyOf((s) => s.type === "decisions");
  if (!body) return null;
  return (
    body
      .split("\n")
      .find((line) => line.trim())
      ?.trim() ?? null
  );
}

/** The first figure worth putting on a one-line summary. */
export const headlineFigure = (row: { figures?: ReportFigure[] }): ReportFigure | null =>
  (row.figures ?? []).find((f) => f.value !== null && f.value !== undefined && f.value !== "") ??
  null;

/** The newest report about each subject, by the period it covers. */
export function latestBySubject<T extends { subjectId: string; periodStart: string }>(
  rows: T[],
): Map<string, T> {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const held = latest.get(row.subjectId);
    if (!held || row.periodStart > held.periodStart) latest.set(row.subjectId, row);
  }
  return latest;
}

export const startFailure = (error: unknown) =>
  error instanceof Error && error.message ? error.message : "Couldn't start that report.";
