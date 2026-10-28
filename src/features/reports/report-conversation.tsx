import { CheckCircle2, RotateCcw, Upload } from "lucide-react";
import { Thread, type ThreadItem, type ThreadTone } from "@/components/thread/thread";
import type { ReportMessageKind } from "./use-department-reports";

export interface ConversationMessage {
  id: string;
  kind: ReportMessageKind;
  body: string;
  parentId: string | null;
  createdAt: string;
  authorName: string;
}

const KIND_BADGE: Record<
  Exclude<ReportMessageKind, "comment">,
  { label: string; tone: ThreadTone; icon: typeof Upload }
> = {
  submitted: { label: "Submitted", tone: "primary", icon: Upload },
  resubmitted: { label: "Resubmitted", tone: "primary", icon: RotateCcw },
  changes_requested: { label: "Changes requested", tone: "warning", icon: RotateCcw },
  approved: { label: "Approved", tone: "success", icon: CheckCircle2 },
};

/** The back-and-forth on a report: submissions, CEO decisions, comments and replies. */
export function ReportConversation({
  messages,
  onSend,
  sending,
  canPost,
  placeholder = "Write a message…",
}: {
  messages: ConversationMessage[];
  onSend: (body: string, parentId?: string) => Promise<unknown>;
  sending: boolean;
  canPost: boolean;
  placeholder?: string;
}) {
  const items: ThreadItem[] = messages.map((m) => {
    const badge = m.kind !== "comment" ? KIND_BADGE[m.kind] : null;
    const Icon = badge?.icon;
    return {
      id: m.id,
      parentId: m.parentId,
      authorName: m.authorName,
      createdAt: m.createdAt,
      body: m.body,
      badge:
        badge && Icon
          ? { label: badge.label, tone: badge.tone, icon: <Icon className="h-3 w-3" /> }
          : undefined,
    };
  });
  return (
    <Thread
      items={items}
      title="Conversation with the CEO"
      emptyText="Nothing yet. Messages appear here once the report is submitted."
      canPost={canPost}
      onSend={onSend}
      sending={sending}
      placeholder={placeholder}
    />
  );
}
