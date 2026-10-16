import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  useBlogPost,
  useBlogImagePreview,
  useBlogVideoPreview,
} from "@/features/marketing/use-blog";
import { BlogPostPreview } from "@/features/marketing/blog-post-preview";
import { LoadError } from "@/components/load-error";

export const Route = createFileRoute("/_authenticated/marketing/blog/$postId_/preview")({
  head: () => ({ meta: [{ title: "Preview post — AIMS" }] }),
  component: BlogPreview,
});

// Standalone read-only view of the saved post. The editor previews unsaved work in place.
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
      <div className="mx-auto max-w-3xl space-y-4">
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
    <div className="mx-auto max-w-3xl space-y-4">
      {back}
      <p
        className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        role="note"
      >
        {post.status === "published"
          ? "The last saved version of this post. It is on the website."
          : "The last saved version of this post. This draft isn't on the website yet."}
      </p>

      <BlogPostPreview
        post={{
          title: post.title,
          excerpt: post.excerpt ?? "",
          content: post.content ?? "",
          authorName: post.author_name ?? "",
          tags: post.tags,
          publishedAt: post.published_at,
          imageUrl: imagePreviewUrl,
          videoUrl: videoPreviewUrl,
        }}
      />
    </div>
  );
}
