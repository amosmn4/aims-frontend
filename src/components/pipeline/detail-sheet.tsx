import type { ReactNode } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface DetailSheetProps {
  open: boolean;
  onClose: () => void;
  refId: string;
  title: string;
  tags: ReactNode;
  tab: "overview" | "activity" | "docs";
  onTabChange: (tab: "overview" | "activity" | "docs") => void;
  overview: ReactNode;
  activity: ReactNode;
  docs: ReactNode;
  footer?: ReactNode;
}

const TABS: { key: "overview" | "activity" | "docs"; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "activity", label: "Activity & Communication" },
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
      <SheetContent side="right" className="pipeline-scope flex w-full flex-col gap-0 p-0 sm:max-w-[460px]">
        <div className="border-b px-[22px] pb-3.5 pt-5" style={{ borderColor: "var(--pipeline-line)" }}>
          <div
            className="p-mono text-[11px]"
            style={{ color: "var(--pipeline-slate-light)" }}
          >
            {refId}
          </div>
          <div className="p-title mb-2.5 mt-1 text-[19px]">{title}</div>
          <div className="flex flex-wrap gap-1.5">{tags}</div>
        </div>
        <div className="flex gap-0.5 border-b px-[22px]" style={{ borderColor: "var(--pipeline-line)" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className="so-tab border-b-2 border-transparent px-1 py-2.5 text-[12.5px] font-semibold"
              style={{ color: tab === t.key ? "var(--pipeline-ink)" : "var(--pipeline-slate)", marginRight: 18 }}
              onClick={() => onTabChange(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-[22px] py-[18px]">
          {tab === "overview" && overview}
          {tab === "activity" && activity}
          {tab === "docs" && docs}
        </div>
        {footer && (
          <div className="flex gap-2 border-t px-[22px] py-3.5" style={{ borderColor: "var(--pipeline-line)" }}>
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function KvGrid({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <div className="mb-[18px] grid grid-cols-2 gap-x-4 gap-y-3.5">
      {items.map((it, i) => (
        <div key={i} className="text-[12.5px]">
          <div
            className="p-mono mb-0.5 text-[10.5px] uppercase tracking-wide"
            style={{ color: "var(--pipeline-slate-light)" }}
          >
            {it.label}
          </div>
          <div className="font-semibold">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      className="p-mono my-5 text-[10.5px] uppercase tracking-wide"
      style={{ color: "var(--pipeline-slate-light)" }}
    >
      {children}
    </div>
  );
}

export function StageTracker({ total, doneCount, currentIndex }: { total: number; doneCount: number; currentIndex: number }) {
  return (
    <div className="mb-5 flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`stage-dot-track ${i < doneCount ? "done" : i === currentIndex ? "current" : ""}`}
        />
      ))}
    </div>
  );
}
