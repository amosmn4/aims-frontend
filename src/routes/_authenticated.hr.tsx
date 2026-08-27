import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DepartmentHubTabs, useShowDepartmentHub } from "@/components/department-hub-tabs";

// Thin layout — lets CEO/admin AND HR-role staff (the pilot for regular department staff, see
// useShowDepartmentHub) get an in-page tab bar across HR's existing routes. Everyone else's
// experience is untouched: bare Outlet, no RequireRole here (there wasn't one before this file
// existed either), navigation stays in the global top nav via lib/department-nav.ts.
export const Route = createFileRoute("/_authenticated/hr")({
  component: HrLayout,
});

function HrLayout() {
  const showHub = useShowDepartmentHub("hr");
  return (
    <>
      {showHub && <DepartmentHubTabs code="hr" />}
      <Outlet />
    </>
  );
}
