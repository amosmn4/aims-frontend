import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireDepartmentAccess } from "@/components/require-role";

export const Route = createFileRoute("/_authenticated/it")({
  head: () => ({ meta: [{ title: "IT — AIMS" }, { name: "robots", content: "noindex" }] }),
  component: ItLayout,
});

function ItLayout() {
  return (
    <RequireDepartmentAccess
      code="it"
      message="You don't have access to IT. Ask the CEO if you need it."
    >
      <Outlet />
    </RequireDepartmentAccess>
  );
}
