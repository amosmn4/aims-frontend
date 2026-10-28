import {
  DndContext,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  PointerSensor,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  TASK_STATUS_COLUMNS,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_STYLES,
  type Task,
  type TaskStatus,
} from "@/features/projects/use-projects";
import { Loader2 } from "lucide-react";
import { formatDate } from "@/lib/format-date";

const COLUMN_ACCENTS: Record<TaskStatus, string> = {
  not_started: "border-t-muted-foreground/40",
  in_progress: "border-t-primary",
  review: "border-t-accent",
  blocked: "border-t-destructive",
  completed: "border-t-success",
};

function TaskCard({
  task,
  showProject,
  onTaskClick,
  onStatusChange,
  movable,
}: {
  task: Task;
  showProject?: boolean;
  onTaskClick?: (task: Task) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  movable: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !movable,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : undefined;
  const overdue =
    !!task.due_date &&
    task.status !== "completed" &&
    new Date(`${task.due_date.slice(0, 10)}T23:59:59`) < new Date();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      aria-label={`Open task ${task.title}`}
      onClick={() => onTaskClick?.(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTaskClick?.(task);
        }
      }}
      className={`rounded-md border bg-card p-2.5 text-xs shadow-sm hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${movable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="font-medium text-foreground">{task.title}</div>
      {showProject && task.project_name && (
        <div className="mt-1 text-xs text-muted-foreground">{task.project_name}</div>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-semibold ${TASK_PRIORITY_STYLES[task.priority]}`}
        >
          {TASK_PRIORITY_LABELS[task.priority]} priority
        </span>
        {task.due_date && (
          <span
            className={`text-xs ${overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}
          >
            {overdue ? "Overdue · " : "Due "}
            {formatDate(task.due_date)}
          </span>
        )}
      </div>
      {movable && (
        <select
          aria-label={`Move ${task.title} to`}
          className="mt-2 h-7 w-full rounded border bg-background px-1.5 text-xs"
          value={task.status}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
        >
          {TASK_STATUS_COLUMNS.map((st) => (
            <option key={st} value={st}>
              {st === task.status ? TASK_STATUS_LABELS[st] : `Move to ${TASK_STATUS_LABELS[st]}`}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function Column({
  status,
  tasks,
  showProject,
  onTaskClick,
  onStatusChange,
  canMove,
}: {
  status: TaskStatus;
  tasks: Task[];
  showProject?: boolean;
  onTaskClick?: (task: Task) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  canMove: (task: Task) => boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[220px] rounded-lg border-t-4 bg-secondary/30 p-2 ${COLUMN_ACCENTS[status]} ${isOver ? "ring-2 ring-primary/40" : ""}`}
    >
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="text-xs font-semibold">{TASK_STATUS_LABELS[status]}</div>
        <div className="text-xs text-muted-foreground">{tasks.length}</div>
      </div>
      <div className="space-y-2 min-h-[60px]">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            showProject={showProject}
            onTaskClick={onTaskClick}
            onStatusChange={onStatusChange}
            movable={canMove(t)}
          />
        ))}
      </div>
    </div>
  );
}

export function KanbanBoard({
  tasks,
  loading,
  showProject,
  onStatusChange,
  onTaskClick,
  canMove = () => true,
}: {
  tasks: Task[];
  loading?: boolean;
  showProject?: boolean;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onTaskClick?: (task: Task) => void;
  /** Who may move each card; others can still open it. */
  canMove?: (task: Task) => boolean;
}) {
  // Require a small pointer-move before a drag activates, so a plain click on a card
  // (which dnd-kit would otherwise treat as an immediate drag-start and swallow) still
  // fires onTaskClick normally.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const newStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === active.id);
    if (task && task.status !== newStatus && canMove(task)) {
      onStatusChange(task.id, newStatus);
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {TASK_STATUS_COLUMNS.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={tasks.filter((t) => t.status === status)}
            showProject={showProject}
            onTaskClick={onTaskClick}
            onStatusChange={onStatusChange}
            canMove={canMove}
          />
        ))}
      </div>
    </DndContext>
  );
}
