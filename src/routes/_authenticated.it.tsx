import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/it")({
  component: ItLayout,
});

function ItLayout() {
  return <Outlet />;
}
