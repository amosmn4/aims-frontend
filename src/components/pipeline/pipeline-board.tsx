import { useState, type ReactNode } from "react";
import type { PipelineStageDef } from "@/features/pipeline/pipeline-theme";

interface PipelineBoardProps<T> {
  stages: PipelineStageDef[];
  items: T[];
  getStage: (item: T) => string;
  getId: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  onMove: (id: string, newStage: string) => void;
  /** When set, each column shows at most this many cards by default (oldest-first order is
   * preserved — `items` isn't re-sorted), with a "Show N more / Show all" control underneath to
   * reveal the rest. Omit to keep a column fully unbounded (e.g. a single project's task board,
   * which rarely has enough cards to need this). */
  defaultVisiblePerColumn?: number;
}

const COUNT_OPTIONS = [5, 10, 15, 25];

// Native HTML5 drag-and-drop, matching the prototype's own approach exactly (dragstart on the
// card, dragover/drop on the column) rather than pulling in a DnD library for this one module —
// the mechanics here are simple enough (single list, single axis) that the library wouldn't
// buy much.
export function PipelineBoard<T>({
  stages,
  items,
  getStage,
  getId,
  renderCard,
  onMove,
  defaultVisiblePerColumn,
}: PipelineBoardProps<T>) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  // Per-column visible-count override — "all" means unbounded for that one column. Keyed by
  // stage so expanding one column (e.g. after moving a card in) never affects the others.
  const [visibleByStage, setVisibleByStage] = useState<Record<string, number | "all">>({});

  return (
    <div className="board">
      {stages.map((s) => {
        const columnItems = items.filter((it) => getStage(it) === s.key);
        const visible = visibleByStage[s.key] ?? defaultVisiblePerColumn ?? "all";
        const shown = visible === "all" ? columnItems : columnItems.slice(0, visible);
        const hiddenCount = columnItems.length - shown.length;
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
                shown.map((it) => {
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
            {defaultVisiblePerColumn != null &&
              (columnItems.length > defaultVisiblePerColumn ||
                visible !== defaultVisiblePerColumn) && (
                <div className="flex items-center justify-between gap-1.5 px-1.5 pt-2 text-[11px]">
                  {hiddenCount > 0 ? (
                    <button
                      type="button"
                      className="underline hover:no-underline"
                      style={{ color: "var(--pipeline-slate)" }}
                      onClick={() => setVisibleByStage((cur) => ({ ...cur, [s.key]: "all" }))}
                    >
                      Show all ({columnItems.length})
                    </button>
                  ) : (
                    <span />
                  )}
                  <select
                    className="p-mono rounded-full bg-[var(--pipeline-paper-2)] px-2 py-1 text-[11px]"
                    style={{ color: "var(--pipeline-slate)" }}
                    value={visible === "all" ? "all" : String(visible)}
                    onChange={(e) =>
                      setVisibleByStage((cur) => ({
                        ...cur,
                        [s.key]: e.target.value === "all" ? "all" : Number(e.target.value),
                      }))
                    }
                  >
                    {COUNT_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        Show {n}
                      </option>
                    ))}
                    <option value="all">Show all</option>
                  </select>
                </div>
              )}
          </div>
        );
      })}
    </div>
  );
}
