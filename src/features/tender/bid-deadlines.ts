import type { TenderRow } from "@/features/tender/use-tender";

/** Stages where the bid still has to go in. */
const STILL_TO_SUBMIT = new Set(["identified", "applying"]);

/** Days left until the closing date; negative once it has passed. */
export const daysToDeadline = (deadline: string) =>
  Math.round(
    (new Date(`${deadline}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000,
  );

/** Bids still to go in, soonest deadline first. */
export function tendersStillToSubmit(tenders: TenderRow[]) {
  return tenders
    .filter((t) => STILL_TO_SUBMIT.has(t.stage) && t.submission_deadline)
    .sort((a, b) => (a.submission_deadline ?? "").localeCompare(b.submission_deadline ?? ""));
}
