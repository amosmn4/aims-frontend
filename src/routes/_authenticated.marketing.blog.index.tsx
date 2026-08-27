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
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Blog</h1>
          <p className="text-xs text-muted-foreground">
            Posts published here are served to the company website through the public blog API.
          </p>
        </div>
        {canManage && (
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> New post
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
              <NewPostForm onDone={() => setNewOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {postsQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
          No posts yet.
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
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
                      className="font-medium hover:underline"
                    >
                      {p.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge className={BLOG_POST_STATUS_STYLES[p.status]} variant="secondary">
                      {BLOG_POST_STATUS_LABELS[p.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p.views}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.likes}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.shares}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.published_at ? new Date(p.published_at).toLocaleDateString() : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function NewPostForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [authorName, setAuthorName] = useState("");
  const save = useSaveBlogPost();
  const navigate = useNavigate();

  const submit = () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    save.mutate(
      {
        title: title.trim(),
        excerpt,
        content,
        author_name: authorName,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      },
      {
        onSuccess: (post) => {
          toast.success("Draft created");
          onDone();
          navigate({ to: "/marketing/blog/$postId", params: { postId: post.id } });
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create post"),
      },
    );
  };

  return (
    <div>
      <DialogHeader>
        <DialogTitle>New post</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <div>
          <Label>Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 5 Payroll Compliance Pitfalls"
          />
        </div>
        <div>
          <Label>Excerpt</Label>
          <Textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
            placeholder="A short summary shown in the blog list"
          />
        </div>
        <div>
          <Label>Content</Label>
          <RichTextEditor value={content} onChange={setContent} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tags (comma-separated)</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="payroll, compliance, kenya"
            />
          </div>
          <div>
            <Label>Author name (optional)</Label>
            <Input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="AMSOL Marketing Team"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Saved as a draft — add a cover image or video next, then publish when ready.
        </p>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Create draft
        </Button>
      </DialogFooter>
    </div>
  );
}
