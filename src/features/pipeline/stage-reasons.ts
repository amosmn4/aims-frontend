import { promptDialog } from "@/components/prompt-dialog";

/** Asks why a request or tender didn't go ahead. Resolves null when cancelled. */
export function askLossReason(thing: "request" | "tender", stageLabel: string) {
  return promptDialog({
    title: `Mark this ${thing} as ${stageLabel.toLowerCase()}`,
    description: "This reason shows on the record and in reports on why work is lost.",
    label: "Why didn't it go ahead?",
    placeholder: "e.g. Client chose a cheaper provider",
    inputType: "textarea",
    confirmLabel: `Mark as ${stageLabel.toLowerCase()}`,
    required: true,
  });
}

/** Asks what won the bid; an empty answer is allowed. Resolves null when cancelled. */
export function askWinReason() {
  return promptDialog({
    title: "Tender awarded",
    description: "Optional — note what made this bid succeed so the team can repeat it.",
    label: "Why did we win?",
    placeholder: "e.g. Strongest local references and best price",
    inputType: "textarea",
    confirmLabel: "Mark as awarded",
  });
}

export const isLossStage = (stage: string) => ["lost", "withdrawn", "cancelled"].includes(stage);
