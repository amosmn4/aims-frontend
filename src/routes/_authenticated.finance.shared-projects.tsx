import { createFileRoute } from "@tanstack/react-router";
import { SharedProjectsView } from "@/features/projects/shared-with-me";

export const Route = createFileRoute("/_authenticated/finance/shared-projects")({
  head: () => ({ meta: [{ title: "Finance — Shared with me — AIMS" }] }),
  component: SharedProjectsView,
});
