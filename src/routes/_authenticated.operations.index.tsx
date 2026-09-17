import { createFileRoute } from "@tanstack/react-router";
import { ClientRequestsWorkspace } from "./_authenticated.requests.index";

export const Route = createFileRoute("/_authenticated/operations/")({
  head: () => ({ meta: [{ title: "Requests overview — Operations — AIMS" }] }),
  component: OperationsHome,
});

function OperationsHome() {
  return <ClientRequestsWorkspace departmentCode="operations" />;
}
