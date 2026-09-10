import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireRole } from "@/components/require-role";

export const Route = createFileRoute("/_authenticated/tender")({
  head: () => ({ meta: [{ title: "Tender — AIMS" }, { name: "robots", content: "noindex" }] }),
  component: TenderLayout,
});

function TenderLayout() {
  return (
    <RequireRole
      roles={["tender"]}
      message="The Tender workspace is restricted to the Tender team, CEO and System Administrator."
    >
      <Outlet />
    </RequireRole>
  );
}
