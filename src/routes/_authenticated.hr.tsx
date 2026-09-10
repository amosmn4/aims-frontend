import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/hr")({
  component: HrLayout,
});

function HrLayout() {
  return <Outlet />;
}
