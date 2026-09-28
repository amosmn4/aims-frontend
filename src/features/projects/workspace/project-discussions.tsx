import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  useLogProjectActivity,
  useProjectActivities,
  useSetDecision,
} from "@/features/pipeline/use-pipeline";
import { ACTIVITY_TYPE_LABELS, useDeleteRecordActivity } from "@/features/activity/use-activity";
import { Thread, type ThreadItem } from "@/components/thread/thread";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";

const typeLabel = (type: string) =>
  type !== "note" && type in ACTIVITY_TYPE_LABELS
    ? ACTIVITY_TYPE_LABELS[type as keyof typeof ACTIVITY_TYPE_LABELS]
    : null;

/** The team's discussions. Anyone who can add work can mark one as a decision. */
export function ProjectDiscussions({
  projectId,
  canPost,
  canReply,
  askWho,
}: {
  projectId: string;
  canPost: boolean;
  canReply: boolean;
  /** Who to ask for access, for people who can only reply. */
  askWho: string;
}) {
  const { user, isAdminOrCeo } = useAuth();
  const activitiesQ = useProjectActivities(projectId);
  const log = useLogProjectActivity(projectId);
  const decide = useSetDecision(projectId);
  const remove = useDeleteRecordActivity({ kind: "project", id: projectId });
  const [filter, setFilter] = useState<"all" | "decisions">("all");
  const [draft, setDraft] = useState("");
  const [asDecision, setAsDecision] = useState(false);
  const [error, setError] = useState("");

  if (activitiesQ.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }
  if (activitiesQ.isError) {
    return (
      <LoadError
        what="discussions"
        error={activitiesQ.error}
        onRetry={() => activitiesQ.refetch()}
      />
    );
  }

  const rows = activitiesQ.data ?? [];
  const decisionIds = new Set(rows.filter((r) => !r.parent_id && r.is_decision).map((r) => r.id));
  const shown =
    filter === "decisions"
      ? rows.filter((r) => decisionIds.has(r.id) || (r.parent_id && decisionIds.has(r.parent_id)))
      : rows;

  const toggleDecision = (id: string, isDecision: boolean) =>
    decide.mutate(
      { id, isDecision },
      {
        onSuccess: () =>
          toast.success(
            isDecision
              ? "Recorded as a decision. It is pinned on the Overview and goes into reports."
              : "Decision mark removed.",
          ),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't change that"),
      },
    );

  const items: ThreadItem[] = shown.map((a) => {
    const kind = typeLabel(a.type);
    return {
      id: a.id,
      parentId: a.parent_id,
      authorName: a.created_by_name ?? "AIMS",
      createdAt: a.parent_id ? a.created_at : a.occurred_at,
      body: a.summary,
      badge:
        !a.parent_id && a.is_decision
          ? {
              label: "Decision",
              tone: "success",
              icon: <CheckCircle2 className="h-3 w-3" aria-hidden="true" />,
            }
          : !a.parent_id && kind
            ? { label: kind, tone: "neutral" }
            : undefined,
      meta:
        !a.parent_id && canPost ? (
          <button
            type="button"
            className="font-medium text-primary hover:underline disabled:opacity-50"
            disabled={decide.isPending}
            onClick={() => toggleDecision(a.id, !a.is_decision)}
          >
            {a.is_decision
              ? `Decided${a.decided_at ? ` ${formatDate(a.decided_at)}` : ""} · Remove decision mark`
              : "Mark as decision"}
          </button>
        ) : !a.parent_id && a.is_decision && a.decided_at ? (
          `Decided ${formatDate(a.decided_at)}`
        ) : undefined,
      canDelete: isAdminOrCeo || (!!user && a.created_by_id === user.id),
    };
  });

  const post = async () => {
    if (!draft.trim()) {
      setError("Write something first.");
      return;
    }
    setError("");
    try {
      const created = (await log.mutateAsync({ type: "note", summary: draft.trim() })) as {
        id?: string;
      };
      if (asDecision && created?.id) await decide.mutateAsync({ id: created.id, isDecision: true });
      toast.success(
        asDecision ? "Decision recorded and pinned on the Overview." : "Posted to the team.",
      );
      setDraft("");
      setAsDecision(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't post that");
    }
  };

  const composer = canPost ? (
    <div className="space-y-2">
      <label htmlFor={`disc-${projectId}`} className="text-sm font-medium">
        Start a discussion
      </label>
      <Textarea
        id={`disc-${projectId}`}
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Ask the team, share an update, or record what was agreed…"
        aria-invalid={!!error}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={asDecision}
            onChange={(e) => setAsDecision(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Record this as a decision
        </label>
        <Button size="sm" onClick={post} disabled={log.isPending || decide.isPending}>
          {(log.isPending || decide.isPending) && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          Post to team
        </Button>
      </div>
    </div>
  ) : (
    <p className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
      {canReply
        ? `You can reply to discussions. Ask ${askWho} to make you a member to start one.`
        : `You can read discussions. Ask ${askWho} if you need to take part.`}
    </p>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-1" role="group" aria-label="Show">
        {(
          [
            ["all", "All discussions"],
            ["decisions", `Decisions (${decisionIds.size})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              filter === value
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <Thread
        items={items}
        title="Discussions"
        headingLevel="h3"
        emptyText={filter === "decisions" ? "No decisions recorded yet." : "No discussions yet."}
        canPost={canPost || canReply}
        composer={composer}
        newestFirst
        onSend={(body, parentId) => log.mutateAsync({ type: "note", summary: body, parentId })}
        onDelete={(item) => remove.mutateAsync(item.id)}
        sending={log.isPending}
      />
    </div>
  );
}
