import { createFileRoute, Outlet } from "@tanstack/react-router";

// Thin layout for the requests list and request detail pages.
export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({
    meta: [{ title: "Client requests — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: () => <Outlet />,
});
