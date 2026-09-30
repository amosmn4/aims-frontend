import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireDepartmentAccess } from "@/components/require-role";

export const Route = createFileRoute("/_authenticated/hr")({
  head: () => ({ meta: [{ title: "HR — AIMS" }, { name: "robots", content: "noindex" }] }),
  component: HrLayout,
});

function HrLayout() {
  return (
    <RequireDepartmentAccess
      code="hr"
      message="The HR workspace is for the HR team, people granted HR access and the CEO."
    >
      <Outlet />
    </RequireDepartmentAccess>
  );
}
