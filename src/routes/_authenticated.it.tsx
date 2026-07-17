import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/app-shell";
import { RequireRole } from "@/components/require-role";

export const Route = createFileRoute("/_authenticated/it")({
  head: () => ({
    meta: [{ title: "Information Technology — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <RequireRole
      roles={["it"]}
      message="The IT workspace is restricted to the IT team, CEO and System Administrator."
    >
      <ModulePlaceholder
        title="Information Technology"
        description="Manage the HRMS product sold/licensed to client companies and the development of all internal systems."
        bullets={[
          "HRMS client & license registry (tier, active users, renewals, uptime)",
          "HRMS usage analytics feeding the CEO dashboard",
          "Internal software development tracking (AIMS, recruitment systems, tools)",
          "IT support ticketing for internal and HRMS client issues",
          "IT asset and infrastructure register",
          "Security & access management oversight (RBAC)",
        ]}
      />
    </RequireRole>
  ),
});
