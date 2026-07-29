import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { DepartmentTaskBoard } from "./_authenticated.projects.department";

export const Route = createFileRoute("/_authenticated/marketing/tasks")({
  head: () => ({ meta: [{ title: "Marketing — Tasks — AIMS" }] }),
  component: MarketingTasks,
});

function MarketingTasks() {
  const departmentsQ = useDepartments();
  const dept = departmentsQ.data?.find((d) => d.code === "marketing");
  if (!dept) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  return <DepartmentTaskBoard departmentId={dept.id} />;
}
