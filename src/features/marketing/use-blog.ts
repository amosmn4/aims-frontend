import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiJson } from "@/lib/api-client";

export type BlogPostStatus = "draft" | "published";

export const BLOG_POST_STATUS_LABELS: Record<BlogPostStatus, string> = {
  draft: "Draft",
  published: "Published",
};

export const BLOG_POST_STATUS_STYLES: Record<BlogPostStatus, string> = {
  draft: "bg-secondary text-secondary-foreground",
  published: "bg-success/15 text-success",
};

export interface BlogPostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  has_image: boolean;
  has_video: boolean;
  tags: string[];
  author_name: string | null;
  status: BlogPostStatus;
  published_at: string | null;
  views: number;
  likes: number;
  shares: number;
  avg_time_spent_seconds: number | null;
  created_at: string;
  updated_at: string;
}

type BackendBlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  imagePath: string | null;
  videoPath: string | null;
  tags: string[] | null;
  authorName: string | null;
  status: BlogPostStatus;
  publishedAt: string | null;
  views: number;
  likes: number;
  shares: number;
  totalTimeSpentSeconds: number;
  timeSpentSamples: number;
  createdAt: string;
  updatedAt: string;
};

function mapPost(p: BackendBlogPost): BlogPostRow {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    content: p.content,
    has_image: !!p.imagePath,
    has_video: !!p.videoPath,
    tags: p.tags ?? [],
    author_name: p.authorName,
    status: p.status,
    published_at: p.publishedAt,
    views: p.views,
    likes: p.likes,
    shares: p.shares,
    avg_time_spent_seconds:
      p.timeSpentSamples > 0 ? Math.round(p.totalTimeSpentSeconds / p.timeSpentSamples) : null,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

/* ---------- Queries ---------- */

export function useBlogPosts() {
  return useQuery({
    queryKey: ["blog-posts"],
    queryFn: async () => (await apiJson<BackendBlogPost[]>("/blog-posts")).map(mapPost),
  });
}

export function useBlogPost(id: string | undefined) {
  return useQuery({
    queryKey: ["blog-posts", id],
    enabled: !!id,
    queryFn: async () => mapPost(await apiJson<BackendBlogPost>(`/blog-posts/${id}`)),
  });
}

// Blog media is behind an authenticated route, so a plain <img>/<video> src can't carry the
// bearer token — fetch as a blob and hand back an object URL instead.
function useBlogMediaPreview(id: string | undefined, has: boolean, kind: "image" | "video") {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !has) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    apiFetch(`/blog-posts/${id}/${kind}`).then(async (res) => {
      if (!res.ok || cancelled) return;
      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      if (!cancelled) setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, has, kind]);

  return url;
}

export function useBlogImagePreview(id: string | undefined, hasImage: boolean) {
  return useBlogMediaPreview(id, hasImage, "image");
}

export function useBlogVideoPreview(id: string | undefined, hasVideo: boolean) {
  return useBlogMediaPreview(id, hasVideo, "video");
}

/* ---------- Mutations ---------- */

export function useSaveBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<BlogPostRow> & { title: string; tags?: string[] }) => {
      const body = {
        title: input.title,
        excerpt: input.excerpt || undefined,
        content: input.content || undefined,
        tags: input.tags && input.tags.length > 0 ? input.tags : undefined,
        authorName: input.author_name || undefined,
      };
      if (input.id) {
        return mapPost(
          await apiJson<BackendBlogPost>(`/blog-posts/${input.id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          }),
        );
      }
      return mapPost(
        await apiJson<BackendBlogPost>("/blog-posts", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      );
    },
    onSuccess: (post) => {
      // Seed the post first so the page shows the saved text before the refetch lands.
      qc.setQueryData(["blog-posts", post.id], post);
      qc.invalidateQueries({ queryKey: ["blog-posts"] });
    },
  });
}

export function useDeleteBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiJson(`/blog-posts/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blog-posts"] }),
  });
}

export function useUploadBlogImage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch(`/blog-posts/${id}/image`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      return mapPost(await res.json());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blog-posts"] });
      qc.invalidateQueries({ queryKey: ["blog-posts", id] });
    },
  });
}

export function useUploadBlogVideo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch(`/blog-posts/${id}/video`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      return mapPost(await res.json());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blog-posts"] });
      qc.invalidateQueries({ queryKey: ["blog-posts", id] });
    },
  });
}

export function usePublishBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      mapPost(await apiJson<BackendBlogPost>(`/blog-posts/${id}/publish`, { method: "POST" })),
    onSuccess: (post) => {
      qc.invalidateQueries({ queryKey: ["blog-posts"] });
      qc.invalidateQueries({ queryKey: ["blog-posts", post.id] });
    },
  });
}

export function useUnpublishBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      mapPost(await apiJson<BackendBlogPost>(`/blog-posts/${id}/unpublish`, { method: "POST" })),
    onSuccess: (post) => {
      qc.invalidateQueries({ queryKey: ["blog-posts"] });
      qc.invalidateQueries({ queryKey: ["blog-posts", post.id] });
    },
  });
}
