import CheckOutlined from "@mui/icons-material/CheckOutlined";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import ScheduleOutlined from "@mui/icons-material/ScheduleOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import BlockOutlined from "@mui/icons-material/BlockOutlined";
import PersonAddAltOutlined from "@mui/icons-material/PersonAddAltOutlined";
import HourglassEmptyOutlined from "@mui/icons-material/HourglassEmptyOutlined";
import AutorenewOutlined from "@mui/icons-material/AutorenewOutlined";
import { deliverableStatuses, taskStatusKey } from "@/lib/task-content";
import { cn } from "@/lib/utils";

const icons = {
  pending: HourglassEmptyOutlined,
  in_progress: AutorenewOutlined,
  completed: CheckOutlined,
  forwarded: ArrowForwardOutlined,
  postponed: ScheduleOutlined,
  cancelled: CloseOutlined,
  blocked: BlockOutlined,
  delegated: PersonAddAltOutlined,
};

export function TaskStatusBadge({ status, className }: { status: string; className?: string }) {
  const key = taskStatusKey(status);
  const Icon = icons[key];
  const label =
    key === "completed" ? "Done" : key === "pending" ? "Pending" : deliverableStatuses[key];
  return (
    <span
      className={cn("task-status-badge", className)}
      data-task-status={key}
      contentEditable={false}
    >
      <Icon fontSize="inherit" />
      {status === "planned" ? "Planned" : label}
    </span>
  );
}
