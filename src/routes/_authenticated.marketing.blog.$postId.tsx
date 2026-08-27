import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import { ArrowLeft, Loader2, Upload } from "lucide-react";
import {
  useBlogPost,
  useSaveBlogPost,
  useUploadBlogImage,
  useUploadBlogVideo,
  usePublishBlogPost,
  useUnpublishBlogPost,
  useDeleteBlogPost,
  useBlogImagePreview,
  useBlogVideoPreview,
  BLOG_POST_STATUS_LABELS,
  BLOG_POST_STATUS_STYLES,
} from "@/features/marketing/use-blog";
import { useAuth } from "@/lib/auth";
import { RichTextEditor } from "@/features/marketing/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/marketing/blog/$postId")({
  head: () => ({ meta: [{ title: "Edit Post — AIMS" }] }),
  component: BlogEditor,
});

function BlogEditor() {
  const { postId } = Route.useParams();
  const { isAdminOrCeo, hasRole } = useAuth();
  const canManage = isAdminOrCeo || hasRole("marketing");
  const postQ = useBlogPost(postId);
  const save = useSaveBlogPost();
  const uploadImage = useUploadBlogImage(postId);
  const uploadVideo = useUploadBlogVideo(postId);
  const publish = usePublishBlogPost();
  const unpublish = useUnpublishBlogPost();
  const deletePost = useDeleteBlogPost();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [authorName, setAuthorName] = useState("");

  const post = postQ.data;
  const imagePreviewUrl = useBlogImagePreview(postId, post?.has_image ?? false);
  const videoPreviewUrl = useBlogVideoPreview(postId, post?.has_video ?? false);

  useEffect(() => {
    if (!post) return;
    setTitle(post.title);
    setExcerpt(post.excerpt ?? "");
    setContent(post.content ?? "");
    setTags(post.tags.join(", "));
    setAuthorName(post.author_name ?? "");
  }, [post?.id]);

  if (postQ.isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!post) return <div className="text-sm text-muted-foreground">Post not found.</div>;

  const saveChanges = () => {
    save.mutate(
      {
        id: post.id,
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
        onSuccess: () => toast.success("Saved"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
      },
    );
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadImage.mutate(file, {
      onSuccess: () => toast.success("Image uploaded"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Upload failed"),
    });
    e.target.value = "";
  };

  const onVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadVideo.mutate(file, {
      onSuccess: () => toast.success("Video uploaded"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Upload failed"),
    });
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <Link
        to="/marketing/blog"
        className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back to Blog
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">{post.title}</h1>
          <Badge className={BLOG_POST_STATUS_STYLES[post.status]} variant="secondary">
            {BLOG_POST_STATUS_LABELS[post.status]}
          </Badge>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {post.status === "draft" ? (
              <Button
                size="sm"
                disabled={publish.isPending}
                onClick={() =>
                  publish.mutate(post.id, {
                    onSuccess: () => toast.success("Published"),
                    onError: (err) =>
                      toast.error(err instanceof Error ? err.message : "Failed to publish"),
                  })
                }
              >
                {publish.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Publish
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={unpublish.isPending}
                onClick={() =>
                  unpublish.mutate(post.id, {
                    onSuccess: () => toast.success("Unpublished"),
                    onError: (err) =>
                      toast.error(err instanceof Error ? err.message : "Failed to unpublish"),
                  })
                }
              >
                {unpublish.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Unpublish
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={async () => {
                const ok = await confirmDialog({
                  description: "Delete this post permanently?",
                  confirmLabel: "Delete",
                  destructive: true,
                });
                if (!ok) return;
                deletePost.mutate(post.id, {
                  onSuccess: () => toast.success("Post deleted"),
                  onError: (err) =>
                    toast.error(err instanceof Error ? err.message : "Failed to delete"),
                });
              }}
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div>
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!canManage}
              />
            </div>
            <div>
              <Label>Excerpt</Label>
              <Textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={2}
                placeholder="A short summary shown in the blog list"
                disabled={!canManage}
              />
            </div>
            <div>
              <Label>Content</Label>
              <RichTextEditor value={content} onChange={setContent} disabled={!canManage} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="payroll, compliance, kenya"
                  disabled={!canManage}
                />
              </div>
              <div>
                <Label>Author name (optional)</Label>
                <Input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="AMSOL Marketing Team"
                  disabled={!canManage}
                />
              </div>
            </div>
            {canManage && (
              <Button onClick={saveChanges} disabled={save.isPending}>
                {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save changes
              </Button>
            )}
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold mb-1">Preview</h2>
            <p className="text-xs text-muted-foreground mb-3">
              How the saved content renders — updates after you Save changes, not as you type.
            </p>
            {post.content ? (
              <div
                className="prose-sm max-w-none [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                // Safe: post.content is what blog.service.ts's sanitizeContent() persisted —
                // never raw client input taking a new, unsanitized path.
                dangerouslySetInnerHTML={{ __html: post.content }}
              />
            ) : (
              <div className="text-xs text-muted-foreground">
                Nothing saved yet — write some content and Save changes to preview it.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold mb-2">Image</h2>
            {imagePreviewUrl ? (
              <img
                src={imagePreviewUrl}
                alt={post.title}
                className="w-full rounded-md border object-cover aspect-video"
              />
            ) : (
              <div className="aspect-video rounded-md border border-dashed flex items-center justify-center text-xs text-muted-foreground">
                No image
              </div>
            )}
            {canManage && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={onFileChange}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2"
                  disabled={uploadImage.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadImage.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1.5" />
                  )}
                  {post.has_image ? "Replace image" : "Upload image"}
                </Button>
              </>
            )}
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold mb-2">Video (optional hero)</h2>
            {videoPreviewUrl ? (
              <video
                src={videoPreviewUrl}
                controls
                className="w-full rounded-md border aspect-video"
              />
            ) : (
              <div className="aspect-video rounded-md border border-dashed flex items-center justify-center text-xs text-muted-foreground">
                No video
              </div>
            )}
            {canManage && (
              <>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm"
                  className="hidden"
                  onChange={onVideoFileChange}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2"
                  disabled={uploadVideo.isPending}
                  onClick={() => videoInputRef.current?.click()}
                >
                  {uploadVideo.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1.5" />
                  )}
                  {post.has_video ? "Replace video" : "Upload video"}
                </Button>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  When present, the site should show this instead of the cover image, using the
                  cover as the video poster.
                </p>
              </>
            )}
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold mb-3">Engagement</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Views</span>
                <span className="tabular-nums font-medium">{post.views}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Likes</span>
                <span className="tabular-nums font-medium">{post.likes}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shares</span>
                <span className="tabular-nums font-medium">{post.shares}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg. time spent</span>
                <span className="tabular-nums font-medium">
                  {post.avg_time_spent_seconds != null ? `${post.avg_time_spent_seconds}s` : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
