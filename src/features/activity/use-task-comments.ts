import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

/** Edits a task comment's text (its author or the CEO). */
export function useUpdateTaskComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { commentId: string; body: string }) =>
      apiJson(`/tasks/comments/${input.commentId}`, {
        method: "PATCH",
        body: JSON.stringify({ body: input.body }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-comments", taskId] }),
  });
}
