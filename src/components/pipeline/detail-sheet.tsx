import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

type DetailTab = "overview" | "activity" | "docs";

interface DetailSheetProps {
  open: boolean;
  onClose: () => void;
  refId: string;
  title: string;
  tags: ReactNode;
  tab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  overview: ReactNode;
  activity: ReactNode;
  docs: ReactNode;
  footer?: ReactNode;
}

const TABS: { key: DetailTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "activity", label: "Activity" },
  { key: "docs", label: "Documents" },
];

export function PipelineDetailSheet({
  open,
  onClose,
  refId,
  title,
  tags,
  tab,
  onTabChange,
  overview,
  activity,
  docs,
  footer,
}: DetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="pipeline-scope flex w-full flex-col gap-0 p-0 sm:max-w-[460px]"
      >
        <div
          className="border-b px-[22px] pb-3.5 pt-5"
          style={{ borderColor: "var(--pipeline-line)" }}
        >
          {refId && (
            <div className="p-mono text-xs" style={{ color: "var(--pipeline-slate-light)" }}>
              {refId}
            </div>
          )}
          <SheetTitle className="p-title mb-2.5 mt-1 pr-6 text-base">{title}</SheetTitle>
          <SheetDescription className="sr-only">Details, activity and documents</SheetDescription>
          <div className="flex flex-wrap gap-1.5">{tags}</div>
        </div>
        <div
          role="tablist"
          aria-label="Record sections"
          className="flex gap-0.5 border-b px-[22px]"
          style={{ borderColor: "var(--pipeline-line)" }}
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`so-tab border-b-2 border-transparent px-1 py-2.5 text-[13px] font-semibold ${tab === t.key ? "active" : ""}`}
              style={{
                color: tab === t.key ? "var(--pipeline-ink)" : "var(--pipeline-slate)",
                marginRight: 18,
              }}
              onClick={() => onTabChange(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="flex-1 overflow-y-auto px-[22px] py-[18px]">
          {tab === "overview" && overview}
          {tab === "activity" && activity}
          {tab === "docs" && docs}
        </div>
        {footer && (
          <div
            className="flex flex-wrap gap-2 border-t px-[22px] py-3.5"
            style={{ borderColor: "var(--pipeline-line)" }}
          >
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function KvGrid({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="mb-[18px] grid grid-cols-2 gap-x-4 gap-y-3.5">
      {items.map((it, i) => (
        <div key={i} className="text-[13px]">
          <dt
            className="p-mono mb-0.5 text-xs uppercase tracking-wide"
            style={{ color: "var(--pipeline-slate-light)" }}
          >
            {it.label}
          </dt>
          <dd className="font-semibold">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      className="p-mono my-5 text-xs uppercase tracking-wide"
      style={{ color: "var(--pipeline-slate-light)" }}
    >
      {children}
    </div>
  );
}

export function StageTracker({
  total,
  doneCount,
  currentIndex,
  label,
}: {
  total: number;
  doneCount: number;
  currentIndex: number;
  /** Current stage name, shown as text under the bars. */
  label?: string;
}) {
  return (
    <div className="mb-5">
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`stage-dot-track ${i < doneCount ? "done" : i === currentIndex ? "current" : ""}`}
          />
        ))}
      </div>
      {label ? (
        <p className="mt-1.5 text-xs" style={{ color: "var(--pipeline-slate)" }}>
          Stage {currentIndex + 1} of {total}: <span className="font-semibold">{label}</span>
        </p>
      ) : (
        <span className="sr-only">
          Stage {currentIndex + 1} of {total}
        </span>
      )}
    </div>
  );
}
