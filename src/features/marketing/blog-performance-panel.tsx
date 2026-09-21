import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useBlogPosts } from "@/features/marketing/use-blog";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";

/** Blog posts that are out, drafts still waiting, and which posts people actually read. */
export function BlogPerformancePanel() {
  const postsQ = useBlogPosts();
  const posts = postsQ.data ?? [];
  const published = posts.filter((p) => p.status === "published");
  const drafts = posts.filter((p) => p.status === "draft");
  const views = published.reduce((sum, p) => sum + p.views, 0);
  const mostRead = [...published].sort((a, b) => b.views - a.views).slice(0, 3);

  return (
    <section className="rounded-xl border bg-card" aria-labelledby="blog-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="blog-heading" className="text-sm font-semibold">
          Blog
        </h2>
        <Link to="/marketing/blog" className="text-xs font-medium text-primary hover:underline">
          All posts
        </Link>
      </div>

      {postsQ.isError ? (
        <div className="p-4">
          <LoadError what="blog posts" error={postsQ.error} onRetry={() => postsQ.refetch()} />
        </div>
      ) : postsQ.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-sm font-medium">Nothing written yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Posts bring people to the website and give the sales team something to send.
          </p>
          <Button size="sm" asChild>
            <Link to="/marketing/blog">Write the first post</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          <ul className="grid grid-cols-3 gap-2">
            {[
              { label: "Published", value: published.length },
              { label: "Still drafts", value: drafts.length },
              { label: "Reads", value: views.toLocaleString() },
            ].map((s) => (
              <li key={s.label}>
                <Link
                  to="/marketing/blog"
                  className="block rounded-lg border px-3 py-2 hover:border-primary/50"
                >
                  <span className="block text-xs text-muted-foreground">{s.label}</span>
                  <span className="block text-lg font-semibold tabular-nums">{s.value}</span>
                </Link>
              </li>
            ))}
          </ul>

          {drafts.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {drafts.length} post{drafts.length === 1 ? "" : "s"} still unpublished — oldest
              started{" "}
              {formatDate(
                [...drafts].sort((a, b) => a.created_at.localeCompare(b.created_at))[0].created_at,
              )}
              .
            </p>
          )}

          <div>
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Most read</h3>
            {mostRead.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nothing published yet. Publish a draft to start counting reads.
              </p>
            ) : (
              <ul className="divide-y">
                {mostRead.map((p) => (
                  <li key={p.id}>
                    <Link
                      to="/marketing/blog/$postId"
                      params={{ postId: p.id }}
                      className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-secondary/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          Published {formatDate(p.published_at)} · {p.likes} likes · {p.shares}{" "}
                          shares
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {p.views.toLocaleString()}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
