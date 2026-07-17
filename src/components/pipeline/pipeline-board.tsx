import { useState, type ReactNode } from "react";
import type { PipelineStageDef } from "@/features/pipeline/pipeline-theme";

interface PipelineBoardProps<T> {
  stages: PipelineStageDef[];
  items: T[];
  getStage: (item: T) => string;
  getId: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  onMove: (id: string, newStage: string) => void;
}

// Native HTML5 drag-and-drop, matching the prototype's own approach exactly (dragstart on the
// card, dragover/drop on the column) rather than pulling in a DnD library for this one module —
// the mechanics here are simple enough (single list, single axis) that the library wouldn't
// buy much.
export function PipelineBoard<T>({ stages, items, getStage, getId, renderCard, onMove }: PipelineBoardProps<T>) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  return (
    <div className="board">
      {stages.map((s) => {
        const columnItems = items.filter((it) => getStage(it) === s.key);
        return (
          <div
            key={s.key}
            className={`column ${dragOverStage === s.key ? "dragover" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverStage(s.key);
            }}
            onDragLeave={() => setDragOverStage((cur) => (cur === s.key ? null : cur))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverStage(null);
              if (dragId) onMove(dragId, s.key);
              setDragId(null);
            }}
          >
            <div className="flex items-center justify-between px-1.5 pb-2.5 pt-1">
              <div className="flex items-center gap-1.5 text-[12.5px] font-semibold">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                {s.label}
              </div>
              <div
                className="p-mono rounded-full bg-[var(--pipeline-paper-2)] px-2 py-px text-[11px]"
                style={{ color: "var(--pipeline-slate)" }}
              >
                {columnItems.length}
              </div>
            </div>
            <div className="cardstack">
              {columnItems.length === 0 ? (
                <div className="empty-col">No cards</div>
              ) : (
                columnItems.map((it) => {
                  const id = getId(it);
                  return (
                    <div
                      key={id}
                      className={`p-card ${dragId === id ? "dragging" : ""}`}
                      draggable
                      onDragStart={() => setDragId(id)}
                      onDragEnd={() => setDragId(null)}
                    >
                      {renderCard(it)}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
