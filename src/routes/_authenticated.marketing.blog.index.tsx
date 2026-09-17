import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import {
  useBlogPosts,
  useSaveBlogPost,
  BLOG_POST_STATUS_LABELS,
  BLOG_POST_STATUS_STYLES,
} from "@/features/marketing/use-blog";
import { RichTextEditor } from "@/features/marketing/rich-text-editor";
import { PageHeader } from "@/components/app-shell";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useAuth } from "@/lib/auth";
import { formatDate, formatRelative } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/marketing/blog/")({
  component: BlogList,
});

function BlogList() {
  const { isAdminOrCeo, hasRole } = useAuth();
  const canManage = isAdminOrCeo || hasRole("marketing");
  const postsQ = useBlogPosts();
  const [newOpen, setNewOpen] = useState(false);
  const posts = postsQ.data ?? [];

  const newButton = (
    <Button size="sm" onClick={() => setNewOpen(true)}>
      <Plus className="mr-1 h-4 w-4" /> New post
    </Button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Blog"
        description="Write posts for the company website. A post shows on the website once you publish it."
        actions={canManage ? newButton : undefined}
      />
      {!canManage && <ViewOnlyBanner area="blog posts" action="write or publish them" />}

      {postsQ.isError ? (
        <LoadError what="blog posts" error={postsQ.error} onRetry={() => postsQ.refetch()} />
      ) : postsQ.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-12 text-center">
          <p className="text-sm font-medium">No posts yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Start a draft. Nothing goes on the website until you publish it.
          </p>
          {canManage && <div className="mt-3">{newButton}</div>}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Likes</TableHead>
                <TableHead className="text-right">Shares</TableHead>
                <TableHead>Published</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      to="/marketing/blog/$postId"
                      params={{ postId: p.id }}
                      className="font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {p.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      Last saved {formatRelative(p.updated_at)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={BLOG_POST_STATUS_STYLES[p.status]} variant="secondary">
                      {BLOG_POST_STATUS_LABELS[p.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p.views}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.likes}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.shares}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(p.published_at, "Not yet")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {newOpen && <NewPostDialog onClose={() => setNewOpen(false)} />}
    </div>
  );
}

const blank = { title: "", excerpt: "", content: "", tags: "", authorName: "" };

function NewPostDialog({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState(blank);
  const [titleError, setTitleError] = useState("");
  const save = useSaveBlogPost();
  const navigate = useNavigate();
  const dirty = (Object.keys(blank) as (keyof typeof blank)[]).some((k) => form[k] !== blank[k]);
  const { guardClose } = useUnsavedChanges(dirty);

  const set = (key: keyof typeof blank, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "title") setTitleError("");
  };

  const submit = () => {
    if (!form.title.trim()) {
      setTitleError("Enter a title for the post");
      return;
    }
    save.mutate(
      {
        title: form.title.trim(),
        excerpt: form.excerpt,
        content: form.content,
        author_name: form.authorName,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      },
      {
        onSuccess: (post) => {
          toast.success("Draft saved");
          onClose();
          navigate({ to: "/marketing/blog/$postId", params: { postId: post.id } });
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Couldn't create the post"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onClose)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New post</DialogTitle>
          <DialogDescription>
            Saved as a draft. Add a cover image next, then publish when it's ready.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <RequiredNote />
          <FormField id="new-post-title" label="Title" required error={titleError}>
            <Input
              id="new-post-title"
              value={form.title}
              aria-invalid={!!titleError}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. 5 payroll compliance pitfalls"
              autoFocus
            />
          </FormField>
          <FormField
            id="new-post-excerpt"
            label="Excerpt"
            hint="A short summary shown in the blog list."
          >
            <Textarea
              id="new-post-excerpt"
              value={form.excerpt}
              onChange={(e) => set("excerpt", e.target.value)}
              rows={2}
            />
          </FormField>
          <div className="space-y-1">
            <span className="text-sm font-medium">Content</span>
            <RichTextEditor value={form.content} onChange={(html) => set("content", html)} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="new-post-tags" label="Tags" hint="Separate tags with commas.">
              <Input
                id="new-post-tags"
                value={form.tags}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="payroll, compliance, kenya"
              />
            </FormField>
            <FormField id="new-post-author" label="Author name">
              <Input
                id="new-post-author"
                value={form.authorName}
                onChange={(e) => set("authorName", e.target.value)}
                placeholder="AMSOL Marketing Team"
              />
            </FormField>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => guardClose(onClose)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Save draft
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
