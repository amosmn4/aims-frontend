import { useState } from "react";
import { ACTIVITY_ICON, ACTIVITY_COLOR } from "@/features/pipeline/pipeline-theme";
import { Button } from "@/components/ui/button";

export interface ActivityEntry {
  id: string;
  type: string;
  summary: string;
  occurred_at: string;
  created_by_name: string | null;
}

interface ActivityPaneProps {
  activities: ActivityEntry[];
  isLoading: boolean;
  onAdd: (type: string, summary: string) => void;
  isAdding: boolean;
}

const TYPE_OPTIONS = [
  { value: "note", label: "Note" },
  { value: "meeting", label: "Meeting" },
  { value: "email", label: "Email" },
  { value: "call", label: "Call" },
  { value: "visit", label: "Site Visit" },
];

function timeAgo(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

export function ActivityPane({ activities, isLoading, onAdd, isAdding }: ActivityPaneProps) {
  const [type, setType] = useState("note");
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;
    onAdd(type, text.trim());
    setText("");
  };

  return (
    <div>
      {isLoading ? (
        <div className="py-6 text-center text-xs" style={{ color: "var(--pipeline-slate-light)" }}>
          Loading…
        </div>
      ) : activities.length === 0 ? (
        <div className="empty-col">No activity logged yet</div>
      ) : (
        activities.map((a) => (
          <div
            key={a.id}
            className="flex gap-2.5 border-b py-2.5"
            style={{ borderColor: "var(--pipeline-line-soft)" }}
          >
            <div
              className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-xs"
              style={{ background: ACTIVITY_COLOR[a.type] ?? "var(--pipeline-paper)" }}
            >
              {ACTIVITY_ICON[a.type] ?? "•"}
            </div>
            <div className="flex-1 text-[12.5px]">
              <div className="flex justify-between gap-2">
                <span className="font-semibold">{a.created_by_name ?? "System"}</span>
                <span className="p-mono text-[10.5px]" style={{ color: "var(--pipeline-slate-light)" }}>
                  {timeAgo(a.occurred_at)}
                </span>
              </div>
              <div className="mt-0.5" style={{ color: "var(--pipeline-slate)" }}>
                {a.summary}
              </div>
            </div>
          </div>
        ))
      )}
      <div className="mt-3.5 flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-[108px] shrink-0 rounded-lg border px-2.5 py-2 text-[12.5px]"
          style={{ borderColor: "var(--pipeline-line)" }}
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Log an update…"
          className="flex-1 rounded-lg border px-2.5 py-2 text-[12.5px]"
          style={{ borderColor: "var(--pipeline-line)" }}
        />
        <Button size="sm" onClick={submit} disabled={isAdding || !text.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}
