import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireRole } from "@/components/require-role";
import { DepartmentHubTabs, useShowDepartmentHub } from "@/components/department-hub-tabs";

// Navigation for a regular Tender-scoped user still lives in the global top nav (see
// lib/department-nav.ts + AppShell) — every former tab is its own real route under /tender/*
// (index = Overview, bid-pipeline, requests, workspace, tasks, calendar, reports, plus the
// pre-existing $tenderId detail route), each embedding the same shared, already
// department-parameterized components as every other department. CEO/admin get an in-page tab
// bar back on top of those same routes — see DepartmentHubTabs.
export const Route = createFileRoute("/_authenticated/tender")({
  head: () => ({ meta: [{ title: "Tender — AIMS" }, { name: "robots", content: "noindex" }] }),
  component: TenderLayout,
});

function TenderLayout() {
  const showHub = useShowDepartmentHub("tender");
  return (
    <RequireRole
      roles={["tender"]}
      message="The Tender workspace is restricted to the Tender team, CEO and System Administrator."
    >
      {showHub && <DepartmentHubTabs code="tender" />}
      <Outlet />
    </RequireRole>
  );
}
