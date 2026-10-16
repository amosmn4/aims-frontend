import { SafeHtml } from "@/components/safe-html";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format-date";

export interface BlogPreviewPost {
  title: string;
  excerpt: string;
  content: string;
  authorName: string;
  tags: string[];
  publishedAt?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
}

// An untouched editor still returns "<p></p>", which should read as empty here.
const EMPTY_HTML = /^\s*(<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>\s*)*$/i;

/** Shows a post the way a website reader sees it, from saved or unsaved values. */
export function BlogPostPreview({ post }: { post: BlogPreviewPost }) {
  const title = post.title.trim() || "Untitled post";
  const hasContent = !!post.content && !EMPTY_HTML.test(post.content);

  return (
    <article className="rounded-lg border bg-card p-6 sm:p-10">
      {post.videoUrl ? (
        <video
          src={post.videoUrl}
          controls
          poster={post.imageUrl ?? undefined}
          className="mb-6 aspect-video w-full rounded-md border object-cover"
        />
      ) : post.imageUrl ? (
        <img
          src={post.imageUrl}
          alt={`Cover image for ${title}`}
          className="mb-6 aspect-video w-full rounded-md border object-cover"
        />
      ) : null}

      <h1 className="text-balance text-2xl font-semibold leading-tight sm:text-3xl">{title}</h1>
      <div className="mt-2 text-xs text-muted-foreground">
        {post.authorName.trim() || "AMSOL"}
        {post.publishedAt ? ` · ${formatDate(post.publishedAt)}` : null}
      </div>

      {post.excerpt.trim() && (
        <p className="mt-4 text-base italic text-muted-foreground">{post.excerpt}</p>
      )}

      {hasContent ? (
        <SafeHtml
          html={post.content}
          className="blog-content mt-6 max-w-none overflow-x-auto text-sm sm:text-base"
        />
      ) : (
        <div className="mt-6 text-sm text-muted-foreground">This post has no content yet.</div>
      )}

      {post.tags.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-1.5 border-t pt-4">
          {post.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </article>
  );
}
