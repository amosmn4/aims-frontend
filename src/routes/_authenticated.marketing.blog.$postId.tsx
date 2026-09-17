import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, Loader2, Save, Send, Trash2, Upload } from "lucide-react";
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
  type BlogPostRow,
} from "@/features/marketing/use-blog";
import { RichTextEditor } from "@/features/marketing/rich-text-editor";
import { useLeaveGuard } from "@/features/settings/use-leave-guard";
import { confirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { useAuth } from "@/lib/auth";
import { formatDate, formatRelative } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/marketing/blog/$postId")({
  head: () => ({ meta: [{ title: "Edit post — AIMS" }] }),
  component: BlogEditor,
});

type Fields = { title: string; excerpt: string; content: string; tags: string; authorName: string };

const fieldsOf = (p: BlogPostRow): Fields => ({
  title: p.title,
  excerpt: p.excerpt ?? "",
  content: p.content ?? "",
  tags: p.tags.join(", "),
  authorName: p.author_name ?? "",
});

const errText = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

function BlogEditor() {
  const { postId } = Route.useParams();
  const postQ = useBlogPost(postId);
  const post = postQ.data;

  if (postQ.isError) {
    return (
      <div className="space-y-4">
        <BackLink />
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
  return <BlogEditorForm key={post.id} post={post} />;
}

function BackLink() {
  return (
    <Link
      to="/marketing/blog"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3 w-3" /> Back to Blog
    </Link>
  );
}

function BlogEditorForm({ post }: { post: BlogPostRow }) {
  const { isAdminOrCeo, hasCapability } = useAuth();
  const canManage = isAdminOrCeo || hasCapability("publish_blog");
  const navigate = useNavigate();
  const save = useSaveBlogPost();
  const uploadImage = useUploadBlogImage(post.id);
  const uploadVideo = useUploadBlogVideo(post.id);
  const publish = usePublishBlogPost();
  const unpublish = useUnpublishBlogPost();
  const deletePost = useDeleteBlogPost();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imagePreviewUrl = useBlogImagePreview(post.id, post.has_image);
  const videoPreviewUrl = useBlogVideoPreview(post.id, post.has_video);

  const [saved, setSaved] = useState<Fields>(() => fieldsOf(post));
  const [form, setForm] = useState<Fields>(saved);
  const [titleError, setTitleError] = useState("");

  const dirty =
    canManage && (Object.keys(saved) as (keyof Fields)[]).some((k) => form[k] !== saved[k]);
  const { allowLeave } = useLeaveGuard(dirty);

  const set = <K extends keyof Fields>(key: K, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "title") setTitleError("");
  };
  const setContent = (html: string) => setForm((f) => ({ ...f, content: html }));

  const saveChanges = async () => {
    if (!form.title.trim()) {
      setTitleError("Enter a title for the post");
      return false;
    }
    try {
      await save.mutateAsync({
        id: post.id,
        title: form.title.trim(),
        excerpt: form.excerpt,
        content: form.content,
        author_name: form.authorName,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setSaved(form);
      toast.success("Post saved");
      return true;
    } catch (err) {
      toast.error(errText(err, "Couldn't save the post"));
      return false;
    }
  };

  const publishPost = async () => {
    const ok = await confirmDialog(
      dirty
        ? {
            title: "You have unsaved changes",
            description:
              "Save your changes first, or they won't be published. Only the last saved version goes live on the website.",
            confirmLabel: "Save and publish",
            cancelLabel: "Keep editing",
          }
        : {
            title: "Publish this post on the website?",
            description:
              "The last saved version goes live for everyone visiting the website straight away.",
            confirmLabel: "Publish post",
          },
    );
    if (!ok) return;
    if (dirty && !(await saveChanges())) return;
    publish.mutate(post.id, {
      onSuccess: () => toast.success("Post published on the website"),
      onError: (err) => toast.error(errText(err, "Couldn't publish the post")),
    });
  };

  const unpublishPost = async () => {
    const ok = await confirmDialog({
      title: "Take this post off the website?",
      description: "It goes back to being a draft. You can publish it again later.",
      confirmLabel: "Unpublish post",
    });
    if (!ok) return;
    unpublish.mutate(post.id, {
      onSuccess: () => toast.success("Post taken off the website"),
      onError: (err) => toast.error(errText(err, "Couldn't unpublish the post")),
    });
  };

  const removePost = async () => {
    const ok = await confirmDialog({
      title: `Delete "${post.title}"?`,
      description:
        post.status === "published"
          ? "It comes off the website and is deleted permanently. This can't be undone."
          : "The post is deleted permanently. This can't be undone.",
      confirmLabel: "Delete post",
      destructive: true,
    });
    if (!ok) return;
    deletePost.mutate(post.id, {
      onSuccess: () => {
        toast.success("Post deleted");
        allowLeave();
        navigate({ to: "/marketing/blog" });
      },
      onError: (err) => toast.error(errText(err, "Couldn't delete the post")),
    });
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>, kind: "image" | "video") => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const upload = kind === "image" ? uploadImage : uploadVideo;
    upload.mutate(file, {
      onSuccess: () => toast.success(kind === "image" ? "Image uploaded" : "Video uploaded"),
      onError: (err) => toast.error(errText(err, "Upload failed")),
    });
  };

  return (
    <div className="space-y-4">
      <BackLink />

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold">{post.title}</h1>
            <Badge className={BLOG_POST_STATUS_STYLES[post.status]} variant="secondary">
              {BLOG_POST_STATUS_LABELS[post.status]}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {post.status === "published"
              ? `On the website since ${formatDate(post.published_at)}. Save to update it there.`
              : "A draft. Write the post, save it, then publish it to the website."}{" "}
            Last saved {formatRelative(post.updated_at)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/marketing/blog/$postId/preview" params={{ postId: post.id }} target="_blank">
              <Eye className="mr-1 h-4 w-4" /> Preview post
            </Link>
          </Button>
          {canManage &&
            (post.status === "draft" ? (
              <Button
                size="sm"
                disabled={publish.isPending || save.isPending}
                onClick={publishPost}
              >
                {publish.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1 h-4 w-4" />
                )}
                Publish post
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={unpublish.isPending}
                onClick={unpublishPost}
              >
                {unpublish.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <EyeOff className="mr-1 h-4 w-4" />
                )}
                Unpublish post
              </Button>
            ))}
          {canManage && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={deletePost.isPending}
              onClick={removePost}
            >
              <Trash2 className="mr-1 h-4 w-4" /> Delete post
            </Button>
          )}
        </div>
      </div>

      {!canManage && <ViewOnlyBanner area="blog posts" action="edit or publish them" />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <form
            className="space-y-3 rounded-lg border bg-card p-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void saveChanges();
            }}
          >
            <FormField id="post-title" label="Title" required error={titleError}>
              <Input
                id="post-title"
                value={form.title}
                aria-invalid={!!titleError}
                onChange={(e) => set("title", e.target.value)}
                disabled={!canManage}
              />
            </FormField>
            <FormField
              id="post-excerpt"
              label="Excerpt"
              hint="A short summary shown in the blog list."
            >
              <Textarea
                id="post-excerpt"
                value={form.excerpt}
                onChange={(e) => set("excerpt", e.target.value)}
                rows={2}
                disabled={!canManage}
              />
            </FormField>
            <div className="space-y-1">
              <span className="text-sm font-medium">Content</span>
              <RichTextEditor value={form.content} onChange={setContent} disabled={!canManage} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField id="post-tags" label="Tags" hint="Separate tags with commas.">
                <Input
                  id="post-tags"
                  value={form.tags}
                  onChange={(e) => set("tags", e.target.value)}
                  placeholder="payroll, compliance, kenya"
                  disabled={!canManage}
                />
              </FormField>
              <FormField id="post-author" label="Author name">
                <Input
                  id="post-author"
                  value={form.authorName}
                  onChange={(e) => set("authorName", e.target.value)}
                  placeholder="AMSOL Marketing Team"
                  disabled={!canManage}
                />
              </FormField>
            </div>
            {canManage && (
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={save.isPending || !dirty}>
                  {save.isPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-4 w-4" />
                  )}
                  Save post
                </Button>
                <span className="text-xs text-muted-foreground" role="status">
                  {dirty ? "You have unsaved changes." : "All changes saved."}
                </span>
                {dirty && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      const ok = await confirmDialog({
                        title: "Discard your changes?",
                        description: "The post goes back to how it was last saved.",
                        confirmLabel: "Discard changes",
                        destructive: true,
                      });
                      if (ok) setForm(saved);
                    }}
                  >
                    Cancel changes
                  </Button>
                )}
              </div>
            )}
          </form>
        </div>

        <div className="space-y-3">
          <section className="rounded-lg border bg-card p-4" aria-labelledby="image-heading">
            <h2 id="image-heading" className="mb-2 text-sm font-semibold">
              Cover image
            </h2>
            {imagePreviewUrl ? (
              <img
                src={imagePreviewUrl}
                alt={`Cover image for ${post.title}`}
                className="aspect-video w-full rounded-md border object-cover"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                No image yet
              </div>
            )}
            {canManage && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => onFileChange(e, "image")}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full"
                  disabled={uploadImage.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadImage.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-1.5 h-4 w-4" />
                  )}
                  {post.has_image ? "Replace image" : "Upload image"}
                </Button>
              </>
            )}
          </section>

          <section className="rounded-lg border bg-card p-4" aria-labelledby="video-heading">
            <h2 id="video-heading" className="mb-2 text-sm font-semibold">
              Video (optional)
            </h2>
            {videoPreviewUrl ? (
              <video
                src={videoPreviewUrl}
                controls
                className="aspect-video w-full rounded-md border"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
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
                  onChange={(e) => onFileChange(e, "video")}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full"
                  disabled={uploadVideo.isPending}
                  onClick={() => videoInputRef.current?.click()}
                >
                  {uploadVideo.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-1.5 h-4 w-4" />
                  )}
                  {post.has_video ? "Replace video" : "Upload video"}
                </Button>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  The website shows the video instead of the cover image.
                </p>
              </>
            )}
          </section>

          <section className="rounded-lg border bg-card p-4" aria-labelledby="engagement-heading">
            <h2 id="engagement-heading" className="mb-3 text-sm font-semibold">
              Readers
            </h2>
            <dl className="space-y-2 text-sm">
              {[
                ["Views", post.views],
                ["Likes", post.likes],
                ["Shares", post.shares],
                [
                  "Average time spent",
                  post.avg_time_spent_seconds != null ? `${post.avg_time_spent_seconds}s` : "—",
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
