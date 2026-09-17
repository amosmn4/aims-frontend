import { useState, type ReactNode } from "react";
import { CornerDownRight, Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { confirmDialog } from "@/components/confirm-dialog";
import { formatRelative, formatDateTime } from "@/lib/format-date";
import { cn } from "@/lib/utils";

export type ThreadTone = "neutral" | "primary" | "success" | "warning" | "danger";

export interface ThreadItem {
  id: string;
  parentId: string | null;
  authorName: string;
  createdAt: string;
  body: string;
  /** A short label before the text, e.g. "Call" or "Promise to pay". */
  badge?: { label: string; tone?: ThreadTone; icon?: ReactNode };
  /** Extra line under the text, e.g. "Promised for 30 Sep 2026". */
  meta?: ReactNode;
  canDelete?: boolean;
}

const TONE: Record<ThreadTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/10 text-destructive",
};

/**
 * A conversation with one level of replies, used everywhere people write to each other:
 * report conversations, task comments, activity logs, follow-ups and IT tickets.
 */
export function Thread({
  items,
  title = "Conversation",
  emptyText = "No messages yet.",
  canPost,
  onSend,
  onDelete,
  sending = false,
  placeholder = "Write a message…",
  sendLabel = "Send message",
  newestFirst = false,
  composer,
  headingLevel = "h2",
  className,
}: {
  items: ThreadItem[];
  title?: string;
  emptyText?: string;
  canPost: boolean;
  /** Called with the text and, for replies, the message being replied to. */
  onSend: (body: string, parentId?: string) => Promise<unknown>;
  onDelete?: (item: ThreadItem, replyCount: number) => Promise<unknown>;
  sending?: boolean;
  placeholder?: string;
  sendLabel?: string;
  newestFirst?: boolean;
  /** Replaces the default new-message box (e.g. an activity form with type and date). */
  composer?: ReactNode;
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const ids = new Set(items.map((i) => i.id));
  const topLevel = items
    .filter((i) => !i.parentId || !ids.has(i.parentId))
    .sort((a, b) => (newestFirst ? -1 : 1) * a.createdAt.localeCompare(b.createdAt));
  const repliesOf = (id: string) =>
    items.filter((i) => i.parentId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const Heading = headingLevel;

  // If sending throws, keep what was typed so nothing is lost.
  const send = async () => {
    if (!body.trim()) return;
    try {
      await onSend(body.trim());
      setBody("");
    } catch {
      /* the caller shows the error */
    }
  };
  const sendReply = async (parentId: string) => {
    if (!replyBody.trim()) return;
    try {
      await onSend(replyBody.trim(), parentId);
      setReplyBody("");
      setReplyTo(null);
    } catch {
      /* the caller shows the error */
    }
  };
  const remove = async (item: ThreadItem, replyCount: number) => {
    if (!onDelete) return;
    const ok = await confirmDialog({
      title: "Delete this message?",
      description:
        replyCount > 0
          ? `Its ${replyCount === 1 ? "reply" : `${replyCount} replies`} will be deleted too. This can't be undone.`
          : "This can't be undone.",
      confirmLabel: "Delete message",
      destructive: true,
    });
    if (ok) await onDelete(item, replyCount);
  };

  const bubble = (item: ThreadItem, replyCount: number, isReply = false) => (
    <div className={cn("rounded-lg border bg-card p-3", isReply && "bg-secondary/40")}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="font-semibold text-foreground">{item.authorName}</span>
        {item.badge && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              TONE[item.badge.tone ?? "neutral"],
            )}
          >
            {item.badge.icon}
            {item.badge.label}
          </span>
        )}
        <time
          dateTime={item.createdAt}
          title={formatDateTime(item.createdAt)}
          className="text-muted-foreground"
        >
          {formatRelative(item.createdAt)}
        </time>
        {item.canDelete && onDelete && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="ml-auto h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => remove(item, replyCount)}
            aria-label={`Delete message from ${item.authorName}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {item.body && <p className="mt-1 whitespace-pre-wrap text-sm">{item.body}</p>}
      {item.meta && <div className="mt-1 text-xs text-muted-foreground">{item.meta}</div>}
    </div>
  );

  return (
    <section className={cn("rounded-lg border bg-card p-4", className)} aria-label={title}>
      <Heading className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <MessageSquare className="h-4 w-4" aria-hidden="true" /> {title}
      </Heading>

      {canPost && composer && <div className="mb-4">{composer}</div>}

      {topLevel.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ol className="space-y-3">
          {topLevel.map((item) => {
            const replies = repliesOf(item.id);
            return (
              <li key={item.id} className="space-y-2">
                {bubble(item, replies.length)}
                {replies.map((r) => (
                  <div key={r.id} className="ml-4 flex gap-2 sm:ml-6">
                    <CornerDownRight
                      className="mt-3 h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">{bubble(r, 0, true)}</div>
                  </div>
                ))}
                {canPost &&
                  (replyTo === item.id ? (
                    <div className="ml-4 space-y-2 sm:ml-6">
                      <label htmlFor={`reply-${item.id}`} className="sr-only">
                        Reply to {item.authorName}
                      </label>
                      <Textarea
                        id={`reply-${item.id}`}
                        rows={2}
                        autoFocus
                        placeholder={`Reply to ${item.authorName}…`}
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.ctrlKey || e.metaKey))
                            void sendReply(item.id);
                        }}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => sendReply(item.id)}
                          disabled={sending || !replyBody.trim()}
                        >
                          {sending ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="mr-1 h-4 w-4" />
                          )}
                          Send reply
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="ml-4 h-7 px-2 text-xs text-primary sm:ml-6"
                      onClick={() => {
                        setReplyTo(item.id);
                        setReplyBody("");
                      }}
                    >
                      <CornerDownRight className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      Reply to {item.authorName}
                    </Button>
                  ))}
              </li>
            );
          })}
        </ol>
      )}

      {canPost && !composer && (
        <div className="mt-4 border-t pt-3">
          <label
            htmlFor={`thread-new-${title}`}
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            New message
          </label>
          <Textarea
            id={`thread-new-${title}`}
            rows={3}
            placeholder={placeholder}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void send();
            }}
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={send} disabled={sending || !body.trim()}>
              {sending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1 h-4 w-4" />
              )}
              {sendLabel}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
