import { createFileRoute, Outlet } from "@tanstack/react-router";
export const Route = createFileRoute("/marketing/blog")({
  head: () => ({ meta: [{ title: "Blog - AIMS" }] }),
  component: () => (
    <div className="production-module">
      <Outlet />
    </div>
  ),
});
