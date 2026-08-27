import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DepartmentHubTabs, useShowDepartmentHub } from "@/components/department-hub-tabs";

// Thin layout — lets CEO/admin get an in-page tab bar across Marketing's existing routes (see
// DepartmentHubTabs). A regular Marketing-scoped user's experience is untouched: bare Outlet, no
// RequireRole here (there wasn't one before this file existed either), navigation stays in the
// global top nav via lib/department-nav.ts.
export const Route = createFileRoute("/_authenticated/marketing")({
  component: MarketingLayout,
});

function MarketingLayout() {
  const showHub = useShowDepartmentHub("marketing");
  return (
    <>
      {showHub && <DepartmentHubTabs code="marketing" />}
      <Outlet />
    </>
  );
}
