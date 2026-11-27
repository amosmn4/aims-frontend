import { useState } from "react";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import ScheduleOutlined from "@mui/icons-material/ScheduleOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import BlockOutlined from "@mui/icons-material/BlockOutlined";
import PersonAddAltOutlined from "@mui/icons-material/PersonAddAltOutlined";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { deliverableDates, type DeliverableStatus } from "@/lib/task-content";

const actions = [
  { status: "completed", label: "Done", Icon: CheckOutlined },
  { status: "forwarded", label: "Forward", Icon: ArrowForwardOutlined },
  { status: "postponed", label: "Postpone", Icon: ScheduleOutlined },
  { status: "cancelled", label: "Cancelled", Icon: CloseOutlined },
  { status: "blocked", label: "Blocked", Icon: BlockOutlined },
] as const;

export function DeliverableControls({
  title,
  status,
  targetDate,
  week,
  disabled = false,
  onChange,
  onDelegate,
}: {
  title: string;
  status: DeliverableStatus;
  targetDate?: string | null | undefined;
  week?: string | null | undefined;
  disabled?: boolean;
  onChange?: ((status: DeliverableStatus, date?: string) => void) | undefined;
  onDelegate?: (() => void) | undefined;
}) {
  const [postponing, setPostponing] = useState(false);
  const dates = deliverableDates(week);
  const [date, setDate] = useState(targetDate ?? dates.forward);
  const editable = !!onChange && !disabled;
  const dateValid =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    date >= dates.min &&
    date <= dates.max &&
    !Number.isNaN(Date.parse(`${date}T12:00:00Z`));
  return (
    <>
      <span
        className="deliverable-actions"
        data-task-status={status}
        contentEditable={false}
        role="group"
        aria-label={`Outcome for ${title}`}
      >
        {actions
          .filter(
            (action) =>
              editable ||
              action.status === status ||
              (status === "pending" && action.status === "completed"),
          )
          .map(({ status: choice, label, Icon }) => (
            <label
              key={choice}
              className="deliverable-action"
              title={label}
              data-selected={status === choice}
            >
              <input
                type="checkbox"
                aria-label={choice === "completed" ? title : `${label}: ${title}`}
                checked={status === choice}
                disabled={!editable || status === "delegated"}
                onChange={() => {
                  if (status === choice) {
                    onChange?.("pending");
                    return;
                  }
                  if (choice === "postponed") {
                    setDate(targetDate ?? dates.forward);
                    setPostponing(true);
                    return;
                  }
                  onChange?.(choice, choice === "forwarded" ? dates.forward : undefined);
                }}
              />
              <Icon fontSize="inherit" />
            </label>
          ))}
        {(onDelegate || status === "delegated") && (
          <button
            type="button"
            className="deliverable-action"
            data-selected={status === "delegated"}
            title="Delegate"
            aria-label={`Delegate: ${title}`}
            disabled={
              !onDelegate ||
              disabled ||
              ["completed", "cancelled", "forwarded", "postponed", "delegated"].includes(status)
            }
            onClick={onDelegate}
          >
            <PersonAddAltOutlined fontSize="inherit" />
          </button>
        )}
        {targetDate && (status === "forwarded" || status === "postponed") && (
          <span className="deliverable-date">{targetDate}</span>
        )}
      </span>
      <Dialog open={postponing} onOpenChange={setPostponing}>
        <DialogContent onKeyDown={(event) => event.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Postpone deliverable</DialogTitle>
            <DialogDescription>
              Choose when to plan {title}. Other deliverables keep their current outcomes.
            </DialogDescription>
          </DialogHeader>
          <label className="field-label">
            New due date
            <input
              type="date"
              className="field-input"
              value={date}
              min={dates.min}
              max={dates.max}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPostponing(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!dateValid}
              onClick={() => {
                onChange?.("postponed", date);
                setPostponing(false);
              }}
            >
              Postpone deliverable
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
