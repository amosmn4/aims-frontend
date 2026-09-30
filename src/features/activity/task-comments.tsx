import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { Thread, type ThreadItem } from "@/components/thread/thread";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import {
  useCreateComment,
  useDeleteComment,
  useTaskComments,
} from "@/features/projects/use-projects";
import { useUpdateTaskComment } from "./use-task-comments";

const errText = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

// Saved a second or more after posting means someone changed the text.
const wasEdited = (createdAt: string, updatedAt: string) =>
  new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 1000;

/** A task's Comments thread: comment, reply, and edit or delete your own. */
export function TaskComments({ taskId }: { taskId: string }) {
  const { user, isAdminOrCeo } = useAuth();
  const commentsQ = useTaskComments(taskId);
  const create = useCreateComment(taskId);
  const remove = useDeleteComment(taskId);
  const update = useUpdateTaskComment(taskId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  if (commentsQ.isError) {
    return (
      <LoadError what="comments" error={commentsQ.error} onRetry={() => commentsQ.refetch()} />
    );
  }
  if (commentsQ.isLoading) {
    return (
      <div className="flex justify-center py-4" role="status" aria-label="Loading comments">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      </div>
    );
  }

  const saveEdit = (commentId: string) => {
    if (!editBody.trim()) return;
    update.mutate(
      { commentId, body: editBody.trim() },
      {
        onSuccess: () => {
          toast.success("Comment updated");
          setEditingId(null);
        },
        onError: (err) => toast.error(errText(err, "Couldn't save the comment")),
      },
    );
  };

  const items: ThreadItem[] = (commentsQ.data ?? []).map((c) => {
    const own = isAdminOrCeo || (!!user && c.author_id === user.id);
    const editing = editingId === c.id;
    const edited = wasEdited(c.created_at, c.updated_at);
    return {
      id: c.id,
      parentId: c.parent_id,
      authorName: c.author_name,
      createdAt: c.created_at,
      body: editing ? "" : c.body,
      canDelete: own,
      meta: editing ? (
        <div className="mt-1 space-y-2">
          <label htmlFor={`edit-comment-${c.id}`} className="sr-only">
            Edit comment from {c.author_name}
          </label>
          <Textarea
            id={`edit-comment-${c.id}`}
            rows={3}
            autoFocus
            className="text-sm text-foreground"
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => saveEdit(c.id)}
              disabled={update.isPending || !editBody.trim()}
            >
              {update.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Save comment
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : edited || own ? (
        <div className="flex flex-wrap items-center gap-2">
          {edited && <span>Edited</span>}
          {own && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setEditingId(c.id);
                setEditBody(c.body);
              }}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Edit comment
            </Button>
          )}
        </div>
      ) : undefined,
    };
  });

  return (
    <Thread
      title="Comments"
      headingLevel="h3"
      items={items}
      canPost
      placeholder="Write a comment…"
      sendLabel="Add comment"
      sending={create.isPending}
      emptyText="No comments yet."
      onSend={(body, parentId) =>
        create
          .mutateAsync({ body, parentId })
          .then(() => toast.success(parentId ? "Reply sent" : "Comment added"))
          .catch((err) => toast.error(errText(err, "Couldn't post the comment")))
      }
      onDelete={(item) =>
        remove
          .mutateAsync(item.id)
          .then(() => toast.success("Comment deleted"))
          .catch((err) => toast.error(errText(err, "Couldn't delete the comment")))
      }
    />
  );
}
