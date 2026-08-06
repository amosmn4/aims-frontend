import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { RequireRole } from "@/components/require-role";

// Navigation for Marketing now lives in the global top nav (see lib/department-nav.ts +
// AppShell) instead of an in-page tab bar — this layout just gates access and keeps the heading.
export const Route = createFileRoute("/_authenticated/marketing")({
  head: () => ({
    meta: [{ title: "Marketing — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: MarketingLayout,
});

function MarketingLayout() {
  return (
    <RequireRole
      roles={["marketing"]}
      message="The Marketing workspace is restricted to the Marketing team, CEO and System Administrator."
    >
      <div>
        <PageHeader
          title="Marketing"
          description="Leads, follow-ups and website performance for Amsol."
        />
        <Outlet />
      </div>
    </RequireRole>
  );
}
