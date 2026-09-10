import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/operations")({
  component: OperationsLayout,
});

function OperationsLayout() {
  return <Outlet />;
}
