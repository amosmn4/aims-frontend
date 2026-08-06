import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { RequireRole } from "@/components/require-role";

// Navigation for HR now lives in the global top nav (see lib/department-nav.ts + AppShell)
// instead of an in-page tab bar — this layout just gates access and keeps the page heading.
export const Route = createFileRoute("/_authenticated/hr")({
  head: () => ({
    meta: [{ title: "Human Resources — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: HrLayout,
});

function HrLayout() {
  return (
    <RequireRole
      roles={["hr"]}
      message="The HR workspace is restricted to the HR team, CEO and System Administrator."
    >
      <div>
        <PageHeader
          title="Human Resources"
          description="Delivery of AMSOL's own HR service lines — salary surveys, recruitment, training, HRMS licensing and outsourced HR management — for our clients."
        />
        <Outlet />
      </div>
    </RequireRole>
  );
}
