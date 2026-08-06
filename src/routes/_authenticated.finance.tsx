import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { RequireRole } from "@/components/require-role";

// Navigation for Finance now lives in the global top nav (see lib/department-nav.ts + AppShell)
// instead of an in-page tab bar — this layout just gates access and keeps the page heading.
export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Finance — AIMS" }, { name: "robots", content: "noindex" }] }),
  component: FinanceLayout,
});

function FinanceLayout() {
  return (
    <RequireRole
      roles={["finance"]}
      message="Finance workspace is restricted to the Finance team, CEO and System Administrator."
    >
      <div>
        <PageHeader
          title="Finance"
          description="Invoicing, debtor management, revenue and margin reporting for Amsol."
        />
        <Outlet />
      </div>
    </RequireRole>
  );
}
