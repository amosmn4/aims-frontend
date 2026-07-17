import { createFileRoute, Outlet } from "@tanstack/react-router";

// Thin layout — the workspace lives in _authenticated.requests.index.tsx and the detail page
// in _authenticated.requests.$requestId.tsx. Both are nested under this route by TanStack
// Router's file convention, so they only render if this file provides an <Outlet />.
export const Route = createFileRoute("/_authenticated/requests")({
  component: () => <Outlet />,
});
