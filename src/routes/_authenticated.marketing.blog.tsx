import { createFileRoute, Outlet } from "@tanstack/react-router";

// Thin layout — the list lives in _authenticated.marketing.blog.index.tsx and the editor page
// in _authenticated.marketing.blog.$postId.tsx. Both are nested under this route by TanStack
// Router's file convention, so they only render if this file provides an <Outlet />.
export const Route = createFileRoute("/_authenticated/marketing/blog")({
  head: () => ({ meta: [{ title: "Blog — AIMS" }] }),
  component: () => <Outlet />,
});
