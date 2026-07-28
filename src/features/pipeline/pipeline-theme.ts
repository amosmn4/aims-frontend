// Color/type tokens lifted directly from the AMSOL Pipeline prototype (amsol_pipeline.html)
// so the three boards, spine and cards read as one visual system rather than three
// differently-styled screens bolted together. Department colors are re-mapped onto AIMS's
// actual 5 departments (kept as-is per the reconciliation decision — no "Compliance & Legal"
// department exists here) instead of the prototype's own 6-department demo taxonomy.

export const PIPELINE_INK = "#16233F";
export const PIPELINE_INK_2 = "#1F3157";
export const PIPELINE_PAPER = "#F1F2EC";
export const PIPELINE_PAPER_2 = "#FFFFFF";
export const PIPELINE_LINE = "#DBDED2";
export const PIPELINE_LINE_SOFT = "#E8E9E2";
export const PIPELINE_SLATE = "#5B6470";
export const PIPELINE_SLATE_LIGHT = "#8B93A0";
export const PIPELINE_GOLD = "#B4802A";
export const PIPELINE_GOLD_SOFT = "#F3E4C6";
export const PIPELINE_TEAL = "#2F6F62";
export const PIPELINE_TEAL_SOFT = "#DCEAE5";
export const PIPELINE_CORAL = "#AE4A3C";
export const PIPELINE_CORAL_SOFT = "#F5DEDA";
export const PIPELINE_BLUE = "#375D8A";
export const PIPELINE_BLUE_SOFT = "#DCE5F0";
export const PIPELINE_PURPLE = "#6B5490";
export const PIPELINE_PURPLE_SOFT = "#E6E0EF";

// Department code -> chip color, reusing the prototype's department palette (bd/hr/payroll/
// ops/it) mapped onto this system's real department codes.
export const DEPT_COLORS: Record<string, { text: string; bg: string }> = {
  tender: { text: "#8C5F1D", bg: PIPELINE_GOLD_SOFT },
  hr: { text: PIPELINE_TEAL, bg: PIPELINE_TEAL_SOFT },
  finance: { text: PIPELINE_BLUE, bg: PIPELINE_BLUE_SOFT },
  marketing: { text: PIPELINE_PURPLE, bg: PIPELINE_PURPLE_SOFT },
  it: { text: "#2E7A6B", bg: "#DBEFE9" },
};
export const DEPT_COLOR_FALLBACK = { text: PIPELINE_SLATE, bg: PIPELINE_LINE_SOFT };

export function deptColor(code: string | null | undefined) {
  return (code && DEPT_COLORS[code]) || DEPT_COLOR_FALLBACK;
}

export interface PipelineStageDef {
  key: string;
  label: string;
  color: string;
}

export const TENDER_PIPELINE_STAGES: PipelineStageDef[] = [
  { key: "identified", label: "Identified", color: PIPELINE_SLATE_LIGHT },
  { key: "applying", label: "Preparing Application", color: PIPELINE_GOLD },
  { key: "submitted", label: "Submitted", color: PIPELINE_BLUE },
  { key: "evaluation", label: "Under Evaluation", color: PIPELINE_PURPLE },
  { key: "won", label: "Awarded", color: PIPELINE_TEAL },
  { key: "lost", label: "Not Awarded", color: PIPELINE_CORAL },
  { key: "withdrawn", label: "Withdrawn", color: PIPELINE_SLATE },
];

export const ENGAGEMENT_PIPELINE_STAGES: PipelineStageDef[] = [
  { key: "new", label: "New Request", color: PIPELINE_SLATE_LIGHT },
  { key: "assigned", label: "Assigned to Dept", color: PIPELINE_GOLD },
  { key: "engaging", label: "Engagement", color: PIPELINE_BLUE },
  { key: "proposal", label: "Proposal Sent", color: PIPELINE_PURPLE },
  { key: "won", label: "Won", color: PIPELINE_TEAL },
  { key: "lost", label: "Lost", color: PIPELINE_CORAL },
  { key: "withdrawn", label: "Withdrawn", color: PIPELINE_SLATE },
];

export const PROJECT_PIPELINE_STAGES: PipelineStageDef[] = [
  { key: "onboarding", label: "Onboarding & Contract", color: PIPELINE_SLATE_LIGHT },
  { key: "in_progress", label: "In Progress", color: PIPELINE_GOLD },
  { key: "delivery", label: "Delivery / QA", color: PIPELINE_BLUE },
  { key: "invoicing", label: "Invoicing", color: PIPELINE_PURPLE },
  { key: "payment", label: "Payment Collection", color: PIPELINE_TEAL },
  { key: "closed", label: "Closed", color: PIPELINE_SLATE },
];

export const ACTIVITY_ICON: Record<string, string> = {
  meeting: "\u{1F4C5}",
  email: "✉️",
  note: "\u{1F4DD}",
  call: "\u{1F4DE}",
  visit: "\u{1F4CD}",
};

export const ACTIVITY_COLOR: Record<string, string> = {
  meeting: PIPELINE_BLUE_SOFT,
  email: PIPELINE_TEAL_SOFT,
  note: PIPELINE_PAPER,
  call: PIPELINE_PURPLE_SOFT,
  visit: PIPELINE_GOLD_SOFT,
};

export function initials(name: string | null | undefined): string {
  if (!name || name === "—") return "—";
  return name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
