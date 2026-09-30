import { createFileRoute, redirect } from "@tanstack/react-router";

// Reports used to live here. One page now serves every kind, at /reports/:id.
export const Route = createFileRoute("/_authenticated/department-reports/$reportId")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/reports/$reportId", params: { reportId: params.reportId } });
  },
});
