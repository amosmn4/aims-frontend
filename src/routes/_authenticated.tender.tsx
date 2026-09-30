import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireDepartmentAccess } from "@/components/require-role";

export const Route = createFileRoute("/_authenticated/tender")({
  head: () => ({ meta: [{ title: "Tender — AIMS" }, { name: "robots", content: "noindex" }] }),
  component: TenderLayout,
});

function TenderLayout() {
  return (
    <RequireDepartmentAccess
      code="tender"
      message="The Tender workspace is for the Tender team, people granted Tender access and the CEO."
    >
      <Outlet />
    </RequireDepartmentAccess>
  );
}
