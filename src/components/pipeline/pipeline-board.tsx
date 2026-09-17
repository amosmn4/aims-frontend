import { useState, type KeyboardEvent, type ReactNode, type SyntheticEvent } from "react";
import type { PipelineStageDef } from "@/features/pipeline/pipeline-theme";

interface PipelineBoardProps<T> {
  stages: PipelineStageDef[];
  items: T[];
  getStage: (item: T) => string;
  getId: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  onMove: (id: string, newStage: string) => void;
  /** Whether this person may move the card to another column; defaults to true. */
  canDrag?: (item: T) => boolean;
  /** When set, each column shows at most this many cards, with a "Show all" control. */
  defaultVisiblePerColumn?: number;
  /** Opens a card; makes every card a keyboard-reachable button (Enter or Space). */
  onOpen?: (item: T) => void;
  /** Plain name of a card for screen readers and the "Move to…" label, e.g. its title. */
  getLabel?: (item: T) => string;
  /** Stages offered in a card's "Move to…" select; defaults to every stage. */
  moveTargets?: (item: T) => PipelineStageDef[];
  /** Hides the per-card "Move to…" select (it's shown to people who can move the card). */
  hideMoveControl?: boolean;
}

const COUNT_OPTIONS = [5, 10, 15, 25];

const stop = (e: SyntheticEvent) => e.stopPropagation();

// Native drag-and-drop, plus a "Move to…" select on each card so moving never needs a mouse.
export function PipelineBoard<T>({
  stages,
  items,
  getStage,
  getId,
  renderCard,
  onMove,
  canDrag,
  defaultVisiblePerColumn,
  onOpen,
  getLabel,
  moveTargets,
  hideMoveControl,
}: PipelineBoardProps<T>) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  // Per-column visible count; "all" means unbounded for that column only.
  const [visibleByStage, setVisibleByStage] = useState<Record<string, number | "all">>({});

  return (
    <div className="board">
      {stages.map((s) => {
        const columnItems = items.filter((it) => getStage(it) === s.key);
        const visible = visibleByStage[s.key] ?? defaultVisiblePerColumn ?? "all";
        const shown = visible === "all" ? columnItems : columnItems.slice(0, visible);
        const hiddenCount = columnItems.length - shown.length;
        return (
          <section
            key={s.key}
            aria-label={`${s.label}: ${columnItems.length}`}
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
              <h2 className="flex items-center gap-1.5 text-[13px] font-semibold">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: s.color }}
                  aria-hidden="true"
                />
                {s.label}
              </h2>
              <div
                className="p-mono rounded-full bg-[var(--pipeline-paper-2)] px-2 py-px text-xs"
                style={{ color: "var(--pipeline-slate)" }}
                aria-hidden="true"
              >
                {columnItems.length}
              </div>
            </div>
            <div className="cardstack">
              {columnItems.length === 0 ? (
                <div className="empty-col" style={{ fontSize: 12 }}>
                  Nothing here
                </div>
              ) : (
                shown.map((it) => {
                  const id = getId(it);
                  const movable = canDrag ? canDrag(it) : true;
                  const label = getLabel?.(it) ?? "this card";
                  const targets = (moveTargets ? moveTargets(it) : stages).filter(
                    (t) => t.key !== s.key,
                  );
                  return (
                    <div
                      key={id}
                      className={`p-card ${dragId === id ? "dragging" : ""}`}
                      style={movable ? undefined : { cursor: onOpen ? "pointer" : "default" }}
                      draggable={movable}
                      onDragStart={() => movable && setDragId(id)}
                      onDragEnd={() => setDragId(null)}
                      {...(onOpen && {
                        role: "button",
                        tabIndex: 0,
                        "aria-label": `Open ${label}`,
                        onClick: () => onOpen(it),
                        onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onOpen(it);
                          }
                        },
                      })}
                    >
                      {renderCard(it)}
                      {movable && !hideMoveControl && targets.length > 0 && (
                        <div
                          className="mt-2.5 border-t pt-2"
                          style={{ borderColor: "var(--pipeline-line-soft, #E8E9E2)" }}
                          onClick={stop}
                          onKeyDown={stop}
                          onMouseDown={stop}
                        >
                          <select
                            aria-label={`Move ${label} to another stage`}
                            value=""
                            draggable={false}
                            onDragStart={(e) => e.preventDefault()}
                            onChange={(e) => {
                              if (e.target.value) onMove(id, e.target.value);
                            }}
                            className="w-full cursor-pointer rounded-md border bg-white px-2 py-1.5 text-xs"
                            style={{
                              borderColor: "var(--pipeline-line, #DBDED2)",
                              color: "var(--pipeline-slate, #5B6470)",
                            }}
                          >
                            <option value="">Move to…</option>
                            {targets.map((t) => (
                              <option key={t.key} value={t.key}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            {defaultVisiblePerColumn != null &&
              (columnItems.length > defaultVisiblePerColumn ||
                visible !== defaultVisiblePerColumn) && (
                <div className="flex items-center justify-between gap-1.5 px-1.5 pt-2 text-xs">
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
                    aria-label={`How many ${s.label} cards to show`}
                    className="p-mono rounded-full bg-[var(--pipeline-paper-2)] px-2 py-1 text-xs"
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
          </section>
        );
      })}
    </div>
  );
}
