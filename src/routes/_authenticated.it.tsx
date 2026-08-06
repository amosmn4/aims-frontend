import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { RequireRole } from "@/components/require-role";

// Navigation for IT now lives in the global top nav (see lib/department-nav.ts + AppShell)
// instead of an in-page tab bar — this layout just gates access and keeps the page heading.
export const Route = createFileRoute("/_authenticated/it")({
  head: () => ({
    meta: [{ title: "Information Technology — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: ItLayout,
});

function ItLayout() {
  return (
    <RequireRole
      roles={["it"]}
      message="The IT workspace is restricted to the IT team, CEO and System Administrator."
    >
      <div>
        <PageHeader
          title="Information Technology"
          description="Website & systems work runs through Projects — this is what IT maintains."
        />
        <Outlet />
      </div>
    </RequireRole>
  );
}
