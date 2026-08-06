import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireRole } from "@/components/require-role";

// Thin layout only — navigation for Operations now lives in the global top nav (see
// lib/department-nav.ts + AppShell), not an in-page tab bar. Every former tab is its own real
// route under /operations/* (index = Overview, requests, workspace, tasks, calendar, reports),
// each embedding the same shared, already department-parameterized components as every other
// department — nothing here is reimplemented, just given a real URL.
export const Route = createFileRoute("/_authenticated/operations")({
  head: () => ({ meta: [{ title: "Operations — AIMS" }, { name: "robots", content: "noindex" }] }),
  component: OperationsLayout,
});

function OperationsLayout() {
  return (
    <RequireRole
      roles={["operations"]}
      message="The Operations workspace is restricted to the Operations team, CEO and System Administrator."
    >
      <Outlet />
    </RequireRole>
  );
}
