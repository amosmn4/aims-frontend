import { createFileRoute } from "@tanstack/react-router";
import { SharedProjectsView } from "@/features/projects/shared-with-me";

export const Route = createFileRoute("/_authenticated/hr/shared-projects")({
  head: () => ({ meta: [{ title: "HR — Shared with me — AIMS" }] }),
  component: SharedProjectsView,
});
