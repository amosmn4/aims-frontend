import { createFileRoute, Outlet } from "@tanstack/react-router";

// Thin layout — the actual workspace lives in _authenticated.tender.index.tsx and the detail
// page in _authenticated.tender.$tenderId.tsx. Both are nested under this route by TanStack
// Router's file convention, so they only render if this file provides an <Outlet />.
export const Route = createFileRoute("/_authenticated/tender")({
  component: () => <Outlet />,
});
