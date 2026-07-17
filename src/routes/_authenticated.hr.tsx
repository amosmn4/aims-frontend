import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/app-shell";
import { RequireRole } from "@/components/require-role";

export const Route = createFileRoute("/_authenticated/hr")({
  head: () => ({
    meta: [{ title: "Human Resources — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <RequireRole
      roles={["hr"]}
      message="The HR workspace is restricted to the HR team, CEO and System Administrator."
    >
      <ModulePlaceholder
        title="Human Resources"
        description="Delivery of recruitment, training, salary surveys and outsourced HR management for Amsol's clients."
        bullets={[
          "Recruitment pipeline: requisitions, candidates, interview stages, placement fees",
          "Training management: programs, trainers, participants, certifications",
          "Salary survey project management with participating client tracking",
          "Outsourced HR service delivery, milestones and renewal dates",
          "Client HR service history and documentation",
        ]}
      />
    </RequireRole>
  ),
});
