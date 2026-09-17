import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  useBlogPost,
  useBlogImagePreview,
  useBlogVideoPreview,
} from "@/features/marketing/use-blog";
import { SafeHtml } from "@/components/safe-html";
import { LoadError } from "@/components/load-error";
import { formatDate } from "@/lib/format-date";

export const Route = createFileRoute("/_authenticated/marketing/blog/$postId_/preview")({
  head: () => ({ meta: [{ title: "Preview post — AIMS" }] }),
  component: BlogPreview,
});

// Opened in a new tab from the editor, so the post reads full width like on the website.
function BlogPreview() {
  const { postId } = Route.useParams();
  const postQ = useBlogPost(postId);
  const post = postQ.data;
  const imagePreviewUrl = useBlogImagePreview(postId, post?.has_image ?? false);
  const videoPreviewUrl = useBlogVideoPreview(postId, post?.has_video ?? false);

  const back = (
    <Link
      to="/marketing/blog/$postId"
      params={{ postId }}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3 w-3" /> Back to editor
    </Link>
  );

  if (postQ.isError) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {back}
        <LoadError what="this post" error={postQ.error} onRetry={() => postQ.refetch()} />
      </div>
    );
  }
  if (postQ.isLoading || !post) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {back}
      <p
        className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        role="note"
      >
        {post.status === "published"
          ? "Preview of the last saved version. This post is on the website."
          : "Preview of the last saved version. This draft isn't on the website yet."}
      </p>

      <article className="rounded-lg border bg-card p-6 sm:p-10">
        {videoPreviewUrl ? (
          <video
            src={videoPreviewUrl}
            controls
            poster={imagePreviewUrl ?? undefined}
            className="mb-6 aspect-video w-full rounded-md border object-cover"
          />
        ) : imagePreviewUrl ? (
          <img
            src={imagePreviewUrl}
            alt={`Cover image for ${post.title}`}
            className="mb-6 aspect-video w-full rounded-md border object-cover"
          />
        ) : null}

        <h1 className="text-balance text-2xl font-semibold leading-tight sm:text-3xl">
          {post.title}
        </h1>
        <div className="mt-2 text-xs text-muted-foreground">
          {post.author_name ?? "AMSOL"}
          {post.published_at && ` · ${formatDate(post.published_at)}`}
        </div>
        {post.excerpt && (
          <p className="mt-4 text-base italic text-muted-foreground">{post.excerpt}</p>
        )}

        {post.content ? (
          <SafeHtml
            html={post.content}
            className="blog-content mt-6 max-w-none overflow-x-auto text-sm sm:text-base"
          />
        ) : (
          <div className="mt-6 text-sm text-muted-foreground">This post has no content yet.</div>
        )}
      </article>
    </div>
  );
}
