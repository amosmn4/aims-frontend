import { createFileRoute } from "@tanstack/react-router";
import { useRole } from "@/lib/role";
import { CeoDashboard } from "@/components/CeoDashboard";
import { DepartmentWorkspace } from "@/components/DepartmentWorkspace";
import { StaffReportingDashboard } from "@/components/reporting/StaffReportingDashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Amsol Projects & Reporting" },
      {
        name: "description",
        content: "See where every Amsol project stands, recent reports and what needs attention.",
      },
      { property: "og:title", content: "Dashboard · Amsol Projects & Reporting" },
      {
        property: "og:description",
        content: "See where every Amsol project stands, recent reports and what needs attention.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { mode } = useRole();
  return mode === "ceo" ? (
    <CeoDashboard />
  ) : mode === "department" ? (
    <DepartmentWorkspace />
  ) : (
    <StaffReportingDashboard />
  );
}
