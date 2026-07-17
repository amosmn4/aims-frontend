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
  TASK_PRIORITY_STYLES,
  type Task,
  type TaskStatus,
} from "@/features/projects/use-projects";
import { Loader2 } from "lucide-react";

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
}: {
  task: Task;
  showProject?: boolean;
  onTaskClick?: (task: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onTaskClick?.(task)}
      className={`rounded-md border bg-card p-2.5 text-xs cursor-grab active:cursor-grabbing shadow-sm hover:shadow ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="font-medium text-foreground">{task.title}</div>
      {showProject && task.project_name && (
        <div className="mt-1 text-[0.625rem] text-muted-foreground">{task.project_name}</div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span
          className={`px-1.5 py-0.5 rounded text-[0.5625rem] uppercase font-semibold ${TASK_PRIORITY_STYLES[task.priority]}`}
        >
          {task.priority}
        </span>
        {task.due_date && (
          <span className="text-[0.625rem] text-muted-foreground">{task.due_date}</span>
        )}
      </div>
    </div>
  );
}

function Column({
  status,
  tasks,
  showProject,
  onTaskClick,
}: {
  status: TaskStatus;
  tasks: Task[];
  showProject?: boolean;
  onTaskClick?: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[220px] rounded-lg border-t-4 bg-secondary/30 p-2 ${COLUMN_ACCENTS[status]} ${isOver ? "ring-2 ring-primary/40" : ""}`}
    >
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="text-xs font-semibold">{TASK_STATUS_LABELS[status]}</div>
        <div className="text-[0.625rem] text-muted-foreground">{tasks.length}</div>
      </div>
      <div className="space-y-2 min-h-[60px]">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} showProject={showProject} onTaskClick={onTaskClick} />
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
}: {
  tasks: Task[];
  loading?: boolean;
  showProject?: boolean;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onTaskClick?: (task: Task) => void;
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
    if (task && task.status !== newStatus) {
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
          />
        ))}
      </div>
    </DndContext>
  );
}
