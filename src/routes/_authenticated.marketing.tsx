import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireDepartmentAccess } from "@/components/require-role";

export const Route = createFileRoute("/_authenticated/marketing")({
  head: () => ({ meta: [{ title: "Marketing — AIMS" }, { name: "robots", content: "noindex" }] }),
  component: MarketingLayout,
});

function MarketingLayout() {
  return (
    <RequireDepartmentAccess
      code="marketing"
      message="You don't have access to Marketing. Ask the CEO if you need it."
    >
      <Outlet />
    </RequireDepartmentAccess>
  );
}
