import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireRole } from "@/components/require-role";

// Thin layout only — navigation for Tender now lives in the global top nav (see
// lib/department-nav.ts + AppShell), not an in-page tab bar. Every former tab is its own real
// route under /tender/* (index = Overview, bid-pipeline, requests, workspace, tasks, calendar,
// reports, plus the pre-existing $tenderId detail route), each embedding the same shared,
// already department-parameterized components as every other department.
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
