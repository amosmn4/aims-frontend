import { apiFetch as request, isDemo } from "@/lib/api";
import { loadWorkspace } from "@/lib/workspace";

export async function apiFetch(path: string, options: RequestInit = {}) {
  if (isDemo) throw new Error("Production modules require the connected backend.");
  const module = path.startsWith("/payment-ledger")
    ? "ledger"
    : path.startsWith("/blog-posts")
      ? "blog"
      : path.startsWith("/water") || path.startsWith("/ai/")
        ? "water"
        : null;
  if (!module) throw new Error("Module access is required.");
  const mapped = path
    .replace(/^\/blog-posts(?=\/|$)/, "/blog/posts")
    .replace(/^\/ai\//, "/water/assistant/");
  try {
    return await request(mapped, options);
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && error.status === 403) {
      window.dispatchEvent(new CustomEvent("amsol-ops-module-denied", { detail: module }));
      void loadWorkspace().catch(() => {});
    }
    throw error;
  }
}
export async function apiJson<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, options);
  return response.status === 204 ? (undefined as T) : response.json();
}
