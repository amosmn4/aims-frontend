import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireDepartmentAccess } from "@/components/require-role";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Finance — AIMS" }, { name: "robots", content: "noindex" }] }),
  component: FinanceLayout,
});

function FinanceLayout() {
  return (
    <RequireDepartmentAccess
      code="finance"
      message="You don't have access to Finance. Ask the CEO if you need it."
    >
      <Outlet />
    </RequireDepartmentAccess>
  );
}
