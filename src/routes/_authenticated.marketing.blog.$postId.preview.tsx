import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  useBlogPost,
  useBlogImagePreview,
  useBlogVideoPreview,
} from "@/features/marketing/use-blog";

export const Route = createFileRoute("/_authenticated/marketing/blog/$postId/preview")({
  head: () => ({ meta: [{ title: "Preview Post — AIMS" }] }),
  component: BlogPreview,
});

// A dedicated page rather than an inline panel on the editor — opened via the editor's Preview
// button (new tab, editor stays open) so marketing sees the post the way a reader actually
// would: full width, real typography, cover media up top — not squeezed into a sidebar card.
function BlogPreview() {
  const { postId } = Route.useParams();
  const postQ = useBlogPost(postId);
  const post = postQ.data;
  const imagePreviewUrl = useBlogImagePreview(postId, post?.has_image ?? false);
  const videoPreviewUrl = useBlogVideoPreview(postId, post?.has_video ?? false);

  if (postQ.isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!post) return <div className="text-sm text-muted-foreground">Post not found.</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link
        to="/marketing/blog/$postId"
        params={{ postId }}
        className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back to editor
      </Link>

      <article className="rounded-lg border bg-card p-6 sm:p-10">
        {videoPreviewUrl ? (
          <video
            src={videoPreviewUrl}
            controls
            poster={imagePreviewUrl ?? undefined}
            className="w-full rounded-md border aspect-video mb-6 object-cover"
          />
        ) : imagePreviewUrl ? (
          <img
            src={imagePreviewUrl}
            alt={post.title}
            className="w-full rounded-md border aspect-video mb-6 object-cover"
          />
        ) : null}

        <h1 className="text-2xl sm:text-3xl font-semibold leading-tight text-balance">
          {post.title}
        </h1>
        <div className="mt-2 text-xs text-muted-foreground">
          {post.author_name ?? "AMSOL"}
          {post.published_at && ` · ${new Date(post.published_at).toLocaleDateString()}`}
        </div>
        {post.excerpt && (
          <p className="mt-4 text-base text-muted-foreground italic">{post.excerpt}</p>
        )}

        {post.content ? (
          <div
            className="mt-6 prose-sm sm:prose-base max-w-none [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-4"
            // Safe: post.content is what blog.service.ts's sanitizeContent() persisted — never
            // raw client input taking a new, unsanitized path.
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        ) : (
          <div className="mt-6 text-sm text-muted-foreground">Nothing saved yet.</div>
        )}
      </article>
    </div>
  );
}
