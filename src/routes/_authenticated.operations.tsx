import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireDepartmentAccess } from "@/components/require-role";

export const Route = createFileRoute("/_authenticated/operations")({
  head: () => ({ meta: [{ title: "Operations — AIMS" }, { name: "robots", content: "noindex" }] }),
  component: OperationsLayout,
});

function OperationsLayout() {
  return (
    <RequireDepartmentAccess
      code="operations"
      message="You don't have access to Operations. Ask the CEO if you need it."
    >
      <Outlet />
    </RequireDepartmentAccess>
  );
}
