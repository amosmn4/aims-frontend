import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/finance/reports")({
  head: () => ({
    meta: [{ title: "Finance Reports — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: () => <Outlet />,
});

export { Link };
