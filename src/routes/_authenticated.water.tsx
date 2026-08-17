import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireRole } from "@/components/require-role";

// Thin layout only, same convention as every other department hub — real routes per tab
// (index = Dashboard, meters, customers, readings, upload, reports), navigation lives in the
// global top nav (see lib/department-nav.ts / app-shell.tsx). Not tied to any of the six core
// departments — access is the "water" role, assigned per user in Admin > Users & Roles, on top
// of the usual admin/CEO bypass.
export const Route = createFileRoute("/_authenticated/water")({
  head: () => ({
    meta: [{ title: "Water Project — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: WaterLayout,
});

function WaterLayout() {
  return (
    <RequireRole
      roles={["water"]}
      message="The Water Project is restricted to System Administrator, CEO, and users granted the Water Project role."
    >
      <Outlet />
    </RequireRole>
  );
}
