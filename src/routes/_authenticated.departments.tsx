import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/departments")({
  head: () => ({ meta: [{ title: "Departments — AIMS" }, { name: "robots", content: "noindex" }] }),
  component: () => <Outlet />,
});
