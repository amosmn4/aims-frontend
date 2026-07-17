import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/app-shell";
import { RequireRole } from "@/components/require-role";

export const Route = createFileRoute("/_authenticated/marketing-ops")({
  head: () => ({
    meta: [{ title: "Marketing & Operations — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <RequireRole
      roles={["marketing_ops"]}
      message="The Marketing & Operations workspace is restricted to the Marketing & Ops team, CEO and System Administrator."
    >
      <ModulePlaceholder
        title="Marketing & Operations"
        description="Sales and marketing across all Amsol products/services, plus operational coordination of service delivery."
        bullets={[
          "Leads & opportunity tracking for all products/services",
          "Campaign planning, cost, leads generated, ROI",
          "Sales pipeline feeding the company-wide pipeline value",
          "Cross-department service delivery coordination",
          "Resource allocation and capacity tracking",
          "SLA monitoring, client satisfaction surveys and escalations",
        ]}
      />
    </RequireRole>
  ),
});
